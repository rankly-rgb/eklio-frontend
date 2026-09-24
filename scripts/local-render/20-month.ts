/*
 * ── LE MOIS, VISÉ À TRENTE VISUELS SUR TRENTE ───────────────────────────
 *
 * La version du matin rendait 16 posts sur 30, dont 11 arrivaient en visuel.
 * Ce qui a changé, dans l'ordre où ça agit :
 *
 *   1. LE PRÉFIXE DIT LES COMPTES ET MONTRE UN EXEMPLE conforme par
 *      archétype, et demande une ligne de carte d'au plus 30 caractères —
 *      mesuré : au-delà, le titre se pose sous 102px et tout libellé de
 *      diagramme tombe sous 11px dans une vignette de 350.
 *   2. UN CHAMP QUI DÉPASSE EST RÉÉCRIT SEUL (`repair.ts`), deux passes au
 *      plus. Les dépassements mesurés étaient tous de 1 à 3 mots.
 *   3. ON EN DEMANDE PLUS QUE TRENTE, et les sujets non retenus sont rendus
 *      à la banque.
 *   4. UNE CARTE QUI NE TIENT PAS SE REPLIE (`fallback.ts`) au lieu d'être
 *      jetée : moins de libellés, puis carrousel, puis une phrase.
 *   5. LE PREMIER MOIS D'UN COMPTE EST ÉCRIT EN SYNCHRONE. Le Batch met 25 à
 *      30 minutes ; une nouvelle abonnée ne les attend pas.
 *   6. CHAQUE APPEL PAYANT ENTRE AU LEDGER, abouti ou non.
 *
 *   ANTHROPIC_API_KEY="$EKLIO_ANTHROPIC_API_KEY" \
 *     npx tsx scripts/local-render/20-month.ts --confirm [--email <compte>]
 */
import { spawnSync } from "node:child_process";
import Anthropic from "@anthropic-ai/sdk";
import {
  cachedPrefix,
  variablePart,
  validateCopy,
  buildBatchRequests,
  collectCopy,
  batchCostUsd,
  clampCardLine,
  copyEffort,
  typographicQuotes,
  deepTypographic,
  syncCostUsd,
  massCopyModel,
  type BrandContext,
  type TopicRequest,
} from "../../lib/content/generate/copy-batch";
import { repairPayload } from "../../lib/content/generate/repair";
import { reviseMonth, revisionOn } from "../../lib/content/generate/revise";
import { chooseArchetype, scheduleDates } from "../../lib/content/generate/plan";
import { anthropicContentModel } from "../../lib/content/generate/model";
import { deriveThemes } from "../../lib/content/generate/themes";
import { composeWithFallback } from "../../lib/compose/fallback";
import { cardPalette } from "../../lib/compose/palette";
import { checkEthics } from "../../lib/ethics/rules";
import { checkinLeaks } from "../../lib/content/leakage";
import { capitaliseTitle, eyebrowFor } from "../../lib/content/bands";
import type { ContentCheckin, ContentRegister } from "../../lib/data/content";
import { redundantAgainst } from "../../lib/content/dedup";
import {
  bankShortfall, CANDIDATES_PER_ATTEMPT, WINDOW_ROUNDS, type BankDemand,
} from "../../lib/content/bank";
import {
  checkMonth, writtenLinesIn, FORMAT_FAMILIES, familyOf, type Finding,
} from "../../lib/content/month-checks";
import { undecidedIn, type CompletenessVerdicts } from "../../lib/content/writing-checks";
import { judgeCompleteness } from "../../lib/content/generate/completeness-judge";
import {
  practitionerLines, identityAllowList, PRACTITIONER_CARDS_PER_MONTH,
  type PractitionerFacts,
} from "../../lib/content/practitioner";
import { loadJournal, rememberBatch, rememberResult, clearJournal } from "./journal";
import type { DirectionPalette } from "../../lib/compose/palette";
import {
  admin, anthropicKeyOrDie, accountFor, untypedTable, MONTH, SESSION_CAP_USD,
  noteSpend, runSpendUsd,
} from "./lib";
import { withOverhead, type CreditPort } from "../../lib/credits/paid-call";

const WANTED = 30;

const ZERO = (): { input: number; output: number; cacheRead: number; cacheWrite: number } =>
  ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
/*
 * ⚠ QUARANTE-QUATRE POUR TRENTE. Le quota est de trente crédits ; un essai
 * refusé rend le sien tout de suite, donc la sur-génération n'est bornée que
 * par la banque et par le plafond de dépense. Mesuré : il faut environ 1,2
 * essai par post écrit.
 */
/*
 * ⚠ ASSEZ POUR QUE LA RÉSERVE EXISTE VRAIMENT. À 44, le rendement réel
 * (~75 % des candidats donnent un post utilisable) laissait 33 utilisables
 * pour 30 voulus : le sélecteur trouvait un banc VIDE et ne pouvait échanger
 * aucun post refusé. Un mois refusé sans remplaçant n'est pas une correction,
 * c'est un abandon.
 */
/*
 * ⚠ SOIXANTE-DOUZE, ET C EST MESURÉ SUR DIX ESSAIS GELÉS. À 54, la préparation
 * rendait entre 26 et 30 posts utilisables pour 30 voulus : le banc était
 * NÉGATIF dans huit essais sur dix, donc le sélecteur ne pouvait échanger
 * aucun post refusé et chaque constat survivait jusqu au verdict.
 *
 * La perte mesurée entre le tirage et la préparation est d environ 45 %
 * — budget de mots, schéma, déontologie depuis qu une violation écarte le
 * candidat. Soixante-douze en rend une quarantaine : trente posés, dix au
 * banc.
 */
const CANDIDATES = CANDIDATES_PER_ATTEMPT;

/*
 * ── ⚠ LE REMPLISSAGE PART AVANT LA GÉNÉRATION, PAS APRÈS L'ÉCHEC ────────
 *
 * Le 2026-09-23, le quatrième essai n'a tiré que 18 candidats sur 54. Rien ne
 * l'avait annoncé : la banque portait 88 sujets libres, et le total n'est pas
 * la grandeur qui décide. `cycle` et `numbered_strategies` en avaient cinq
 * chacun, et un mois ne se compose pas avec ça.
 *
 * La banque était donc remplie APRÈS l'échec — c'est-à-dire après avoir payé
 * l'écriture d'un mois qui ne pouvait pas sortir. Le stock tirable est
 * maintenant compté AVANT le tirage, par archétype, avec la requête qui tire
 * (`drawable_count_for_kit`), et le remplissage part de lui-même s'il manque.
 *
 * ⚠ `--no-fill` REFUSE AU LIEU DE REMPLIR, en nommant ce qui manque et la
 * commande qui le corrige. Un remplissage est un appel payant : il doit
 * pouvoir se déclencher tout seul dans un `cron`, et jamais par surprise sous
 * la main de quelqu'un qui regardait ailleurs.
 */
const BANK_DEMAND: BankDemand = {
  practitioners: numberFlag("--practitioners", 1),
  attempts: numberFlag("--attempts", 4),
  rounds: numberFlag("--rounds", WINDOW_ROUNDS),
};

function numberFlag(flag: string, fallback: number): number {
  const i = process.argv.indexOf(flag);
  const n = i === -1 ? fallback : Number(process.argv[i + 1]);
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

/**
 * Compte ce que le tirage verra, et remplit s'il manque.
 *
 * ⚠ IL NE REND PAS LA MAIN TANT QUE LE REMPLISSAGE N'A PAS FINI. Lancer la
 * génération pendant que le lot de sujets tourne reviendrait à tirer dans la
 * banque d'avant — donc exactement au défaut qu'on répare.
 */
async function guardTheBank(db: ReturnType<typeof admin>, kitId: string): Promise<void> {
  const { data, error } = await (db.rpc as unknown as (
    n: string, a: Record<string, unknown>
  ) => Promise<{ data: Array<{ archetype_key: string; drawable: number }> | null; error: { message: string } | null }>)(
    "drawable_count_for_kit", { p_brand_kit_id: kitId }
  );
  if (error) throw new Error(`drawable_count_for_kit: ${error.message}`);
  const drawable = Object.fromEntries((data ?? []).map((r) => [r.archetype_key, Number(r.drawable)]));
  const short = bankShortfall(drawable, { ...BANK_DEMAND, attempts: 1, rounds: 1 });
  if (short.length === 0) {
    const thinnest = Object.entries(drawable).sort((a, b) => a[1] - b[1])[0];
    console.error(`▸ banque : ${thinnest?.[0]} au plus bas avec ${thinnest?.[1]} tirables — le tour passe`);
    return;
  }

  const said = short.map((s) => `${s.archetype} ${s.drawable}/${s.needed}`).join(", ");
  /*
   * ⚠ `--confirm` EN FAIT PARTIE, ET SON ABSENCE A FAIT ÉCHOUER LE PREMIER
   * DÉCLENCHEMENT RÉEL. Le garde-fou a bien vu le manque, bien lancé le
   * remplissage — et le remplissage a répondu « Refusing without --confirm »,
   * puis le mois est tombé. Une commande construite dans une chaîne que
   * personne n'a lancée est une commande qui ne marche pas.
   *
   * ⚠ ET LE CONFIRMER ICI EST LÉGITIME : l'opératrice a déjà confirmé une
   * dépense pour CE mois, et le remplissage en fait partie. `--no-fill` reste
   * la porte de sortie pour qui ne veut pas de cette dépense-là.
   */
  const fill = [
    "npx tsx scripts/local-render/10-topic-bank.ts --sync --confirm",
    `--practitioners ${BANK_DEMAND.practitioners}`,
    `--attempts ${BANK_DEMAND.attempts}`,
    `--rounds ${BANK_DEMAND.rounds}`,
  ].join(" ");

  if (process.argv.includes("--no-fill")) {
    throw new Error(
      `la banque ne porte pas de quoi composer ce mois — ${said}. Remplir d'abord : ${fill}`
    );
  }

  console.error(`▸ banque sous le seuil (${said}) — remplissage AVANT la génération`);
  const [command, ...args] = fill.split(" ");
  const filled = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (filled.status !== 0) {
    throw new Error(`le remplissage a échoué (code ${filled.status}) — ${said}`);
  }
}

/*
 * ── LE MÉLANGE DU MOIS ──────────────────────────────────────────────────
 *
 * Un tiers de cartes à une phrase, un tiers de diagrammes simples, un tiers de
 * carrousels et de formes larges. Mesuré le 2026-09-21 : à 350px — la largeur
 * d'une vignette dans un fil — une phrase se lit et un diagramme à quatre
 * cases ne se lit pas. Un mois composé à neuf dixièmes de diagrammes est un
 * mois que personne ne lit sur un téléphone.
 *
 * ⚠ LES FAMILLES SONT DÉFINIES PAR LE NOMBRE DE LIBELLÉS QU'ELLES PORTENT,
 * pas par leur nom. C'est le nombre de libellés qui décide de la taille du
 * texte, et la taille du texte décide de la lisibilité.
 */
/*
 * ── ⚠ L'ORDRE DES FAMILLES DÉCIDE QUELS FORMATS UN MOIS PEUT PORTER ─────
 *
 * Mesuré le 2026-09-23 sur deux mois livrés : **zéro carrousel sur soixante
 * posts**, alors que la banque en portait vingt-trois de libres. Le rapport de
 * rejet, une fois qu'il a nommé l'archétype, dit pourquoi : les CINQ
 * carrousels tirés ont été refusés comme redondants, au tirage.
 *
 * `redundantAgainst` compare un titre à TOUS ceux déjà acceptés, sans regarder
 * le format. La famille tirée en dernier affronte donc les trente-six titres
 * des deux premières, et perd. Les rejets suivent exactement l'ordre de
 * tirage :
 *
 *   statement (tiré 1er) :  7 rejets
 *   simple    (tiré 2e)  : 15 rejets
 *   varied    (tiré 3e)  : 23 rejets
 *
 * ⚠ CE N'ÉTAIT PAS UN MANQUE DE STOCK, C'ÉTAIT UN ORDRE DE PASSAGE. Les
 * formats larges — ceux que les références utilisent le plus — étaient
 * éliminés par construction.
 *
 * Ils passent donc en premier. `single_statement` a la forme la plus souple
 * et le plus gros stock : c'est lui qui peut absorber les rejets, pas le
 * carrousel. L'objet garde son ordre d'écriture pour que la lecture reste
 * celle du mélange publié ; c'est `DRAW_ORDER` qui décide du tirage.
 */
/*
 * ⚠ LES FAMILLES VIENNENT DU CONTRÔLE, PAS L'INVERSE. Le plancher par format
 * se calcule sur la part visée par CE tirage : deux listes tenues à la main
 * auraient divergé au premier archétype ajouté, et le plancher aurait alors
 * mesuré une composition que personne ne vise.
 *
 * ⚠ CE QUI RESTE PROPRE AU TIRAGE EST LE POIDS. `carousel` figure deux fois,
 * et c'est mesuré : le mélange en exige au moins deux par mois (F22) ; sur
 * huit essais gelés, trois n'en ont livré qu'UN. Le carrousel empile trois à
 * six payloads, il se perd à la validation plus souvent que les autres, et un
 * tirage à égalité n'en laisse pas deux debout. Deux tours sur quatre, donc —
 * un poids de tirage, jamais une composition.
 */
const FAMILIES: Record<string, string[]> = Object.fromEntries(
  Object.entries(FORMAT_FAMILIES).map(([family, keys]) => [
    family,
    family === "varied" ? [keys[0], keys[1], keys[0], ...keys.slice(2)] : [...keys],
  ])
);

/** Du format le plus large au plus souple : qui affronte le moins de titres déjà pris. */
const DRAW_ORDER = ["varied", "simple", "statement"] as const;

type Topic = { id: string; archetype_key: string; intent: string; title: string; hook: string };
type Usage = { input: number; output: number; cacheRead: number; cacheWrite: number };

type Candidate = {
  topic: Topic;
  family: string;
  reservationId: string | null;
  result: ReturnType<typeof validateCopy> | null;
  /**
   * Ce que CE candidat a coûté.
   *
   * ⚠ IL MANQUAIT, ET LE LIVRE MENTAIT EN GRAND. `validateCopy` ne rend pas
   * d'`usage` ; le règlement retombait donc sur le cumul du mois, et chacun
   * des vingt-neuf succès inscrivait au ledger la dépense de tout le mois.
   * Un livre qui multiplie par trente est pire qu'un livre vide : le premier
   * a l'air d'un chiffre.
   */
  usage: Usage;
};

const arg = (name: string): string | null => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
};

async function main() {
  if (!process.argv.includes("--confirm")) {
    console.error("\n✗ Refusing without --confirm. This spends money.\n");
    process.exit(1);
  }
  const started = Date.now();
  const key = anthropicKeyOrDie();
  const db = admin();
  const client = new Anthropic({ apiKey: key });
  const { userId, projectId, kitId } = await accountFor(db, arg("email"));

  /*
   * ── ⚠ LA SEULE PORTE D'UN APPEL PAYANT, ET ELLE EST OUVERTE ICI ───────
   *
   * Mesuré : dix mois, trois cents posts, `credit_ledger` inchangé (F25). Le
   * port est défini AVANT le premier appel du script — la dérivation des
   * thèmes — parce que les helpers `reserve`/`settle` d'avant étaient déclarés
   * quatre cents lignes plus bas, après elle. Un appel payant écrit au-dessus
   * de sa comptabilité est un appel qu'aucune comptabilité ne voit.
   */
  const credits: CreditPort = {
    async reserve(spec) {
      const { data } = await db.rpc("reserve_credit", {
        p_user: spec.userId, p_kind: spec.kind, p_reason: spec.reason,
        p_provider: spec.provider ?? "anthropic", p_model: spec.model ?? massCopyModel(),
        p_month: spec.month ?? MONTH,
      } as never);
      const row = data as unknown as { ok?: boolean; reservation_id?: string } | null;
      return row?.ok === true ? (row.reservation_id ?? null) : null;
    },
    async settle(reservationId, costUsd, succeeded) {
      /*
       * ⚠ LE SEUL GOULOT OÙ PASSE CHAQUE DOLLAR. Frais généraux et crédits de
       * post se soldent ici, tous les deux : compter ailleurs aurait compté la
       * moitié, ce qui est la façon dont un plafond devient décoratif.
       */
      noteSpend(costUsd, `${MONTH} · ${succeeded ? "réglé" : "relâché"}`);
      await db.rpc("settle_credit", {
        p_reservation_id: reservationId,
        p_actual_cost_usd: Number(costUsd.toFixed(6)),
        p_succeeded: succeeded,
      } as never);
    },
  };

  /** Un appel de frais généraux : au livre, sans prendre de crédit. */
  const overhead = <T>(reason: string, run: () => Promise<{ value: T; usage: Usage }>) =>
    withOverhead(credits, { userId, reason, model: massCopyModel(), month: MONTH }, async () => {
      const { value, usage: u } = await run();
      return { value, usage: u, costUsd: syncCostUsd(u) };
    });

  const { data: already } = await db
    .from("content_months").select("id, status").eq("brand_kit_id", kitId).eq("month", MONTH).maybeSingle();
  if (already) {
    console.error(`\n✗ Kit ${kitId} already has a ${MONTH} month (${already.status}).\n`);
    process.exit(1);
  }

  /*
   * ⚠ LE PREMIER MOIS EST SYNCHRONE, ET C'EST UNE PROMESSE PRODUIT. Aucun
   * `content_months` pour ce kit veut dire qu'elle vient de s'abonner et
   * qu'elle regarde l'écran. La Batch API met 25 à 30 minutes, quelle que
   * soit la taille du lot — mesuré quatre fois. Les mois suivants, eux,
   * tombent dans la nuit et le lot est le bon outil.
   */
  const { count: priorMonths } = await db
    .from("content_months").select("id", { count: "exact", head: true }).eq("brand_kit_id", kitId);
  const firstMonth = (priorMonths ?? 0) === 0;
  const useBatch = process.argv.includes("--batch") || (!firstMonth && !process.argv.includes("--sync"));

  /* ── Ce à partir de quoi le mois est écrit ─────────────────────────── */
  const { data: kit } = await db
    .from("brand_kits").select("voice_guide, directions, selected_direction_id").eq("id", kitId).single();
  const { data: preferences } = await db
    .from("content_preferences").select("cadence_per_week, accepted_registers, off_limits")
    .eq("brand_kit_id", kitId).single();
  const { data: checkinRow } = await db
    .from("content_checkins").select("brand_kit_id, month, sessions_theme, taking_clients, happening")
    .eq("brand_kit_id", kitId).eq("month", MONTH).maybeSingle();
  const { data: rules } = await db.from("ethics_rules").select("*");
  /*
   * ── ⚠ LE BRIEF DE CE PROJET-LÀ, ET LA CLAUSE QUI MANQUAIT ─────────────
   *
   * Cette lecture était `.limit(1).single()` SANS `.eq("project_id", …)`.
   * Elle rendait donc la PREMIÈRE ligne de `project_briefs`, quel que soit le
   * compte dont on écrivait le mois. Avec quinze praticiennes en base, chaque
   * mois généré depuis le 2026-09-21 a été écrit à partir du brief de
   * « Rowan Mercier Therapy » : son nom de cabinet, sa ville, son État, ses
   * modalités — et sa liste d'autorisation.
   *
   * ⚠ C'EST LA VRAIE CAUSE DE F16. « Rowan Mercier Therapy » sur le mois
   * d'Isla Thornbury n'était pas une identité inventée par le modèle : c'était
   * l'identité D'UNE AUTRE PRATICIENNE, servie par une clause `where`
   * manquante. Le modèle n'a fabriqué que l'adresse e-mail, dérivée du nom
   * qu'on venait de lui tendre.
   *
   * ⚠ ET LE CONTRÔLE ÉTAIT AVEUGLE PAR CONSTRUCTION. `checkInventedIdentity`
   * reçoit `practiceName` et `allowList` de cette même lecture : il AUTORISAIT
   * donc « Rowan Mercier Therapy » sur les quinze comptes, et aurait signalé
   * le vrai nom de chacune. Un filet nourri par la source qu'il surveille ne
   * surveille rien.
   *
   * Le produit, lui, lit ses briefs par `project_id` partout
   * (`lib/app/header-context.ts`, `lib/images/context.ts`) : le défaut était
   * dans ce harnais seul. Il reste la spécification du chemin serveur, qui
   * n'écrit pas encore de mois.
   */
  const { data: brief } = await db
    .from("project_briefs")
    .select("practice_name, positioning, usp_statement, city, state, modality_ids")
    .eq("project_id", projectId)
    .single();
  if (!preferences || !rules?.length || !brief) throw new Error("the account is not complete");

  const directions = (kit?.directions ?? []) as Array<{ id: string; palette: never }>;
  const direction = directions.find((d) => d.id === kit?.selected_direction_id) ?? directions[0];
  const practiceName = brief.practice_name ?? "the practice";

  /*
   * ── ⚠ « CORRECTAMYTH » A ÉTÉ IMPRIMÉ SUR UNE CARTE PUBLIABLE ──────────
   *
   * Le champ s'appelle `angleLabel` et attend un LIBELLÉ. Cette ligne lui
   * passait `topic.intent`, qui est un IDENTIFIANT : `correct_a_myth`,
   * `behind_the_practice`. Le rendu met en capitales et retire la ponctuation,
   * donc le tiret bas disparaissait et les mots se collaient — un code interne
   * publié en haut d'une carte de clinicienne, en gras, en mono.
   *
   * Le chemin produit (`lib/content/review.ts`) lisait déjà `angle_label`. Le
   * harnais, non. C'était la MÊME fonction de rendu avec deux appelants, dont
   * un seul juste, et c'est le harnais qui fabrique les planches qu'on note.
   *
   * ⚠ LE CATALOGUE EST LU UNE FOIS, PAS PAR CARTE. Cinq lignes, trente
   * cartes : une jointure par carte serait trente allers-retours pour une
   * table qui ne bouge pas pendant un mois.
   */
  const { data: intentRows } = await db.from("content_intents").select("id, label");
  const intentLabels = new Map(
    (intentRows ?? []).map((r) => [r.id as string, r.label as string])
  );
  /*
   * La ville et l'État viennent du brief, pas du bilan — mais ils fuitaient
   * sur les cartes de la même façon (« Oakland, California » en libellé de
   * diagramme), et c'est le même contrôle qui les arrête.
   */
  const briefLocation = [brief.city, brief.state].filter(Boolean).join(", ") || null;

  /*
   * ── ⚠ LA CARTE PRATICIENNE SE REMPLIT, ELLE NE S'ÉCRIT PAS ────────────
   *
   * Ses lignes viennent du brief que la praticienne a saisi. Si le brief n'en
   * porte pas assez, `practitionerLines` rend `null` et l'archétype n'est PAS
   * TIRÉ du tout — le mélange se rééquilibre sur les dix autres plutôt que de
   * livrer une carte à moitié vide, ou pire, une carte inventée.
   */
  const facts: PractitionerFacts = {
    practiceName: brief.practice_name ?? null,
    city: brief.city ?? null,
    state: brief.state ?? null,
    // ⚠ Le libellé tel qu'il est en base, sinon l'identifiant en capitales :
    // « emdr » devient « EMDR », qui est ce qu'une carte doit porter.
    modalities: ((brief.modality_ids ?? []) as string[]).map((id) => id.toUpperCase()),
    takingClients: (checkinRow?.taking_clients ?? null) as PractitionerFacts["takingClients"],
  };
  const practitionerPayload = (() => {
    const lines = practitionerLines(facts);
    return lines ? { lines } : null;
  })();
  const allowList = identityAllowList(facts);
  if (!practitionerPayload) {
    console.error("▸ practitioner_card écarté : le brief ne porte pas assez de faits");
  }

  const voice = (() => {
    const guide = kit?.voice_guide as { tone?: string; sounds_like?: string[] } | null;
    return [guide?.tone, ...(guide?.sounds_like ?? [])].filter(Boolean).join(" · ") || "plain, warm, unhurried";
  })();
  const brand: BrandContext = {
    practiceName, voice, offLimits: preferences.off_limits ?? "", ethicsRules: rules,
  };

  const checkin = (checkinRow ?? null) as ContentCheckin | null;
  /*
   * ⚠ LA DÉRIVATION DES THÈMES EST UN APPEL PAYANT, ET ELLE N'ÉTAIT DANS
   * AUCUN COMPTEUR. `oneLine` jetait `response.usage` : son coût n'était pas
   * seulement absent du livre, il était inconnu. Le puits le rend maintenant,
   * et `overhead` l'inscrit sans prendre de crédit à la praticienne — un mois
   * n'a pas à lui coûter un post pour choisir ses trois thèmes.
   */
  const themesUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const themes = (await overhead("month themes", async () => {
    const model = anthropicContentModel(rules, (u) => {
      themesUsage.input += u.input;
      themesUsage.output += u.output;
    });
    const value = await deriveThemes(model, {
      month: MONTH,
      checkin,
      briefContext: [brief.positioning, brief.usp_statement].filter(Boolean).join("\n"),
      offLimits: preferences.off_limits ?? null,
    });
    return { value, usage: themesUsage };
  })).value;
  console.error(`▸ themes (${themes.source}): ${themes.themes.join(" · ")}`);
  console.error(`▸ ${firstMonth ? "FIRST month → synchronous" : "a later month"} · ${useBatch ? "Batch API" : "sync calls"}`);

  await guardTheBank(db, kitId);

  /* ── Les candidats, tirés par famille ──────────────────────────────── */
  const perFamily = Math.ceil(CANDIDATES / 3);
  const candidates: Candidate[] = [];
  const drawnIds: string[] = [];
  const shortfall: string[] = [];
  /*
   * ── ⚠ LE DOUBLON SE REFUSE AU TIRAGE, ET SON SUJET EST RELÂCHÉ ────────
   *
   * Le mois du 2026-09-21b portait six paires de titres de même sens — « Life
   * rewrote itself » et « When life rewrites itself », trois variantes de
   * « competence masks ». Chacun passait tous les contrôles, parce qu'aucun ne
   * regardait les AUTRES titres du mois.
   *
   * Refuser à l'écriture arriverait trop tard : le sujet est déjà marqué
   * assigné et sort de la banque pour 90 jours. Il est donc écarté ICI, et son
   * assignation part dans `released` avec les sujets sur-générés non utilisés
   * — la règle du cahier des charges, « les sujets non utilisés ne sont pas
   * marqués assignés », vaut aussi pour ceux-là.
   */
  /*
   * ⚠ L'ARCHÉTYPE EST DANS LE MOTIF DE REJET, et il y manquait. Le mois de
   * teo.marrow est sorti sans un seul carrousel, et le rapport ne permettait
   * pas de dire si aucun n'avait été tiré ou si les cinq avaient été refusés
   * comme redondants. « Absent du mois » et « refusé au tirage » demandent
   * deux corrections opposées.
   */
  const rejected: Array<{ title: string; archetype: string; because: string }> = [];
  const releasedEarly: string[] = [];

  const accept = (topic: Topic, family: string): boolean => {
    /*
     * ── ⚠ LA CARTE PRATICIENNE EST UN APPOINT, PAS UN ARCHÉTYPE ─────────
     *
     * Mesuré le 2026-09-23 : dès que la banque a porté des cartes
     * praticiennes libres, le tirage en a pris NEUF sur trente. Toutes
     * identiques — mêmes trois lignes venues du brief, même dessin de porte,
     * seul le titre changeait — et le mois a passé tous les contrôles, parce
     * que 9 sur 30 font exactement 30,0 %, le plafond au centième près.
     *
     * ⚠ ET LE PLAFOND EST ICI, PAS DANS LA RONDE PAR FAMILLE. Posé dans la
     * ronde, il ne tenait que sur le PREMIER des deux tirages : le rattrapage
     * qui complète le mois demande un sujet sans nommer d'archétype, et il en
     * a repris huit. Un plafond posé sur une seule des deux portes n'est pas
     * un plafond. `accept` est la seule par où les deux passent.
     */
    if (
      topic.archetype_key === "practitioner_card" &&
      candidates.filter((c) => c.topic.archetype_key === "practitioner_card").length
        >= PRACTITIONER_CARDS_PER_MONTH
    ) {
      rejected.push({
        title: topic.title,
        archetype: topic.archetype_key,
        because: `déjà ${PRACTITIONER_CARDS_PER_MONTH} cartes praticiennes, et leurs lignes sont identiques`,
      });
      releasedEarly.push(topic.id);
      return false;
    }

    /*
     * ⚠ SUR LE TITRE COMPLET **ET** SUR CE QUI SERA IMPRIMÉ.
     *
     * Le dédoublonnage lisait `topic.title`, la forme longue en banque. Mais
     * la carte porte `clampCardLine(title)` — trente caractères — et deux
     * titres distincts en banque peuvent s'y réduire au MÊME texte. Le mois de
     * marlow.quint est sorti avec deux cartes titrées « When the body
     * disagrees », l'une en quadrant, l'autre en courbe : aucune des deux
     * règles lexicales n'avait de raison de les rapprocher, puisqu'en banque
     * elles ne se ressemblaient pas.
     *
     * La ligne de carte est donc comparée telle qu'elle sera lue.
     */
    const line = clampCardLine(topic.title).toLowerCase();
    if (candidates.some((c) => clampCardLine(c.topic.title).toLowerCase() === line)) {
      rejected.push({ title: topic.title, archetype: topic.archetype_key, because: `même ligne de carte une fois coupée : « ${line} »` });
      releasedEarly.push(topic.id);
      return false;
    }

    const clash = redundantAgainst(topic.title, candidates.map((c) => c.topic.title));
    if (clash) {
      rejected.push({ title: topic.title, archetype: topic.archetype_key, because: clash });
      releasedEarly.push(topic.id);
      return false;
    }
    candidates.push({ topic, family, reservationId: null, result: null, usage: ZERO() });
    drawnIds.push(topic.id);
    return true;
  };

  /*
   * ── ⚠ À TOUR DE RÔLE DANS LA FAMILLE, ET PAS « LE PREMIER JUSQU'À
   *      ÉPUISEMENT DU QUOTA » ──────────────────────────────────────────
   *
   * La boucle interne était `while (taken < perFamily)` autour d'UN archétype :
   * le premier de la famille absorbait le quota entier, et les autres
   * n'étaient atteints que s'il manquait de stock. Le mélange d'un mois
   * dépendait donc de la PÉNURIE — et quand la banque a été remplie, il s'est
   * effondré : le mois de perrin.vale est sorti avec 5 archétypes sur 11, sans
   * un seul cycle, numbered_strategies ni annotated_curve, alors que la banque
   * en portait 23, 23 et 30. Six icebergs identiques et onze phrases seules.
   *
   * C'est l'inverse exact de ce qu'un lecteur doit voir, et c'est pour ça que
   * le mois PRÉCÉDENT, à court de stock, était plus varié que celui-ci.
   *
   * Un tour de rôle prend un sujet de chaque archétype, puis recommence. Un
   * archétype épuisé sort de la ronde ; les autres continuent.
   */
  for (const family of DRAW_ORDER) {
    const archetypes = FAMILIES[family];
    let taken = 0;
    // ⚠ Un archétype dont le brief ne porte pas les faits n'entre pas dans la
    // ronde : il ne sert à rien de tirer un sujet qu'on ne pourra pas composer.
    const live = archetypes.filter((a) => a !== "practitioner_card" || practitionerPayload !== null);

    while (taken < perFamily && live.length > 0) {
      for (let k = 0; k < live.length && taken < perFamily; ) {
        const { data: topicId, error } = await (db.rpc as unknown as (
          n: string, a: Record<string, unknown>
        ) => Promise<{ data: string | null; error: { message: string } | null }>)(
          "assign_topic_to_kit", { p_brand_kit_id: kitId, p_month: MONTH, p_archetype: live[k] }
        );
        if (error) throw new Error(`assign_topic_to_kit: ${error.message}`);
        if (!topicId) {
          live.splice(k, 1);
          continue;
        }
        const { data: topic } = await db
          .from("content_topics").select("id, archetype_key, intent, title, hook").eq("id", topicId).single();
        if (!topic) {
          live.splice(k, 1);
          continue;
        }
        if (accept(topic as Topic, family)) taken += 1;
        else if (live[k] === "practitioner_card") {
          // Son plafond est atteint : elle sort de la ronde plutôt que de la
          // faire tourner à vide jusqu'à épuiser la banque.
          live.splice(k, 1);
          continue;
        }
        k += 1;
      }
    }
    if (taken < perFamily) shortfall.push(`${family}: ${taken} of ${perFamily} (the bank had no more)`);
  }

  /*
   * ── ⚠ CE QUI MANQUE DANS UNE FAMILLE EST PRIS AILLEURS ────────────────
   *
   * Mesuré le 2026-09-21 : le second compte de test n'a pu tirer que 28
   * candidats sur 36, parce que l'anti-collision lui refuse tout ce que la
   * première praticienne a pris dans les 90 jours — même État, même modalité,
   * utilisatrice différente. C'est la fenêtre qui fait son travail, et c'est
   * exactement le scénario que §10.8 du rapport d'implémentation décrit.
   *
   * Un mélange visé n'est pas un mélange garanti : mieux vaut trente posts
   * dont le mélange penche que vingt-deux posts bien répartis. Le rapport
   * publie le mélange obtenu, jamais celui qui était visé.
   */
  while (candidates.length < CANDIDATES) {
    const { data: topicId, error } = await (db.rpc as unknown as (
      n: string, a: Record<string, unknown>
    ) => Promise<{ data: string | null; error: { message: string } | null }>)(
      "assign_topic_to_kit", { p_brand_kit_id: kitId, p_month: MONTH }
    );
    if (error) throw new Error(`assign_topic_to_kit: ${error.message}`);
    if (!topicId) break;
    const { data: topic } = await db
      .from("content_topics").select("id, archetype_key, intent, title, hook").eq("id", topicId).single();
    if (!topic) break;
    const family =
      Object.entries(FAMILIES).find(([, keys]) => keys.includes(topic.archetype_key))?.[0] ?? "varied";
    accept(topic as Topic, family);
  }

  /*
   * ── ⚠ EN ALTERNANCE, PAS PAR PAQUETS ──────────────────────────────────
   *
   * Les candidats sont tirés famille par famille, ce qui est commode pour le
   * tirage et catastrophique pour l'écriture : si la génération s'arrête tôt —
   * quota atteint, plafond de dépense, panne — les premiers écrits sont tous
   * de la même famille. Mesuré : un arrêt à 11 posts a rendu 11 cartes à une
   * phrase et zéro diagramme.
   *
   * Alterner met le mélange à l'abri de l'arrêt : les onze premiers posts
   * d'un mois interrompu ressemblent au mois entier.
   */
  const byFamily = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const list = byFamily.get(candidate.family) ?? [];
    list.push(candidate);
    byFamily.set(candidate.family, list);
  }
  const interleaved: Candidate[] = [];
  for (let round = 0; interleaved.length < candidates.length; round += 1) {
    for (const family of Object.keys(FAMILIES)) {
      const item = byFamily.get(family)?.[round];
      if (item) interleaved.push(item);
    }
    if (round > candidates.length) break;
  }
  candidates.length = 0;
  candidates.push(...interleaved);

  console.error(`▸ ${candidates.length} candidates drawn for ${WANTED} posts`);

  /* ── L'écriture ────────────────────────────────────────────────────── */
  const checkinLine = [checkin?.sessions_theme, checkin?.happening].filter(Boolean).join(" ");
  const asRequest = (c: Candidate): TopicRequest => ({
    topicId: c.topic.id, archetypeKey: c.topic.archetype_key,
    title: c.topic.title, hook: c.topic.hook, intent: c.topic.intent, checkin: checkinLine,
  });

  const funnel = {
    candidates: candidates.length,
    generated: 0,
    conformantFirstCall: 0,
    repaired: 0,
    refusedAfterRepair: 0,
    quotaRefusals: 0,
  };
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const repairUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  /*
   * ⚠ LE JUGE DE COMPLÉTUDE EST UN APPEL PAYANT, DONC IL A SA LIGNE. Un appel
   * qui ne figure dans aucun compteur est un appel qu'on croit gratuit — c'est
   * la classe de défauts de F18 à F25, et elle ne recommence pas ici.
   */
  const judgeUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const reviseUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const failures: Array<{ topic: string; kind: string; because: string }> = [];

  /*
   * ⚠ UN SEUL CHEMIN VERS LE LIVRE, ET C'EST `credits`. Ces deux helpers ne
   * refont pas l'appel RPC : ils délèguent au port défini en tête, pour qu'il
   * n'existe pas deux façons de réserver un crédit — c'était le cas, et l'une
   * des deux n'était branchée que sur le chemin synchrone (F25).
   */
  async function reserve(reason: string): Promise<string | null> {
    const id = await credits.reserve({ userId, kind: "post_generation", reason });
    if (!id) { funnel.quotaRefusals += 1; return null; }
    return id;
  }

  /** Règle : succès (le crédit est consommé) ou release AVEC son coût. */
  async function settle(reservationId: string | null, costUsd: number, succeeded: boolean) {
    if (!reservationId) return;
    await credits.settle(reservationId, costUsd, succeeded);
  }

  /** Les candidats retenus, dans l'ordre où ils se sont avérés utilisables. */
/*
 * ⚠ ON EN GÉNÈRE PLUS QUE TRENTE, ET C'EST CE QUI REND LA CORRECTION
 * POSSIBLE. Les contrôles de mois peuvent refuser un post — titre en double,
 * archétype trop représenté, champ qui recopie le titre — et un pipeline sans
 * remplaçant n'a alors que deux réponses : livrer quand même, ou livrer
 * vingt-neuf posts. Six de rab coûtent un cinquième du mois et donnent au
 * sélecteur de quoi échanger.
 */
const SPARE_POOL = 6;

  /*
   * ── ⚠ LA CARTE PRATICIENNE NE PASSE PAR AUCUN MODÈLE ──────────────────
   *
   * Ses lignes viennent du brief. L'appeler coûterait un appel pour rien —
   * et c'est exactement l'appel dont « Rowan Mercier Therapy » est sortie.
   *
   * ⚠ CE HELPER EXISTE PARCE QUE LA RÈGLE N'ÉTAIT ÉCRITE QUE SUR UN CHEMIN.
   * Le chemin synchrone l'appliquait ; le chemin Batch envoyait la carte au
   * modèle comme les autres. Tant que la banque n'avait AUCUNE carte
   * praticienne libre, le tirage n'en sortait jamais et rien ne le montrait :
   * le premier mois tiré sur une banque remplie est mort sur
   * « no shape written for practitioner_card ». Une règle qui ne vit que sur
   * une branche est une règle qu'on croit avoir.
   */
  const fromBrief = (candidate: Candidate) => ({
    topicId: candidate.topic.id, ok: true,
    payload: practitionerPayload,
    cardLine: clampCardLine(candidate.topic.title),
    caption: candidate.topic.hook ?? "",
    altText: (practitionerPayload?.lines ?? []).join(". "),
    rationale: "Assembled from the brief, not written.",
    usage: ZERO(),
  }) as never;

  const writtenByModel = (candidate: Candidate) =>
    candidate.topic.archetype_key !== "practitioner_card";

  const usable: Candidate[] = [];

  /*
   * ⚠ LE JOURNAL S'OUVRE AVANT LE PREMIER APPEL PAYANT. S'il porte déjà des
   * résultats, ils ont été payés lors d'un passage précédent : on les reprend
   * au lieu de les racheter.
   */
  let journal = loadJournal(MONTH, arg("email") ?? "default");
  const resumed = Object.keys(journal.entries).length;
  if (resumed > 0) console.error(`▸ journal : ${resumed} résultats déjà payés repris`);

  /*
   * ── ⚠ LA PHASE DE CANDIDATURE EST RÉSERVÉE AVANT, SOLDÉE APRÈS ────────
   *
   * Un lot Batch est facturé À LA SOUMISSION : la réservation doit précéder
   * `batches.create`, sinon elle réserve pour une dépense déjà faite. Elle est
   * prise pour la PHASE entière plutôt que par appel — un lot est un acte
   * payant, pas soixante-douze — et soldée au coût réel quand les réponses
   * sont là.
   *
   * En `overhead` : ces appels coûtent et ne prennent aucun crédit. Le quota
   * se tient plus bas, un crédit par post ÉCRIT.
   */
  /*
   * ── ⚠ UN TIRAGE VIDE EST UN REFUS, PAS UNE ERREUR 400 ────────────────
   *
   * Mesuré le 2026-09-24 : sur dix essais lancés en parallèle, les DEUX
   * derniers ont tiré zéro candidat — la banque était prise par les huit
   * premiers, et la fenêtre anti-collision retire à chaque praticienne ce que
   * les autres du même segment viennent d'assigner. Le script est alors mort
   * sur « requests: List should have at least 1 item », une erreur du
   * fournisseur, sans rapport, sans coût et sans motif lisible.
   *
   * C'est un refus ordinaire — le mois ne peut pas être composé — et il doit
   * se lire comme les autres.
   */
  if (candidates.length === 0) {
    console.log(JSON.stringify({
      step: "month", refused: true, monthId: null,
      prepared: 0, wanted: WANTED, bench: -WANTED, costUsd: 0,
      findings: [{
        check: "month.short",
        detail: `0 candidat tiré pour ${WANTED} promis — la banque n'avait plus rien de tirable pour ce segment`,
      }],
      dropped: [],
    }, null, 2));
    throw new Error("le mois ne passe pas ses contrôles : month.short");
  }

  const phaseReservation = await credits.reserve({
    userId, kind: "overhead", reason: `month ${MONTH}: candidate generation`,
  });

  if (useBatch) {
    /*
     * ⚠ UN LOT DÉJÀ SOUMIS SE RATTACHE, IL NE SE RE-SOUMET PAS. Le lot est
     * facturé à la soumission : si un passage précédent l'a créé puis est
     * mort pendant les vingt-cinq minutes d'attente, re-soumettre paierait
     * une seconde fois le même travail. L'identifiant est dans le journal.
     */
    /*
     * ⚠ LE LOT NE PORTE QUE CE QUE LE MODÈLE ÉCRIT. Les cartes praticiennes
     * sont remplies ici, sans appel : les envoyer coûterait un appel chacune
     * et rouvrirait le chemin de F16.
     */
    const asked = candidates.filter(writtenByModel);
    for (const candidate of candidates) {
      if (writtenByModel(candidate)) continue;
      // ⚠ Elle n'appelle aucun modèle : rien à réserver, rien à facturer tant
      // qu'elle n'est pas livrée. Son crédit se prend plus bas, à l'écriture.
      candidate.reservationId = null;
      candidate.result = fromBrief(candidate);
      funnel.generated += 1;
      if (await settleCandidate(candidate)) usable.push(candidate);
    }

    /*
     * ── ⚠ LA SUR-GÉNÉRATION EST UN FRAIS GÉNÉRAL, PAS UN POST ACHETÉ ────
     *
     * Elle réservait un crédit `post_generation` par candidat. Mesuré : sur
     * soixante-douze candidats, le lot n'en portait que VINGT-NEUF — le quota
     * accorde trente posts par mois, donc quarante-deux réservations étaient
     * refusées d'entrée, et le banc ne pouvait pas exister.
     *
     * Le raisonnement était faux, pas le quota. La praticienne a acheté
     * TRENTE POSTS ; qu'il en faille soixante-douze pour en obtenir trente
     * conformes est le coût de la qualité, et c'est le nôtre. Les appels de
     * candidature entrent donc en `overhead` : ils coûtent, ils ne prennent
     * aucun crédit.
     *
     * Le quota reste tenu, et au bon endroit — sur ce qui est LIVRÉ, plus bas,
     * une réservation par post écrit.
     */
    for (const candidate of asked) {
      candidate.reservationId = null;
    }

    const requests = asked.map(asRequest);
    const built = buildBatchRequests(brand, requests);
    let batch;
    if (journal.batchId) {
      /*
       * ── ⚠ ON REPREND LE LOT ET SES SUJETS, PAS LE LOT SEUL ────────────
       *
       * Rencontré en vrai le 2026-09-23 : une reprise a rattaché le bon lot
       * — déjà payé — puis a refait son tirage. Les deux ensembles se sont
       * trouvés identiques et le mois est passé, parce que
       * `next_topic_for_kit` trie par `created_at desc, id` : deux tirages
       * consécutifs sur la même banque rendent la même chose.
       *
       * ⚠ C'EST UNE COÏNCIDENCE D'ORDONNANCEMENT, PAS UNE GARANTIE. Un sujet
       * ajouté, expiré, ou pris par une autre praticienne entre les deux, et
       * la reprise aurait payé un lot dont elle ne savait plus lire les
       * réponses. Les sujets du lot font foi ; le tirage frais est rendu.
       */
      const ofBatch = new Set(journal.topicIds);
      if (ofBatch.size > 0) {
        const stale = candidates.filter((c) => !ofBatch.has(c.topic.id)).map((c) => c.topic.id);
        if (stale.length > 0) {
          await untypedTable(db, "topic_assignments")
            .delete().eq("brand_kit_id", kitId).in("topic_id", stale);
          console.error(`▸ reprise : ${stale.length} sujets du tirage frais rendus`);
        }
        const missing = journal.topicIds.filter((id) => !candidates.some((c) => c.topic.id === id));
        if (missing.length > 0) {
          throw new Error(
            `reprise impossible : ${missing.length} sujets du lot ${journal.batchId} ne sont plus tirables. ` +
            `Effacer .eklio-journal/ abandonne ce lot déjà payé — c'est une décision, pas un nettoyage.`
          );
        }
      }
      console.error(`▸ reprise du lot ${journal.batchId}`);
      batch = await client.messages.batches.retrieve(journal.batchId);
    } else {
      batch = await client.messages.batches.create({ requests: built });
      // ⚠ ÉCRIT AVANT D'ATTENDRE. C'est la seule fenêtre où ça change quelque
      // chose — et AVEC ses sujets : un identifiant sans sa liste est un lot
      // payé dont une reprise ne sait plus lire les réponses.
      journal = rememberBatch(journal, batch.id, asked.map((c) => c.topic.id));
      console.error(`▸ batch ${batch.id} · ${requests.length} candidates`);
    }

    let status = batch;
    while (status.processing_status !== "ended") {
      await new Promise((r) => setTimeout(r, 15000));
      status = await client.messages.batches.retrieve(batch.id);
      console.error(`  … ${status.processing_status} ${JSON.stringify(status.request_counts)}`);
    }

    /*
     * ⚠ CHAQUE RÉSULTAT EST ÉCRIT DÈS QU'IL ARRIVE. Le flux rendait tout en
     * mémoire avant qu'une seule ligne ne soit persistée : une panne à la
     * dernière réponse jetait les trente précédentes, toutes payées.
     */
    const entries: Array<{ custom_id: string; result: { type: string; message?: Anthropic.Message } }> = [];
    const byCustom = new Map(built.map((b, i) => [b.custom_id, asked[i]]));
    for await (const entry of await client.messages.batches.results(batch.id)) {
      entries.push(entry as never);
      const candidate = byCustom.get((entry as { custom_id: string }).custom_id);
      const message = (entry as { result?: { message?: Anthropic.Message } }).result?.message;
      if (candidate && message) {
        journal = rememberResult(journal, candidate.topic.id, {
          result: null,
          usage: {
            input: message.usage.input_tokens,
            output: message.usage.output_tokens,
            cacheRead: message.usage.cache_read_input_tokens ?? 0,
            cacheWrite: message.usage.cache_creation_input_tokens ?? 0,
          },
          settled: false,
        });
      }
    }
    const byTopic = new Map(asked.map((c) => [c.topic.id, c.topic.archetype_key]));
    for (const result of collectCopy(entries, byTopic)) {
      const candidate = asked.find((c) => c.topic.id === result.topicId);
      if (candidate) candidate.result = result;
    }
    funnel.generated = candidates.filter((c) => c.result).length;
    for (const candidate of asked) {
      if (candidate.result?.usage) candidate.usage = candidate.result.usage;
      if (usable.length >= WANTED + SPARE_POOL) break;
      if (await settleCandidate(candidate)) {
        usable.push(candidate);
      } else {
        await settle(candidate.reservationId, batchCostUsd([candidate.usage]), false);
        candidate.reservationId = null;
      }
    }
    for (const u of asked.map((c) => c.result?.usage).filter(Boolean)) {
      usage.input += u!.input; usage.output += u!.output;
      usage.cacheRead += u!.cacheRead; usage.cacheWrite += u!.cacheWrite;
    }
  } else {
    /*
     * ⚠ SÉQUENTIEL, ET C'EST CE QUI REND LE CACHE UTILE. Le préfixe d'un
     * archétype est identique d'un candidat au suivant ; les envoyer l'un
     * après l'autre laisse le cache se remplir puis servir. En parallèle, les
     * premiers partent tous avant que le premier soit revenu, et chacun paie
     * l'écriture du cache.
     */
    for (const candidate of candidates) {
      if (usable.length >= WANTED + SPARE_POOL) break;

      /*
       * ── ⚠ LE QUOTA SE TIENT SUR CE QUI EST LIVRÉ, PAS SUR CE QU'ON TENTE ─
       *
       * Il était réservé ici, un crédit par candidat. Mesuré sur le chemin
       * Batch, où la règle est la même : sur soixante-douze candidats, vingt-
       * neuf seulement passaient — trente crédits par mois, donc quarante-deux
       * refus d'entrée, et aucun banc possible.
       *
       * La praticienne a acheté TRENTE POSTS ; qu'il en faille soixante-douze
       * pour en obtenir trente conformes est le coût de la qualité, et c'est
       * le nôtre. Les candidatures sont donc des frais généraux, et le crédit
       * se prend à l'écriture.
       */
      candidate.reservationId = null;

      /*
       * ── ⚠ LA CARTE PRATICIENNE NE PASSE PAS PAR LE MODÈLE ──────────────
       *
       * Ses lignes sont déjà assemblées depuis le brief. L'appeler ici ne
       * coûterait pas seulement un appel pour rien : c'est exactement
       * l'appel qui a fabriqué « Rowan Mercier Therapy ». On garde la
       * légende et le texte alternatif, qui eux sont du contenu — mais le
       * payload, jamais.
       */
      if (!writtenByModel(candidate)) {
        candidate.result = fromBrief(candidate);
        funnel.generated += 1;
        funnel.conformantFirstCall += 1;
        if (await settleCandidate(candidate)) usable.push(candidate);
        continue;
      }

      /*
       * ⚠ UN RÉSULTAT DÉJÀ PAYÉ NE SE RACHÈTE PAS. Le journal porte la sortie
       * du modèle et le fait qu'un crédit ait été soldé pour elle ; une
       * reprise saute l'appel ET le règlement, sinon le second passage
       * facturerait un crédit de plus pour le même post.
       */
      const already = journal.entries[candidate.topic.id];
      if (already?.result) {
        candidate.result = already.result as typeof candidate.result;
        candidate.usage = already.usage;
        funnel.generated += 1;
        if (already.settled) {
          usable.push(candidate);
        } else if (await settleCandidate(candidate)) {
          journal = rememberResult(journal, candidate.topic.id, { ...already, settled: true });
          usable.push(candidate);
        }
        continue;
      }

      const request = asRequest(candidate);
      const message = await client.messages.create({
        model: massCopyModel(),
        max_tokens: 2000,
        system: cachedPrefix(brand, candidate.topic.archetype_key),
        output_config: { effort: copyEffort() },
        messages: [{ role: "user", content: variablePart(request) }],
      });
      funnel.generated += 1;
      usage.input += message.usage.input_tokens;
      usage.output += message.usage.output_tokens;
      usage.cacheRead += message.usage.cache_read_input_tokens ?? 0;
      usage.cacheWrite += message.usage.cache_creation_input_tokens ?? 0;

      const text = message.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
      candidate.result = { ...validateCopy(candidate.topic.archetype_key, text), topicId: candidate.topic.id };

      /*
       * ⚠ ÉCRIT ICI, PAS À LA FIN DE LA BOUCLE. L'appel est payé : à partir de
       * cet instant, une panne ne doit plus pouvoir effacer ce qu'il a rendu.
       */
      journal = rememberResult(journal, candidate.topic.id, {
        result: candidate.result,
        usage: {
          input: message.usage.input_tokens,
          output: message.usage.output_tokens,
          cacheRead: message.usage.cache_read_input_tokens ?? 0,
          cacheWrite: message.usage.cache_creation_input_tokens ?? 0,
        },
        settled: false,
      });

      /*
       * ⚠ LE VERDICT TOMBE ICI, ET LE CRÉDIT AVEC. Un candidat refusé rend sa
       * réservation tout de suite — avec son coût — et la place se libère
       * pour l'essai suivant. C'est ce qui rend la sur-génération possible
       * sous un quota de trente.
       */
      candidate.usage = {
        input: message.usage.input_tokens, output: message.usage.output_tokens,
        cacheRead: message.usage.cache_read_input_tokens ?? 0,
        cacheWrite: message.usage.cache_creation_input_tokens ?? 0,
      };
      const cost = syncCostUsd(candidate.usage);
      if (await settleCandidate(candidate)) {
        // Le crédit est réglé : le journal le dit, pour qu'une reprise ne le règle pas deux fois.
        const entry = journal.entries[candidate.topic.id];
        if (entry) journal = rememberResult(journal, candidate.topic.id, { ...entry, settled: true });
        usable.push(candidate);
      } else {
        await settle(candidate.reservationId, cost, false);
        candidate.reservationId = null;
      }
    }
  }

  /* ── La réparation, champ par champ ────────────────────────────────── */

  /**
   * Rend `true` quand le candidat est utilisable après réparation.
   *
   * ⚠ APPELÉE DANS LA BOUCLE, PAS APRÈS. Tant que la réparation tournait en
   * seconde passe, la réservation d'un candidat raté restait ouverte jusqu'à
   * la fin ; trente essais suffisaient à remplir un quota de trente, échecs
   * compris, et le trente-et-unième était refusé. Mesuré : 26 posts écrits,
   * 4 crédits immobilisés par des essais qui avaient déjà échoué.
   */
  async function settleCandidate(candidate: Candidate): Promise<boolean> {
    const result = candidate.result;
    if (!result) return false;
    if (result.ok) { funnel.conformantFirstCall += 1; return true; }

    if (result.reason !== "over_budget" || !result.budget?.length || result.payload === undefined) {
      failures.push({
        topic: candidate.topic.title, kind: result.reason === "over_budget" ? "word budget" : "schema",
        because: result.reason ?? "unknown",
      });
      return false;
    }

    /*
     * ⚠ LA RÉPARATION EST UN APPEL PAYANT DE PLUS, ET ELLE NE FACTURE PAS.
     * Le crédit du post a déjà été réservé ; réparer son payload ne doit pas
     * en prendre un second. Mais la dépense, elle, entre au livre.
     */
    const repair = (await overhead(`repair ${candidate.topic.archetype_key}`, async () => {
      const value = await repairPayload(
        (params) => client.messages.create(params),
        candidate.topic.archetype_key,
        result.payload
      );
      return { value, usage: value.usage };
    })).value;
    repairUsage.input += repair.usage.input; repairUsage.output += repair.usage.output;
    repairUsage.cacheRead += repair.usage.cacheRead; repairUsage.cacheWrite += repair.usage.cacheWrite;

    if (repair.ok) {
      funnel.repaired += 1;
      candidate.result = { ...result, ok: true, payload: repair.payload, reason: undefined, budget: undefined };
      return true;
    }
    funnel.refusedAfterRepair += 1;
    failures.push({
      topic: candidate.topic.title, kind: "word budget",
      because: repair.remaining.map((b) => `${b.path} said ${b.said}, allowed ${b.allowed}`).join("; "),
    });
    return false;
  }

  
/*
 * ── LA CORRECTION : ÉCHANGER, PAS RELÂCHER ──────────────────────────────
 *
 * Quand un contrôle refuse un post — titre en double, champ qui recopie le
 * titre, ligne suspendue, archétype trop représenté — la réponse n'est jamais
 * d'abaisser le seuil. C'est de prendre un REMPLAÇANT dans la réserve
 * sur-générée, et de reposer la question.
 *
 * ⚠ LA BOUCLE EST BORNÉE PAR LA RÉSERVE, PAS PAR UN COMPTEUR ARBITRAIRE.
 * Chaque tour retire exactement un post et en essaie un autre ; s'il n'y a
 * plus de remplaçant, la boucle s'arrête et le mois est refusé. Un « au bout
 * de N essais, on livre quand même » remettrait sur la table ce que ces
 * contrôles existent pour empêcher.
 */
type Deliverable<T> = { chosen: T[]; remaining: Finding[]; dropped: Array<{ title: string; why: string }> };

function selectDeliverable<
  T extends { cardLine: string; composeArchetype: string; payload: unknown; svg: string | null;
              eyebrow: string; candidate: { topic: { title: string } } }
>(
  prepared: T[], direction: DirectionPalette, wanted: number, practiceName: string,
  allowList: string[],
  /**
   * Le catalogue des intentions, pour le contrôle de surtitre.
   *
   * ⚠ IL VIENT DE LA BASE. Un contrôle qui tirerait la liste des libellés
   * des cartes qu'il surveille les autoriserait toutes.
   */
  intentCatalogue: Array<{ id: string; label: string }>,
  /** Les modalités du brief, pour le contrôle de sigle (F26). */
  modalities: string[],
  /**
   * Ce qu'un juge a dit des lignes que le lexique n'a pas su trancher.
   *
   * ⚠ CALCULÉ UNE FOIS, AVANT LA SÉLECTION. Le sélecteur boucle : demander le
   * verdict à chaque tour paierait un appel par échange, et l'ensemble des
   * lignes ne change pas — seul le sous-ensemble retenu change.
   */
  completeness: CompletenessVerdicts
): Deliverable<T> {
  const asPost = (p: T) => ({
    archetype: p.composeArchetype,
    title: p.candidate.topic.title,
    cardLine: p.cardLine,
    payload: p.payload,
    svg: p.svg ?? undefined,
    eyebrow: p.eyebrow,
  });

  let chosen = prepared.slice(0, wanted);
  const bench = prepared.slice(wanted);
  const dropped: Array<{ title: string; why: string }> = [];

  for (;;) {
    const findings = checkMonth({
      posts: chosen.map(asPost), direction, practiceName, identityAllowList: allowList,
      modalities, completeness, eyebrowCatalogue: intentCatalogue,
      /*
       * ⚠ LE NOMBRE EST UN CONTRÔLE, PAS UNE LIGNE DE RAPPORT. Un mois de
       * quinze posts est sorti « sans constat » le 2026-09-23 : le rapport
       * disait bien « the bank had no more », mais rien ne refusait le mois.
       * Aucun échange ne peut le réparer — s'il manque des posts, le banc est
       * vide par construction — donc le constat sort du premier tour et le
       * mois est refusé, ce qui est le bon verdict.
       */
      wanted,
    });
    if (findings.length === 0) return { chosen, remaining: [], dropped };
    if (bench.length === 0) return { chosen, remaining: findings, dropped };

    /*
     * Quel post retirer : celui que le constat désigne. Un constat de mélange
     * ne nomme pas un post mais un ARCHÉTYPE — on retire alors l'un des siens,
     * le dernier, pour que l'échange change vraiment les proportions.
     */
    const finding = findings[0];
    let victim = -1;

    /*
     * ── ⚠ UN CONSTAT QUE LE BANC NE PEUT PAS RÉPARER ARRÊTE LA BOUCLE ───
     *
     * `mix.carousel` dit qu'il MANQUE un format, pas qu'un post est de trop.
     * Le traiter comme les autres constats de mélange ferait retirer le post
     * le plus représenté et le remplacer par le premier du banc — qui n'est
     * pas un carrousel — puis recommencer, jusqu'à vider le banc en
     * dégradant le mois à chaque tour.
     *
     * S'il reste un carrousel au banc, on échange CONTRE lui. Sinon, le mois
     * est refusé tout de suite : c'est le bon verdict, et il coûte zéro tour.
     */
    if (finding.check === "mix.carousel") {
      const spare = bench.findIndex((p) => p.composeArchetype === "carousel");
      if (spare === -1) return { chosen, remaining: findings, dropped };
      const counts = new Map<string, number>();
      for (const p of chosen) counts.set(p.composeArchetype, (counts.get(p.composeArchetype) ?? 0) + 1);
      const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const out = chosen.map((p) => p.composeArchetype).lastIndexOf(dominant ?? "");
      if (out === -1) return { chosen, remaining: findings, dropped };
      dropped.push({ title: chosen[out].cardLine, why: `${finding.check} — ${finding.detail}` });
      const [replacement] = bench.splice(spare, 1);
      chosen = [...chosen.slice(0, out), ...chosen.slice(out + 1), replacement];
      continue;
    }

    /*
     * ── ⚠ UN PLANCHER DIT QU'IL MANQUE, PAS QU'IL Y EN A DE TROP ────────
     *
     * Même piège que `mix.carousel`, et pour la même raison : traiter un
     * plancher comme les autres constats de mélange ferait retirer le post le
     * plus représenté pour le remplacer par le premier du banc — qui n'est pas
     * de la famille qui manque — puis recommencer, en dégradant le mois à
     * chaque tour jusqu'à vider le banc.
     *
     * On échange donc CONTRE un post de la famille affamée, s'il en reste un.
     * Sinon le mois est refusé tout de suite, ce qui est le bon verdict et
     * coûte zéro tour.
     */
    if (finding.check.startsWith("mix.floor.")) {
      const starved = finding.check.slice("mix.floor.".length);
      const spare = bench.findIndex((p) => familyOf(p.composeArchetype) === starved);
      if (spare === -1) return { chosen, remaining: findings, dropped };
      const counts = new Map<string, number>();
      for (const p of chosen) {
        const family = familyOf(p.composeArchetype);
        if (family) counts.set(family, (counts.get(family) ?? 0) + 1);
      }
      const fattest = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const out = chosen.map((p) => familyOf(p.composeArchetype)).lastIndexOf(fattest ?? "");
      if (out === -1) return { chosen, remaining: findings, dropped };
      dropped.push({ title: chosen[out].cardLine, why: `${finding.check} — ${finding.detail}` });
      const [replacement] = bench.splice(spare, 1);
      chosen = [...chosen.slice(0, out), ...chosen.slice(out + 1), replacement];
      continue;
    }

    if (finding.check.startsWith("mix.")) {
      const counts = new Map<string, number>();
      for (const p of chosen) counts.set(p.composeArchetype, (counts.get(p.composeArchetype) ?? 0) + 1);
      const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      victim = chosen.map((p) => p.composeArchetype).lastIndexOf(dominant ?? "");
    } else {
      victim = chosen.findIndex((p) => finding.detail.includes(p.cardLine));
      if (victim === -1) victim = chosen.length - 1;
    }
    if (victim === -1) return { chosen, remaining: findings, dropped };

    dropped.push({ title: chosen[victim].cardLine, why: `${finding.check} — ${finding.detail}` });
    const replacement = bench.shift()!;
    chosen = [...chosen.slice(0, victim), ...chosen.slice(victim + 1), replacement];
  }
}

/* ── Le mois, puis les posts ───────────────────────────────────────── */
  const prepared = usable;

  const { data: monthRow, error: monthError } = await db
    .from("content_months").insert({
      brand_kit_id: kitId, month: MONTH, themes: themes.themes, status: "proposed",
      theme_source: themes.source, theme_source_text: themes.sourceText,
    }).select("id").single();
  if (monthError || !monthRow) throw new Error(`could not write the month: ${monthError?.message}`);

  /*
   * ── ⚠ LA PASSE DE RÉVISION, AVANT LA COMPOSITION ──────────────────────
   *
   * Elle ne juge pas la conformité — vingt-trois contrôles le font, et mieux :
   * ils comptent des caractères, des mots, des archétypes. Elle relit les
   * candidats ENSEMBLE, ce qu'aucun contrôle par post ne peut faire, et
   * réécrit ce qu'un lecteur verrait : une phrase qui ne dit rien, un libellé
   * qui revient sur sept cartes, deux posts sur la même idée.
   *
   * ⚠ AVANT LA COMPOSITION, PAS APRÈS. Une réécriture appliquée après aurait
   * laissé sur la carte le texte d'avant : le SVG est dessiné une fois, et
   * c'est lui qu'on publie.
   *
   * ⚠ ET C'EST UN FRAIS GÉNÉRAL. La praticienne a acheté trente posts ; qu'il
   * faille les relire est notre affaire, pas un post de moins pour elle.
   */
  const revision = (await overhead("revision pass", async () => {
    const value = await reviseMonth(client, prepared.map((c) => ({
      archetype: c.topic.archetype_key,
      cardLine: c.result!.cardLine ?? c.topic.title,
      payload: c.result!.payload,
      caption: c.result!.caption ?? "",
      altText: c.result!.altText ?? "",
    })));
    return { value, usage: { ...value.usage, cacheRead: 0, cacheWrite: 0 } };
  })).value;
  reviseUsage.input += revision.usage.input;
  reviseUsage.output += revision.usage.output;
  for (const r of revision.revisions) {
    const result = prepared[r.index].result!;
    result.cardLine = r.cardLine;
    result.payload = r.payload;
  }
  console.error(
    revisionOn()
      ? `▸ révision : ${revision.revisions.length} réécrits, ${revision.refused.length} écartés sur ${prepared.length}`
      : "▸ révision : ÉTEINTE (CONTENT_REVISION=off)"
  );
  for (const r of revision.revisions) console.error(`    #${r.index} — ${r.why}`);
  for (const r of revision.refused) console.error(`    #${r.index} ÉCARTÉ — ${r.because}`);

  const registers = preferences.accepted_registers as ContentRegister[];
  const dates = scheduleDates(MONTH.slice(0, 7), [1, 2, 3, 4, 5, 6, 7], WANTED);
  const fallbacks: Array<{ topic: string; from: string; to: string; steps: string }> = [];
  const ethicsFlags: Array<{ topic: string; rule: string; excerpt: string }> = [];
  const checkinLeakFlags: Array<{ topic: string; quoted: string[] }> = [];
  let written = 0;
  /** Les posts entrés en base : leur crédit attend le verdict du mois. */
  const delivered: Candidate[] = [];
  let previousArchetype: Parameters<typeof chooseArchetype>[1] = null;

  /*
   * ── ON PRÉPARE TOUT, ON CONTRÔLE, PUIS ON ÉCRIT ──────────────────────
   *
   * ⚠ L'ORDRE COMPTE. Écrire au fil de la boucle rendait les contrôles de mois
   * inapplicables : quand le trentième post révèle que l'archétype dominant
   * dépasse 30 %, les vingt-neuf premiers sont déjà en base. Rien n'est inséré
   * avant que `checkMonth` se taise.
   */
  type Prepared = {
    candidate: Candidate;
    cardLine: string;
    composeArchetype: string;
    payload: unknown;
    svg: string | null;
    /** La bande de surtitre, telle qu'elle a été composée. */
    eyebrow: string;
    register: ContentRegister;
    layout: Parameters<typeof chooseArchetype>[1];
    theme: string;
  };
  const readyPosts: Prepared[] = [];

  for (const [index, candidate] of prepared.entries()) {
    const result = candidate.result!;
    const register = registers[index % registers.length];
    const layout = chooseArchetype(register, previousArchetype);
    previousArchetype = layout;

    // ⚠ La majuscule est posée ici comme elle l'est sur l'écran de relecture :
    // par `capitaliseTitle`, qui ne touche pas à un mot portant déjà une
    // capitale. Les titres du mois précédent sortaient tout en minuscules.
    // ⚠ `clampCardLine`, PAS UN `slice(0, 34)`. Une seconde borne, à un autre
    // nombre, dans un autre fichier : celle-ci coupait en plein mot ce que
    // l'autre avait déjà coupé proprement.
    /*
     * ── ⚠ LA PONCTUATION SE NORMALISE ICI, AU SEUL POINT D'ASSEMBLAGE ───
     *
     * Elle l'était dans `validateCopy`, et vingt-sept apostrophes droites
     * sont quand même sorties sur huit essais gelés. Trois chemins la
     * contournaient :
     *
     *   * `result.cardLine ?? candidate.topic.title` — quand le modèle omet
     *     sa ligne, c'est le TITRE DE BANQUE qui sert, et il n'est jamais
     *     passé par là ;
     *   * la réparation, qui remplace le payload normalisé par le sien ;
     *   * `fromBrief`, dont les lignes viennent du brief.
     *
     * ⚠ NORMALISER À TROIS ENDROITS EN AURAIT LAISSÉ UN QUATRIÈME. Le point
     * d'assemblage est le seul par où tout passe.
     */
    const cardLine = typographicQuotes(
      capitaliseTitle(clampCardLine(result.cardLine ?? candidate.topic.title))
    );
    /*
     * ── ⚠ LA LIGNE DE CARTE ÉTAIT HORS DU SCAN DÉONTOLOGIQUE ────────────
     *
     * `scanned` valait `caption + altText + payload`. Le TITRE n'était lu par
     * aucune règle — et « Efficiency can become trauma », signée par une
     * clinicienne EMDR, est un titre (F26). Il entre dans le scan.
     */
    const scanned = [cardLine, result.caption, result.altText, JSON.stringify(result.payload)].join("\n");
    const violations = checkEthics(scanned).violations;
    for (const violation of violations) {
      ethicsFlags.push({ topic: candidate.topic.title, rule: violation.ruleId, excerpt: violation.excerpt.slice(0, 80) });
    }
    /*
     * ── ⚠ UNE VIOLATION DÉONTOLOGIQUE ÉCARTE LE POST, ELLE NE LE SIGNALE PAS
     *
     * `ethicsFlags` était une ligne de RAPPORT : le post partait quand même
     * en base. Un catalogue de règles qu'une clinicienne est tenue de
     * respecter, consulté puis ignoré, ne vaut pas mieux que pas de
     * catalogue — et c'est la classe de défauts de F18 à F25, appliquée cette
     * fois à de la déontologie plutôt qu'à un compteur.
     *
     * Le candidat est écarté comme un dépassement de budget : son crédit est
     * rendu, son sujet retourne à la banque, un remplaçant prend sa place.
     */
    if (violations.length > 0) {
      failures.push({
        topic: candidate.topic.title, kind: "ethics",
        because: violations.map((v) => `${v.ruleId}: ${v.excerpt.slice(0, 60)}`).join("; "),
      });
      await settle(candidate.reservationId, 0, false);
      continue;
    }

    /*
     * ⚠ CE QUE LE BILAN A DIT NE SE RECOPIE PAS SUR LA CARTE. « Oakland,
     * California » et « Evening slots opening October » sont sortis comme
     * libellés de diagramme le mois dernier : le bilan oriente le CHOIX des
     * sujets, il n'est pas du contenu de carte. Seule `practitioner_card` a le
     * droit de le citer, et `checkinLeaks` la nomme.
     */
    const leaks = checkinLeaks(candidate.topic.archetype_key, JSON.stringify(result.payload), {
      sessionsTheme: checkin?.sessions_theme,
      happening: checkin?.happening,
      location: briefLocation,
    });
    if (leaks.length > 0) {
      checkinLeakFlags.push({ topic: candidate.topic.title, quoted: leaks });
    }

    /*
     * ⚠ ON COMPOSE AVANT D'ÉCRIRE, et on enregistre la forme qui a vraiment
     * tenu. Écrire l'archétype demandé sur un post que le moteur a replié
     * donnerait une carte que l'écran de relecture ne saurait pas redessiner.
     */
    let composeArchetype = candidate.topic.archetype_key;
    let payload = result.payload;
    let composedSvg: string | null = null;
    /*
     * ⚠ CALCULÉ ICI, PAS DANS L'APPEL. La valeur composée est celle que le
     * contrôle doit lire : un contrôle qui relirait les ENTRÉES de
     * `eyebrowFor` ne verrait jamais « CORRECTAMYTH », qui est ce que la
     * clinicienne, elle, a vu.
     */
    const eyebrow = eyebrowFor(
      {
        angleLabel: intentLabels.get(candidate.topic.intent) ?? null,
        title: cardLine,
        theme: themes.themes[index % themes.themes.length],
      },
      practiceName
    );
    try {
      const composed = composeWithFallback({
        archetype: candidate.topic.archetype_key,
        payload: result.payload,
        palette: cardPalette(`${monthRow.id}-${index}`, direction.palette, false),
        /*
         * ⚠ LE THÈME EN CAPITALES N'EST PAS UN SURTITRE, ET C'ÉTAIT ÇA LA
         * LIGNE. Un thème dérivé est une PHRASE : les dix cartes d'un même
         * thème portaient les mêmes quatorze mots dans la bande mono. C'est
         * maintenant la règle partagée avec l'écran de relecture — une
         * étiquette d'un à quatre mots, tirée d'abord de ce qui est propre à
         * cette carte.
         */
        eyebrow,
        headline: cardLine,
        footer: practiceName,
      }, cardLine);
      composeArchetype = composed.archetype;
      payload = composed.payload;
      composedSvg = composed.kind === "carousel" ? composed.slides[0].svg : composed.result.svg;
      if (composed.steps.length > 0) {
        fallbacks.push({
          topic: candidate.topic.title, from: candidate.topic.archetype_key,
          to: composed.kind === "carousel" ? `carousel×${composed.slides.length}` : composed.archetype,
          steps: composed.steps.join("; "),
        });
      }
    } catch (error) {
      failures.push({
        topic: candidate.topic.title, kind: "engine",
        because: error instanceof Error ? error.message.slice(0, 140) : String(error),
      });
      await settle(candidate.reservationId, 0, false);
      continue;
    }

    readyPosts.push({
      candidate, cardLine, composeArchetype, payload: deepTypographic(payload), svg: composedSvg,
      eyebrow, register, layout, theme: themes.themes[index % themes.themes.length],
    });
  }

  /*
   * ⚠ LA PHASE EST SOLDÉE ICI, AU COÛT RÉEL, QU'ELLE AIT ABOUTI OU NON. Les
   * jetons ont été dépensés chez le fournisseur : ils doivent apparaître même
   * si le mois est refusé plus bas.
   */
  if (phaseReservation) {
    await credits.settle(
      phaseReservation,
      useBatch ? batchCostUsd([usage]) : syncCostUsd(usage),
      true
    );
  }

  /* ── Les contrôles de mois, et la correction ───────────────────────── */

  /*
   * ── ⚠ LE JUGE DE COMPLÉTUDE, UN APPEL POUR TOUT LE MOIS ───────────────
   *
   * Quatre titres du mois précédent se sont arrêtés avant leur sens, et un
   * seul était lexical : « When life changes without » finit sur une
   * préposition qui ne strande pas. Les trois autres — « The thing that works
   * costs », « High performance masks held », « Success masks an overdriven »
   * — finissent sur des mots ordinaires, et ce qui manque est ce qui vient
   * APRÈS. Aucune liste de mots ne le dit ; trois tours de faux positifs l'ont
   * établi.
   *
   * On demande donc, une fois, sur les seules lignes que le lexique n'a pas
   * tranchées. ⚠ Et un juge muet ne refuse rien : `judgeCompleteness` ne lève
   * jamais et rend un verdict vide en cas de panne.
   */
  const allWritten = writtenLinesIn(readyPosts.map((p) => ({
    archetype: p.composeArchetype, title: p.candidate.topic.title,
    cardLine: p.cardLine, payload: p.payload,
  })));
  const toJudge = undecidedIn(allWritten);
  const judged = (await overhead("completeness judge", async () => {
    const value = await judgeCompleteness(client, toJudge);
    return { value, usage: { ...value.usage, cacheRead: 0, cacheWrite: 0 } };
  })).value;
  judgeUsage.input += judged.usage.input;
  judgeUsage.output += judged.usage.output;
  console.error(`▸ complétude : ${toJudge.length} lignes indécises jugées, ${
    Object.values(judged.verdicts).filter((v) => v === false).length} refusées`);

  const selection = selectDeliverable(
    readyPosts, direction.palette as DirectionPalette, WANTED, practiceName, allowList,
    [...intentLabels].map(([id, label]) => ({ id, label })),
    facts.modalities, judged.verdicts
  );
  const succeeded = selection.chosen.map((p: Prepared) => p.candidate);

  for (const [index, post] of selection.chosen.entries()) {
    const { candidate } = post;
    const { error } = await db.from("content_items").insert({
      brand_kit_id: kitId, month_id: monthRow.id, topic_id: candidate.topic.id,
      theme: post.theme,
      register: post.register, archetype: post.layout ?? "statement", compose_archetype: post.composeArchetype,
      payload: post.payload as never, status: "proposed",
      title: post.cardLine, on_image_text: candidate.topic.hook,
      caption: candidate.result!.caption ?? "", alt_text: candidate.result!.altText ?? "",
      rationale: candidate.result!.rationale ?? "",
      scheduled_for: dates[index] ?? dates[dates.length - 1],
    });
    if (error) {
      failures.push({ topic: candidate.topic.title, kind: "database", because: error.message.slice(0, 160) });
      await settle(candidate.reservationId, 0, false);
      continue;
    }
    written += 1;
    /*
     * ── ⚠ LE CRÉDIT SE PREND ICI, UN PAR POST ÉCRIT ────────────────────
     *
     * C'est le seul endroit où le quota a un sens : la praticienne a acheté
     * trente POSTS, pas soixante-douze tentatives. Un refus de quota ici
     * arrête l'écriture — elle n'en a pas acheté plus — et le mois sortira
     * court, ce que `checkCount` refusera.
     */
    const reservationId = await reserve(`month ${MONTH}: ${candidate.topic.title.slice(0, 40)}`);
    if (!reservationId) {
      funnel.quotaRefusals += 1;
      failures.push({ topic: candidate.topic.title, kind: "quota", because: "quota_exhausted" });
      break;
    }
    candidate.reservationId = reservationId;

    /*
     * ── ⚠ ET IL SE CONSOMME À LA LIVRAISON, PAS À L'INSERTION ──────────
     *
     * Il était soldé à `true` ICI, dans la boucle d'écriture, donc AVANT le
     * verdict. Un mois refusé consommait ainsi ses trente crédits pour des
     * posts qui restent en `proposed` et que personne ne recevra jamais.
     *
     * ⚠ MESURÉ : LE DEUXIÈME ESSAI D'UN COMPTE N'A PU TIRER QUE 2 POSTS SUR
     * 72. Dix mois refusés, dix mois abandonnés — sujets rendus, posts
     * supprimés — et `credit_balances` disait encore `consumed = 29` sur 30.
     * En production, une praticienne dont le mois échoue ses contrôles
     * paierait deux fois pour en obtenir un, et après deux refus son mois ne
     * serait plus achetable du tout.
     *
     * ⚠ ET CE N'EST PAS UN REMBOURSEMENT. Le livre impose une seule issue par
     * réservation — un règlement OU une restitution, jamais les deux — et
     * cette contrainte est juste. La bonne réponse n'est pas de la contourner
     * mais de ne consommer qu'à la livraison, comme le journal n'efface qu'une
     * fois le mois en base. Même règle, même raison.
     */
    delivered.push(candidate);
  }

  /*
   * ⚠ LE JOURNAL S'EFFACE QUAND LE MOIS EST EN BASE, PAS AVANT. Tant que
   * `content_items` ne porte pas les trente posts, le travail payé n'existe
   * que là.
   */
  clearJournal(journal);

  // Les préparés non retenus n'ont rien publié : leur réservation se solde.
  for (const post of readyPosts) {
    if (!selection.chosen.includes(post)) await settle(post.candidate.reservationId, 0, false);
  }

  /*
   * ── ⚠ ON REND AVANT DE REFUSER, ET L'ORDRE EST LE DÉFAUT ──────────────
   *
   * Ce bloc était APRÈS le refus, donc après un `throw`. Un mois refusé
   * gardait alors pour quatre-vingt-dix jours les sujets sur-générés qu'il
   * n'avait pas publiés — environ vingt-quatre par essai — et leurs crédits
   * n'étaient jamais soldés.
   *
   * ⚠ CHAQUE ESSAI REFUSÉ RENDAIT DONC LE SUIVANT PLUS PAUVRE. C'est le
   * mécanisme de F13 vu de l'intérieur : la banque s'asséchait à mesure qu'on
   * réessayait, et le mois d'après sortait plus court — 23 posts, puis 16 —
   * sans que rien ne dise pourquoi. On cherchait le défaut dans le tirage ; il
   * était dans l'ordre de deux blocs.
   *
   * La restitution ne dépend pas du verdict : ce qui n'a pas été publié n'a
   * rien coûté à la praticienne, qu'on livre ou qu'on refuse.
   */
  /*
   * ── LES CANDIDATS NON RETENUS ─────────────────────────────────────────
   *
   * ⚠ LEUR SUJET RETOURNE À LA BANQUE. Un sujet tiré et non écrit n'a rien
   * coûté à personne et ne doit pas être perdu pour elle : la règle « jamais
   * deux fois » vaut sur ce qui a été PUBLIÉ, pas sur ce qui a été envisagé.
   *
   * ⚠ ET LEUR CRÉDIT REVIENT, AVEC LE COÛT ÉCRIT. Un appel refusé a dépensé
   * des jetons chez le fournisseur et ne doit rien à la praticienne.
   */
  const keptTopicIds = new Set(succeeded.map((c: Candidate) => c.topic.id));
  const discarded = candidates.filter((c) => !succeeded.includes(c));
  /*
   * ⚠ LES DOUBLONS ÉCARTÉS AU TIRAGE SONT RELÂCHÉS AVEC LE RESTE. Ils ne sont
   * jamais entrés dans `drawnIds` — `accept` les refuse avant — mais
   * `assign_topic_to_kit` les a bel et bien marqués assignés avant qu'on
   * lise leur titre. Sans cette ligne, chaque doublon refusé retirerait un
   * sujet de la banque pour 90 jours en échange de rien.
   */
  const released = [...releasedEarly, ...drawnIds.filter((id) => !keptTopicIds.has(id))];
  if (released.length > 0) {
    await untypedTable(db, "topic_assignments").delete().eq("brand_kit_id", kitId).in("topic_id", released);
  }
  for (const candidate of discarded) {
    await settle(candidate.reservationId, useBatch ? batchCostUsd([candidate.usage]) : syncCostUsd(candidate.usage), false);
  }

  /*
   * ⚠ UN MOIS QUI ÉCHOUE N'EST JAMAIS LIVRÉ. S'il reste un constat après la
   * correction, le mois reste en `proposed` et le script SORT EN ERREUR : la
   * preuve doit s'arrêter là plutôt que de produire une planche qu'on
   * commenterait comme si elle était bonne.
   */
  /*
   * ── ⚠ ET CE QUI A ÉTÉ ÉCRIT, PAS CE QUI A ÉTÉ CHOISI ──────────────────
   *
   * Mesuré le 2026-09-23 : un mois de **29 posts** est sorti sans refus.
   * `checkCount` (F21) avait bien vu trente — mais il regardait la SÉLECTION.
   * Entre la sélection et la base, un insert a échoué, `failures` a gagné une
   * ligne « database », et la boucle a continué. Personne ne recomptait après.
   *
   * ⚠ C'EST F21 UN CRAN PLUS LOIN : contrôler une grandeur en amont de
   * l'écriture ne dit rien de ce qui a été écrit. Le seul nombre qui compte
   * est celui des lignes en base.
   */
  /*
   * ⚠ CONTRE LA SÉLECTION, PAS CONTRE LA CIBLE. Un mois court parce que la
   * banque était vide est DÉJÀ signalé par `checkCount` ; le redire ici avec
   * « des insert(s) ont échoué » nommerait une cause fausse et enverrait
   * chercher le défaut du mauvais côté. Ce constat-ci ne parle que de ce qui
   * s'est perdu ENTRE la sélection et la base.
   */
  /*
   * ⚠ ET IL NE FAUT PAS NOMMER L'INSERT QUAND C'EST LA QUOTA QUI A ROMPU.
   * Mesuré : « 28 insert(s) ont échoué » sur un essai où AUCUN insert n'avait
   * été tenté — la boucle s'était arrêtée au deuxième post, faute de crédit,
   * et les vingt-huit suivants n'ont jamais existé. Le constat envoyait
   * chercher un défaut de base de données là où il y avait un compte à sec,
   * ce que le commentaire juste au-dessus interdit explicitement de faire.
   */
  const missing = selection.chosen.length - written;
  const why = funnel.quotaRefusals > 0
    ? `la quota s'est épuisée après ${written}`
    : `${missing} insert(s) ont échoué`;
  const shortOnWrite: Finding[] = written < selection.chosen.length
    ? [{
        check: "month.short",
        detail:
          `${written} posts écrits pour ${selection.chosen.length} retenus — ${why}`,
      }]
    : [];
  selection.remaining.push(...shortOnWrite);

  /*
   * ⚠ ET LE VERDICT DÉCIDE DES CRÉDITS. Livré : consommés, au coût réel.
   * Refusé : rendus, le coût écrit — les jetons ont bien été dépensés chez le
   * fournisseur, et ils ne doivent rien à la praticienne.
   */
  const monthPasses = selection.remaining.length === 0;
  for (const candidate of delivered) {
    await settle(
      candidate.reservationId,
      useBatch ? batchCostUsd([candidate.usage]) : syncCostUsd(candidate.usage),
      monthPasses
    );
  }

  if (selection.remaining.length > 0) {
    console.log(JSON.stringify({
      step: "month", refused: true, monthId: monthRow.id,
      // ⚠ La taille du banc est dans le rapport : sans elle, « aucun post
      // échangé » et « aucun remplaçant disponible » se ressemblent, et on
      // cherche le défaut dans le sélecteur au lieu de la sur-génération.
      prepared: readyPosts.length, wanted: WANTED, bench: readyPosts.length - WANTED,
      /*
       * ⚠ UN ESSAI REFUSÉ A COÛTÉ, ET IL LE DIT. Le coût n'était imprimé que
       * sur le chemin livré : un mois refusé sortait en erreur sans qu'on
       * sache ce qu'il avait dépensé, et compter les essais d'un pipeline
       * revient à compter ce que chacun coûte.
       */
      costUsd: Number(
        (
          (useBatch ? batchCostUsd([usage]) : syncCostUsd(usage)) +
          syncCostUsd(repairUsage) + syncCostUsd(judgeUsage) + syncCostUsd(themesUsage) +
          syncCostUsd(reviseUsage)
        ).toFixed(5)
      ),
      revision: { on: revisionOn(), rewritten: revision.revisions.length, refused: revision.refused.length },
      /*
       * ── ⚠ UN ESSAI REFUSÉ QUI NE DIT PAS SON ENTONNOIR N'APPREND RIEN ──
       *
       * Mesuré en mesurant : deux essais ont été refusés sur `month.short`, et
       * le rapport ne portait ni `funnel` ni `failures` — donc ni la conformité
       * au premier appel, qui est LE chiffre que la session mesure, ni la
       * raison des vingt-huit posts manquants. Il a fallu lire la base pour
       * apprendre que la quota du mois était déjà consommée par une session
       * précédente, sur un compte qui n'avait pourtant aucun `content_months`.
       *
       * ⚠ C'EST ENCORE UNE GRANDEUR JUSTE, CALCULÉE, ET NON PUBLIÉE. Le
       * chemin livré imprimait les deux ; le chemin refusé, qui est le plus
       * fréquent, ne les imprimait pas.
       */
      funnel, failures,
      findings: selection.remaining, dropped: selection.dropped,
    }, null, 2));
    throw new Error(
      `le mois ne passe pas ses contrôles : ${selection.remaining.map((f: Finding) => f.check).join(", ")}`
    );
  }

  const batchCost = useBatch ? batchCostUsd([usage]) : 0;
  const syncCost = useBatch ? 0 : syncCostUsd(usage);
  // ⚠ Le juge de complétude compris : un appel payant entre dans le total.
  const costUsd =
    batchCost + syncCost +
    syncCostUsd(repairUsage) + syncCostUsd(judgeUsage) + syncCostUsd(themesUsage) +
    syncCostUsd(reviseUsage);
  const elapsedSeconds = Math.round((Date.now() - started) / 1000);

  console.log(JSON.stringify({
    step: "month",
    mode: useBatch ? "batch" : "sync",
    firstMonth,
    monthId: monthRow.id,
    elapsedSeconds,
    funnel: {
      ...funnel,
      keptForWriting: succeeded.length,
      written,
      fallbacks: fallbacks.length,
      visualsOnThirty: written,
    },
    mix: Object.fromEntries(
      Object.keys(FAMILIES).map((f) => [f, succeeded.filter((c) => c.family === f).length])
    ),
    shortfall,
    fallbacks,
    failures,
    ethicsFlags,
    releasedTopics: released.length,
    rejectedAsRedundant: rejected,
    themes: { source: themes.source, themes: themes.themes },
    usage, repairUsage, judgeUsage, themesUsage, reviseUsage,
    revision: {
      on: revisionOn(),
      rewritten: revision.revisions.map((r) => ({ index: r.index, why: r.why })),
      refused: revision.refused,
    },
    costUsd: Number(costUsd.toFixed(5)),
    capUsd: SESSION_CAP_USD,
    spentThisRunUsd: Number(runSpendUsd().toFixed(5)),
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
