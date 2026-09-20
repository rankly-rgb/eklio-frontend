import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, GENERATION_MODEL } from "@/lib/ai/client";
import { ETHICS_SYSTEM_RULES } from "@/lib/ethics/rules";
import { checkEthics, hasBlockingViolation } from "@/lib/ethics/rules";
import { rulesBlock } from "@/lib/ethics/guard";
import { buildHowYouWorkContext } from "@/lib/generation/how-you-work-context";
import { checkBannedPhrases, listBannedPhrases } from "@/lib/generation/banned-phrases";
import { allowedClaimsFrom, checkUnbackedClaims } from "@/lib/ethics/claims";
import { track } from "@/lib/analytics";
import type { Catalog } from "@/lib/catalog/types";
import { ethicsCheckSchema, type EthicsCheck } from "@/lib/brand/shapes";
import type { BriefBundle } from "@/lib/data/brief";
import {
  BODY_MAX,
  FIRST_PARAGRAPH_MAX,
  buildDirectoryProfile,
  type DirectoryProfileDraft,
  type ProseProblem,
  type StructuredInput,
} from "@/lib/directory/profile";

/*
 * ── LA PROSE DU PROFIL PSYCHOLOGY TODAY ─────────────────────────────────
 *
 * Le dernier maillon manquant : `save_directory_profile` n'avait aucun
 * appelant, donc le livrable CENTRAL de The Foundation n'était produit par
 * personne. L'écran existait et disait « pas encore écrit ».
 *
 * ⚠ MÊME CHEMIN QUE LES AUTRES LIVRABLES GÉNÉRÉS, pas un chemin à part :
 *
 *   client          `getAnthropicClient()` + `GENERATION_MODEL`, comme
 *                   `lib/generation/model.ts` et `usp-options.ts`
 *   plafond         un nombre d'APPELS, vérifié AVANT l'appel — la même forme
 *                   que `MAX_MODEL_CALLS` dans `usp-options.ts`. Un plafond en
 *                   jetons ne se connaît qu'une fois la réponse revenue : ce
 *                   n'est pas un plafond, c'est un reçu.
 *   journalisation  `track()` avec `model_calls`, comme
 *                   `usp_options_generated`
 *
 * ⚠ ET L'ETHICS GUARD EST CELUI QUI EXISTE, PAS UN SECOND. Depuis L13, un
 * TRIGGER `directory_profiles_ethics_gate` passe `first_paragraph` ET `body`
 * par `ethics_blocks` et par `usp_banned_phrases_check` (les trente clichés
 * d'annuaire, écrits pour Psychology Today). Ce module ne le réimplémente pas :
 * il pré-scanne avec les MÊMES gardes que la base, pour offrir une reprise
 * plutôt qu'une exception — et la base reste l'autorité qui tranche à
 * l'écriture.
 *
 * ⚠ LES DEUX GARDES, PAS UNE. Ce fichier n'a longtemps pré-scanné qu'avec
 * `checkEthics` alors que le trigger applique DEUX gardes. La conséquence
 * était mesurable et a été mesurée en production le 19 septembre : un
 * brouillon contenant « you deserve » passait les deux tentatives sans que
 * rien ne le relève, mourait au `save_directory_profile` avec un 23514, et la
 * route rendait « Something didn't go through on our side » — un refus
 * présenté comme une panne, devant quelqu'un qui n'avait qu'à réécrire une
 * phrase. La boucle de reprise ne peut réparer que ce qu'elle voit ; elle voit
 * désormais les deux.
 */

/**
 * ⚠ DEUX APPELS AU PLUS, ET LE SECOND N'EXISTE QUE POUR LA DÉONTOLOGIE.
 *
 * Même valeur et même raison que `usp-options.ts`. Le premier écrit, le second
 * réécrit ce que la garde a refusé. Un troisième serait un modèle qu'on
 * supplie, pas qu'on corrige.
 */
export const MAX_MODEL_CALLS = 2;

export class DirectoryCeilingError extends Error {
  constructor(readonly limit: number) {
    super(
      `Plafond atteint : ${limit} appels modèle déjà faits pour ce profil. ` +
        `Rien de plus n'a été appelé et rien de plus n'a été dépensé.`
    );
    this.name = "DirectoryCeilingError";
  }
}

export class DirectoryProseRefusedError extends Error {
  constructor(readonly violations: string[]) {
    super(
      `La prose produite reste bloquée par la garde déontologique : ` +
        `${violations.join(", ")}.`
    );
    this.name = "DirectoryProseRefusedError";
  }
}

/**
 * ⚠ UN CLICHÉ N'EST PAS UNE INFRACTION DÉONTOLOGIQUE, et les confondre serait
 * la même faute que confondre un refus et une panne. « Nous n'avons pas réussi
 * à l'écrire sans une formule que tout l'annuaire emploie » et « nous n'avons
 * pas réussi à l'écrire sans mettre votre licence en risque » n'appellent ni la
 * même inquiétude ni la même action. Deux familles, deux erreurs, deux phrases.
 */
export class DirectoryProseClicheError extends Error {
  constructor(readonly phrases: string[]) {
    super(
      `La prose produite emploie des formules bannies de l'annuaire : ` +
        `${phrases.join(", ")}.`
    );
    this.name = "DirectoryProseClicheError";
  }
}

/**
 * ⚠ UN CREDENTIAL QUE LE BRIEF NE PORTE PAS — LE FILET, PAS LE PÉAGE.
 *
 * `lib/ethics/claims.ts` a été écrit après l'incident LMHC/Oregon et n'a
 * jamais tourné : un seul import dans le dépôt, et c'était un test. Mesuré le
 * 20 septembre, la route du profil d'annuaire — le chemin d'où venait
 * l'incident — ne vérifiait AUCUN credential contre le brief.
 *
 * ⚠ ET IL NE DOIT PRESQUE RIEN ATTRAPER, C'EST LE BUT. Depuis que la prose
 * n'écrit plus aucun titre (le bloc est composé par le code), le chemin normal
 * ne produit plus la faute. Mesuré sur les trois briefs réels, prose sans
 * titre : ZÉRO refus sur trois. Une garde qui refuse rarement parce que le
 * chemin normal ne produit plus la faute est une bonne garde ; une garde qui
 * refuse souvent dit que le chemin normal est cassé.
 */
export class DirectoryUnbackedCredentialError extends Error {
  constructor(readonly claims: string[]) {
    super(
      `La prose produite revendique un credential que le brief ne porte pas : ` +
        `${claims.join(", ")}.`
    );
    this.name = "DirectoryUnbackedCredentialError";
  }
}

export class DirectoryProseInvalidError extends Error {
  constructor(readonly problems: ProseProblem[]) {
    super(`La prose produite ne passe pas le gabarit : ${problems.join(", ")}.`);
    this.name = "DirectoryProseInvalidError";
  }
}

/*
 * ⚠ DEUX CHAMPS, PAS UN TEXTE QU'ON DÉCOUPERAIT ENSUITE.
 *
 * Le gabarit du lot 1 stocke `first_paragraph` et `body` séparément, et la
 * base a un CHECK sur chacun. C'est le premier paragraphe que les résultats de
 * recherche de l'annuaire montrent, et c'est lui que The First Line réécrira :
 * le faire produire tel quel évite d'avoir à deviner plus tard où il s'arrête.
 *
 * `strict: true` : les deux champs sont garantis présents et typés. Ce qui
 * n'est PAS garanti, ce sont les longueurs et la non-répétition — `checkProse`
 * s'en charge, et refuse au lieu de tronquer.
 */
const TOOL: Anthropic.Tool = {
  name: "write_directory_profile",
  description:
    "Write the personal statement for this clinician's Psychology Today profile, from the brief provided.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      first_paragraph: {
        type: "string",
        description:
          `The opening paragraph, and the ONLY part shown in directory search results. ` +
          `It has to work alone: someone reading just this should recognise their own ` +
          `situation in it. Name the problem the way a client would say it out loud, ` +
          `not the way a clinician would code it. ${FIRST_PARAGRAPH_MAX} characters at most.`,
      },
      body: {
        type: "string",
        description:
          `The rest of the statement: what the work is actually like, who it suits, ` +
          `and what a first session involves. ⚠ Do NOT repeat the first paragraph ` +
          `here — it is shown above this text, not instead of it. ` +
          `${BODY_MAX} characters at most.`,
      },
    },
    required: ["first_paragraph", "body"],
    additionalProperties: false,
  },
};

/**
 * Le cadrage système.
 *
 * ⚠ LE SOCLE DÉONTOLOGIQUE VIENT EN PREMIER, et c'est la même composition que
 * `systemPrompt()` dans `lib/generation/model.ts` : `ETHICS_SYSTEM_RULES` puis
 * les règles lues en base. Aucune consigne de style ne doit pouvoir se lire
 * comme une permission de les assouplir — et un troisième texte déontologique
 * écrit ici serait exactement le second chemin qu'on refuse.
 */
/**
 * ⚠ LES TRENTE CLICHÉS ENTRENT DANS LE PROMPT, ET C'EST UNE MESURE QUI L'A
 * IMPOSÉ. Cinq générations relevées en production le 19 septembre :
 *
 *   19:17  400  Directory cliche: you deserve
 *   19:18  400  Directory cliche: you deserve
 *   19:33  200  (celle-ci est passée)
 *   19:57  400  Directory cliche: you deserve
 *   19:57  400  Directory cliche: you deserve
 *
 * QUATRE FOIS LA MÊME PHRASE, y compris après que la praticienne eut changé
 * son type de licence ET son domaine d'expertise. Ce n'est donc pas son brief
 * qui produit le cliché : c'est qu'on demandait au modèle d'écrire un profil
 * d'annuaire sans jamais lui dire ce qui le ferait rejeter, puis qu'on
 * rejetait. Une reprise répare un jet ; elle ne répare pas un prompt qui ne
 * dit pas la règle.
 *
 * ⚠ AUCUNE PHRASE N'EST ÉCRITE ICI. Elles viennent de `banned_phrases` par
 * `listBannedPhrases()`, et s'y ajoutent sans déploiement. Une liste recopiée
 * dans ce fichier serait une seconde définition de « cliché » — et la
 * trente-et-unième serait ignorée du modèle et refusée par la base.
 */
function clicheBlock(phrases: readonly string[]): string {
  if (phrases.length === 0) return "";
  return `Never use any of these phrases, or a close paraphrase of one. Every other profile in this directory already uses them, so they tell the reader nothing:

${phrases.map((phrase) => `- ${phrase}`).join("\n")}`;
}

/*
 * ⚠ CE BLOC N'INTERDIT QUE, IL NE PRESCRIT RIEN, ET C'EST LA RÈGLE DU LOT.
 *
 * Interdire un tic ET prescrire son remplacement fabriquerait exactement le
 * gabarit qu'on cherche à éviter : chaque profil porterait le remplacement au
 * même endroit, et la variété qu'on croit acheter serait une uniformité
 * déplacée d'un cran. On retire, on ne remplace pas — la phrase suivante est à
 * la praticienne et au modèle de la trouver, pas à ce fichier de la dicter.
 *
 * ⚠ ET CES CINQ-LÀ SONT AU NIVEAU 1, DÉLIBÉRÉMENT. Deux d'entre elles ont un
 * jumeau applicable — les deux clichés de métier vivent dans `banned_phrases`
 * (donc pré-scan + refus à l'écriture), et les intertitres sont refusés par
 * `checkProse`. Les trois autres restent du pilotage de modèle, et la raison
 * est écrite plutôt que tue :
 *
 *   l'objet ménager      la table ne porte que des LITTÉRAUX ; « les
 *                        chaussettes », « le thermostat » sont la même figure
 *                        et aucun littéral ne les couvre.
 *   l'horaire inventé    une heure de la journée est indiscernable, par motif,
 *                        d'une vraie mention de disponibilité (« Tuesdays at
 *                        9:00 »). Un refus mécanique casserait la seconde.
 *   le paragraphe seul   c'est un jugement de rythme, pas un défaut de format.
 *                        Une règle mécanique refuserait aussi les bonnes fins
 *                        courtes, et coûterait un appel modèle pour le faire.
 */
const TICS = `Some moves are worn out or unverifiable. Do not use any of them. Do not replace them with a fixed substitute of your own either — leave the space empty and write something else entirely.

- Do not build an example around an ordinary household object standing in for a deeper conflict: the argument about the dishwasher that is not about the dishwasher, the socks, the thermostat. Every profile in this directory has already used it.
- Do not use headings, section labels, or lines in capital letters. This is a personal statement, not a brochure.
- Do not invent specifics you cannot know: a clock time, a day of the week, a season, a place inside the reader's life. Precision you could not have is audible.
- Do not do arithmetic on the session hour: one hour out of the week, out of a hundred and sixty-eight, the other six days. It sounds clever and it is not yours.
- Do not end on a single sentence standing alone as its own paragraph.
- Do not state a licence, a title, a degree, a certification or a number of years anywhere in the text. Not "As an LCSW", not "I am a licensed professional counselor", not "with fifteen years of experience". Her name and her title are printed separately, from her state board's own wording, above what you write. A title you place inside a sentence is a title you chose — and one you could have chosen wrongly.`;

/*
 * ⚠ UNE QUALITÉ RECHERCHÉE, JAMAIS UNE SECTION NI UN EMPLACEMENT. La dernière
 * phrase du bloc est ce qui l'empêche de devenir un gabarit : sans elle, le
 * modèle grouperait les engagements au même endroit dans chaque profil, et on
 * aurait remplacé un tic par un autre.
 *
 * Ce que la mesure a montré : les meilleures phrases des trois sorties étaient
 * des ENGAGEMENTS de comportement — « I'll interrupt », « I'd rather tell you
 * up front than surprise you in week three » — et non des descriptions
 * d'expérience. Une promesse qui coûte quelque chose se croit ; une
 * description ne se vérifie pas.
 */
/*
 * ⚠ UNE CIBLE, PAS UNE BORNE — ET LA DIFFÉRENCE EST TOUT LE SUJET.
 *
 * Décidée le 20 septembre, après mesure. Trois sorties du chemin réel
 * faisaient 470, 830 et 560 mots : trop de variance pour un livrable vendu.
 * La cause n'était pas un plafond mal réglé, c'était qu'il n'y en avait
 * AUCUN qui morde. Les deux bornes de `profile.ts` valent ensemble ~1 260
 * mots, et les trois sorties en occupaient 37 %, 44 % et 66 %. Rien, nulle
 * part, ne disait au modèle quelle longueur viser.
 *
 * ⚠ LES PLAFONDS RESTENT EN CARACTÈRES ET EN BASE. Ce sont eux l'autorité, et
 * ils REFUSENT. Ceci est une cible : elle n'est appliquée nulle part, elle ne
 * refuse rien, et `checkProse` n'a toujours AUCUN plancher — un refus qui
 * coûte un appel modèle parce qu'un texte est court est un mauvais échange, et
 * un profil court peut être bon.
 *
 * ⚠ ET C'EST UNE FOURCHETTE DE MOTS, RIEN D'AUTRE. Pas « trois à cinq
 * paragraphes », pas de sections, pas d'emplacements. Une cible de structure
 * produirait le gabarit que le bloc des tics ci-dessus existe pour empêcher :
 * on aurait contraint la forme en croyant contraindre la longueur.
 *
 * ⚠ CE QUE LA CIBLE NE FAIT PAS, ET QUI EST DÉJÀ FAIT AILLEURS : dire à la
 * CLIENTE que SON texte est trop court. C'est `too_short_to_say_anything`, une
 * règle de positionnement — un conseil qu'elle lit, pas un refus qu'on lui
 * oppose. Les deux ne doivent pas être confondues : ici on vise, là-bas on
 * conseille, et nulle part on ne refuse pour cause de brièveté.
 */
/*
 * ⚠ LE MOT « paragraph » A ÉTÉ RETIRÉ DE CETTE PHRASE, et ce n'est pas du
 * style. La première rédaction disait « across the opening paragraph and the
 * rest together » — pour nommer les deux CHAMPS, pas pour prescrire un
 * découpage. Mais la sonde qui interdit toute structure dans cette phrase l'a
 * refusée, et elle a eu raison : le mot ouvre la porte au comptage, et les
 * deux champs sont déjà décrits dans le schéma de l'outil. « opening and rest
 * combined » dit la même chose sans nommer une unité de forme.
 */
const LENGTH = `Aim for 450 to 650 words in total, opening and rest combined. This is a target, not a limit: a good statement that lands outside it is better than a padded or clipped one that lands inside.`;

const COMMITMENTS = `The sentences that earn trust are commitments about your own behaviour — what you will do, what you will say, what you will not let pass — rather than descriptions of experience. A promise that costs the writer something can be believed; a description of experience cannot be checked. Where a sentence could be either, prefer the commitment.

This is a quality to aim for, not a section. Do not group these sentences, do not label them, and do not put them in any particular place.`;

export function directorySystemPrompt(
  rules: Catalog["ethicsRules"],
  /*
   * Par défaut vide, et le prompt reste alors valide — c'est le cas des sondes
   * qui n'ont pas de base. En production la liste vient toujours de la table :
   * `generateDirectoryProfile` la lit avant le premier appel.
   */
  bannedPhrases: readonly string[] = []
): string {
  return [
    ETHICS_SYSTEM_RULES,
    rulesBlock(rules),
    clicheBlock(bannedPhrases),
    TICS,
    COMMITMENTS,
    LENGTH,
    `You are writing the personal statement for a licensed mental-health clinician's Psychology Today profile.

A directory profile is read by someone who is already looking for help and is deciding whether to call THIS person rather than the next one on the list. Most profiles on that list say the same things. Yours has to say what is true of this practice and not of the others.

Name the problem the way a client would describe it to a friend — "we keep having the same argument", "I can't switch off after work" — not the way it appears in a chart. Do not lead with modality names, and do not describe a demographic instead of a difficulty.

Write in plain American English, in the first person, short sentences, no exclamation marks. Describe the work, never its result.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Ce que le module rend : un brouillon prêt pour `save_directory_profile`. */
export type DirectoryGeneration = {
  draft: DirectoryProfileDraft;
  /**
   * Ce que le scan a trouvé, dans la forme que la base EXIGE.
   *
   * ⚠ `ethicsCheckSchema`, PAS UNE FORME ÉCRITE ICI. Le premier jet de ce
   * module envoyait `{ violations, scanned_at }` — inventé, jamais lu — et le
   * CHECK `brand_kit_ethics_check_valid` refusait l'insertion APRÈS l'appel
   * modèle : la génération était payée et rien n'était rangé. Le gabarit
   * existait déjà (`lib/brand/shapes.ts`), miroir de ce que la base valide.
   * C'est la règle « pas de quatrième liste », enfreinte puis rétablie.
   */
  ethicsCheck: EthicsCheck;
  modelCalls: number;
};

type Parsed = { firstParagraph: string; body: string };

function parse(response: Anthropic.Message): Parsed {
  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) throw new Error("Le modèle n'a produit aucun bloc d'outil.");

  const input = toolUse.input as Record<string, unknown>;
  return {
    /*
     * ⚠ PAS DE `?? ""` ICI. Un champ manquant doit arriver jusqu'à
     * `checkProse`, qui le nommera `first_paragraph_missing` — le masquer par
     * une chaîne vide produirait « body_missing » sur le mauvais champ, ou
     * pire, un profil publié avec un paragraphe vide.
     */
    firstParagraph: typeof input.first_paragraph === "string" ? input.first_paragraph : "",
    body: typeof input.body === "string" ? input.body : "",
  };
}

/** L'appel modèle, isolé pour que les tests puissent l'injecter. */
export type DirectoryCall = (system: string, prompt: string) => Promise<Parsed>;

export const callDirectoryProfile: DirectoryCall = async (system, prompt) => {
  const response = await getAnthropicClient().messages.create({
    model: GENERATION_MODEL,
    max_tokens: 4000,
    system,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [{ role: "user", content: prompt }],
  });
  return parse(response);
};

/**
 * Produit la prose, la scanne, et rend un brouillon.
 *
 * ⚠ AUCUNE COMPOSITION PAR CONCATÉNATION. Les champs structurés passent par
 * `buildDirectoryProfile`, qui n'assemble aucune chaîne et n'écrit aucun
 * libellé devant une valeur : un champ absent ne produit PAS de ligne, pas non
 * plus une ligne vide. C'est la discipline de L9, et le cas « tous les
 * optionnels vides » est un cas normal qui rend `{}`.
 */
export async function generateDirectoryProfile(
  bundle: BriefBundle,
  catalog: Catalog,
  structured: StructuredInput,
  call: DirectoryCall = callDirectoryProfile,
  /*
   * ⚠ LE MÊME APPEL QUE LES DEUX AUTRES GÉNÉRATEURS, pas une seconde copie :
   * `lib/generation/banned-phrases.ts` est le seul chemin vers
   * `banned_phrases` (contrat §9.6, §9.11). Il s'injecte pour les sondes, comme
   * `call` juste au-dessus.
   */
  bannedPhrasesCheck: (text: string) => Promise<string[]> = checkBannedPhrases,
  /** La même liste que la base refuse, donnée au modèle AVANT qu'il écrive. */
  bannedPhrasesList: () => Promise<string[]> = listBannedPhrases
): Promise<DirectoryGeneration> {
  /*
   * ⚠ UNE SEULE LECTURE, AVANT LA BOUCLE. Les trente phrases ne changent pas
   * entre deux tentatives de la même génération, et les relire à chaque tour
   * serait un aller-retour payé pour rien.
   */
  const system = directorySystemPrompt(catalog.ethicsRules, await bannedPhrasesList());
  const brief = buildHowYouWorkContext(bundle, catalog);

  let modelCalls = 0;
  let prompt = brief;
  let lastViolations: string[] = [];

  for (let attempt = 0; attempt < MAX_MODEL_CALLS; attempt += 1) {
    /*
     * ⚠ LE PLAFOND EST VÉRIFIÉ AVANT L'APPEL, jamais après. Un plafond lu
     * après coup n'est pas un plafond : l'argent est déjà dépensé, et ce
     * produit n'a aucune primitive de remboursement.
     */
    if (modelCalls >= MAX_MODEL_CALLS) throw new DirectoryCeilingError(MAX_MODEL_CALLS);

    const raw = await call(system, prompt);
    modelCalls += 1;

    const built = buildDirectoryProfile({
      platform: "psychology_today",
      firstParagraph: raw.firstParagraph,
      body: raw.body,
      structured,
    });

    if (!built.ok) {
      /*
       * Longueur ou répétition. On ne tronque pas — `checkProse` refuse, et
       * une coupure silencieuse produirait une phrase qui s'arrête au milieu,
       * sur un profil public, sans que personne l'ait décidé.
       */
      if (attempt + 1 >= MAX_MODEL_CALLS) {
        throw new DirectoryProseInvalidError(built.problems);
      }
      prompt = `${brief}\n\nYour previous attempt was rejected: ${built.problems.join(
        ", "
      )}. Write it again, respecting the limits.`;
      continue;
    }

    /*
     * ⚠ LE MÊME SCANNER QUE PARTOUT AILLEURS. `checkEthics` lit
     * `FORBIDDEN_PATTERNS`, dont `ethics_patterns` en base est le jumeau
     * recensé (test de parité, lot 2 B3). On scanne les DEUX champs
     * séparément : le trigger en base fait exactement cela, et scanner une
     * concaténation laisserait passer une violation à cheval sur la jointure.
     */
    /*
     * ⚠ CHAQUE CHAMP EST SCANNÉ SÉPARÉMENT ET SON NOM EST GARDÉ. Le trigger en
     * base fait exactement cela ; et `flagged[].field` doit dire LEQUEL des
     * deux, sans quoi le journal ne sert à rien le jour où on le relit.
     */
    const scanned = [
      { field: "first_paragraph", text: built.draft.prose.firstParagraph },
      { field: "body", text: built.draft.prose.body },
    ].map((entry) => ({ ...entry, scan: checkEthics(entry.text) }));

    const violations = scanned.flatMap((entry) => entry.scan.violations);
    const flagged = scanned.flatMap((entry) =>
      entry.scan.violations.map((violation) => ({
        field: entry.field,
        excerpt: violation.excerpt,
        rule_id: violation.ruleId,
      }))
    );

    if (!hasBlockingViolation(violations)) {
      /*
       * ⚠ LA SECONDE GARDE DE LA BASE, PRÉ-SCANNÉE ICI POUR QU'ELLE SOIT
       * RÉPARABLE. Le trigger passe chaque champ par `usp_banned_phrases_check`
       * en plus de `ethics_blocks` ; sans cet appel, un cliché ne se découvrait
       * qu'à l'écriture, quand il n'y a plus ni tentative ni budget pour le
       * corriger.
       *
       * ⚠ LE MÊME APPEL QUE LA BASE, pas un motif recopié. Les trente phrases
       * vivent dans `banned_phrases` et s'y ajoutent sans déploiement ; une
       * liste recopiée ici serait une seconde définition de « cliché », qui
       * divergerait le jour de la trente-et-unième.
       *
       * ⚠ CHAQUE CHAMP SÉPARÉMENT, comme le trigger : une phrase à cheval sur
       * la jointure des deux champs n'est pas une phrase qu'elle a écrite.
       */
      /*
       * ⚠ LE CREDENTIAL, AVANT LES CLICHÉS. Un titre infondé engage une
       * licence ; un cliché engage une réputation. L'ordre des deux gardes
       * dit lequel des deux on refuse en premier quand un jet porte les deux.
       *
       * ⚠ ET C'EST LE BRIEF QUI AUTORISE, PAS LE CATALOGUE. `allowedClaimsFrom`
       * ne lit QUE la licence et le diplôme saisis : un brief sans licence
       * n'autorise aucun sigle, ce qui est la bonne réponse et non un défaut.
       */
      const autorise = allowedClaimsFrom(
        bundle.brief.license_type_id,
        catalog.licenseTypes,
        bundle.brief.degree_id,
        catalog.degrees
      );
      const infondes = [
        ...new Set(
          [built.draft.prose.firstParagraph, built.draft.prose.body]
            .flatMap((texte) => checkUnbackedClaims(texte, autorise))
            .map((violation) => violation.excerpt ?? violation.reason)
        ),
      ].sort();

      if (infondes.length > 0) {
        if (attempt + 1 >= MAX_MODEL_CALLS) {
          track("directory_profile_unbacked_refused", { model_calls: modelCalls });
          throw new DirectoryUnbackedCredentialError(infondes);
        }
        prompt = `${brief}\n\nYour previous attempt claimed a credential the brief does not carry: ${infondes
          .map((claim) => `"${claim}"`)
          .join(
            ", "
          )}. Write it again without stating any licence, title, degree, certification or number of years. Her title is printed separately, above your text.`;
        continue;
      }

      const cliches = [
        ...new Set(
          (
            await Promise.all([
              bannedPhrasesCheck(built.draft.prose.firstParagraph),
              bannedPhrasesCheck(built.draft.prose.body),
            ])
          ).flat()
        ),
      ].sort();

      if (cliches.length > 0) {
        /*
         * ⚠ LA DERNIÈRE TENTATIVE REFUSE PLUTÔT QUE DE LAISSER LA BASE REFUSER.
         * Les deux refusent la même chose ; celui-ci arrive avec les phrases
         * nommées et sans avoir prétendu qu'il s'agissait d'une panne.
         */
        if (attempt + 1 >= MAX_MODEL_CALLS) {
          track("directory_profile_cliche_refused", { model_calls: modelCalls });
          throw new DirectoryProseClicheError(cliches);
        }
        prompt = `${brief}\n\nYour previous attempt used phrases that every other profile in this directory already uses: ${cliches
          .map((phrase) => `"${phrase}"`)
          .join(
            ", "
          )}. Write it again without them, and without a synonym that means the same thing. Say what she actually does instead.`;
        continue;
      }

      track("directory_profile_generated", {
        model_calls: modelCalls,
        warnings: violations.length,
      });
      /*
       * ⚠ VALIDÉ ICI, contre le même schéma que la base applique. Une forme
       * fausse doit lever AVANT l'appel réseau, pas revenir comme une
       * violation de contrainte dont le message ne nomme pas la clé fautive.
       */
      const ethicsCheck = ethicsCheckSchema.parse({
        passed: true,
        flagged,
        checked_at: new Date().toISOString(),
      });

      return { draft: built.draft, ethicsCheck, modelCalls };
    }

    lastViolations = violations
      .filter((violation) => violation.severity === "block")
      .map((violation) => `${violation.ruleId}: ${violation.reason}`);

    /*
     * Réécrire, puis re-scanner — la discipline de `lib/check/rewrite.ts` :
     * « the re-scan is not optional and not conditional ». La boucle repasse
     * par `checkEthics`, elle ne fait pas confiance à la réécriture.
     */
    prompt = `${brief}\n\nYour previous attempt broke advertising ethics rules: ${lastViolations.join(
      "; "
    )}. Write it again without those claims.`;
  }

  track("directory_profile_refused", { model_calls: modelCalls });
  throw new DirectoryProseRefusedError(lastViolations);
}
