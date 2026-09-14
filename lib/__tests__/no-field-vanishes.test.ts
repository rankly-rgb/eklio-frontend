import { describe, expect, it } from "vitest";
import { briefPatchSchema } from "@/lib/data/brief";
import { contentPatchSchema } from "@/lib/data/content";
import { sanitizePatch } from "@/lib/site/patch";
import { FIXTURE_DRAFT } from "@/lib/brief/fixtures/catalog";

/*
 * ── CE QU'UN ÉCRAN ÉCRIT DOIT SURVIVRE JUSQU'À LA BASE ───────────────────
 *
 * ⚠ CE FICHIER EXISTE PARCE QU'UNE RÉPONSE A DISPARU SANS ERREUR.
 *
 * L'étape 1 du brief demandait la plateforme, `stepIssue` EXIGEAIT la réponse,
 * et `briefPatchSchema` ne déclarait pas `site_platform_id`. Zod retire les
 * clés inconnues : `safeParse` rendait `success: true`, la colonne restait
 * NULL, l'étape 1 redemandait la même chose indéfiniment. Aucune erreur nulle
 * part — le défaut de la maison dans sa forme la plus pure.
 *
 * ⚠ ET LE TYPAGE NE PROTÉGEAIT PAS. `BriefFlow` envoie
 * `{ ...patch, progress_step }` où `patch: Partial<StepDraft>` ; le contrôle
 * d'excédent de TypeScript ne s'applique pas à un spread. `tsc` était vert.
 * La garde doit donc être à l'EXÉCUTION, et c'est ce fichier.
 *
 * ── CE QUI EST COUVERT, ET POURQUOI PAS PLUS ────────────────────────────
 *
 * Le défaut exige une chose précise : un écran qui envoie un objet dont les
 * clés peuvent EXCÉDER ce que le gabarit d'écriture déclare. Recensé sur tout
 * `app/api` :
 *
 *   brief            `Partial<StepDraft>` -> `briefPatchSchema`   ⚠ le cas
 *   éditeur contenu  sept clés -> `contentPatchSchema`
 *   éditeur de site  objet libre -> `sanitizePatch` (liste NOIRE : rien ne
 *                    tombe en silence, la base tranche)
 *
 * La route du profil d'annuaire N'EST PAS de cette famille : elle ne lit
 * AUCUN corps de requête. Son risque était la LECTURE de l'enveloppe RPC, et
 * il est couvert par `lib/directory/__tests__/database-contract.test.ts`.
 *
 * Les autres routes envoient des littéraux de deux ou trois clés écrits sur
 * place (`{ key, status }`) : il n'existe pas d'objet plus large d'où une clé
 * pourrait tomber.
 */

/**
 * Les clés que `BriefFlow` envoie SANS passer par une étape.
 * `autosave.save({ progress_step })` et `autosave.save({ completed_steps })`.
 */
const FLOW_ONLY = ["progress_step", "completed_steps"] as const;

/**
 * ⚠ DÉRIVÉ DE `StepDraft`, PAS RECOPIÉ. `FIXTURE_DRAFT` est typée `StepDraft`
 * (pas `Partial`), donc TypeScript force chaque champ à y être : un champ
 * ajouté à l'étape entre AUTOMATIQUEMENT dans ce test. Une liste recopiée
 * aurait eu besoin qu'on pense à la mettre à jour — c'est-à-dire exactement ce
 * que personne n'a fait la première fois.
 */
const WHAT_THE_BRIEF_SCREENS_CAN_SEND = Object.keys(FIXTURE_DRAFT);

function schemaKeys(schema: unknown): string[] {
  return Object.keys((schema as { shape: Record<string, unknown> }).shape);
}

describe("⚠ le brief : aucune réponse ne disparaît en route", () => {
  it("chaque champ de StepDraft est déclaré par le gabarit d'écriture", () => {
    const declared = new Set(schemaKeys(briefPatchSchema));
    const vanishing = WHAT_THE_BRIEF_SCREENS_CAN_SEND.filter((key) => !declared.has(key));

    expect(
      vanishing,
      `Ces champs sont modifiables à l'écran et ABSENTS de briefPatchSchema. ` +
        `Zod les retire sans erreur : l'écran croit avoir enregistré, la ` +
        `colonne reste NULL, et si une étape les EXIGE (comme stepIssue exige ` +
        `site_platform_id) le brief se bloque sur une question à laquelle on ` +
        `a répondu. Déclarez-les, ou retirez-les de StepDraft.`
    ).toEqual([]);
  });

  it("⚠ l'aller-retour : tout ce qu'on envoie ressort", () => {
    /*
     * La propriété elle-même, et pas seulement la liste des clés : on patche,
     * on relit ce que le gabarit a laissé passer, on exige l'égalité.
     */
    const sent: Record<string, unknown> = {
      ...FIXTURE_DRAFT,
      progress_step: 1,
      completed_steps: [1],
    };
    const parsed = briefPatchSchema.parse(sent);

    expect(Object.keys(parsed).sort()).toEqual(Object.keys(sent).sort());
    expect(parsed).toHaveProperty("site_platform_id");
    expect(parsed).toHaveProperty("site_url");
  });

  it("le gabarit ne déclare rien que personne n'envoie", () => {
    /*
     * L'inverse compte aussi : une clé déclarée et jamais envoyée est une
     * colonne que le client peut écrire sans qu'aucun écran ne le fasse.
     */
    const sendable = new Set<string>([...WHAT_THE_BRIEF_SCREENS_CAN_SEND, ...FLOW_ONLY]);
    const orphans = schemaKeys(briefPatchSchema).filter((key) => !sendable.has(key));
    expect(orphans).toEqual([]);
  });

  it("⚠ LA CAUSE RACINE : une clé non déclarée est une ERREUR, pas un silence", () => {
    /*
     * `.strict()`. Sans lui, le test ci-dessus attrape les champs qu'on
     * CONNAÎT ; celui-ci attrape ceux qu'on ne connaît pas encore, au moment
     * où ils arrivent, du côté du serveur.
     */
    const verdict = briefPatchSchema.safeParse({
      practice_name: "Elm & Ember",
      a_field_nobody_declared: "disparaissait en silence",
    });
    expect(verdict.success).toBe(false);
  });
});

describe("l'éditeur de contenu : les sept clés qu'il envoie", () => {
  /*
   * ⚠ RECOPIÉES, et il faut le dire : `item-editor.tsx` type son correctif
   * `Record<string, unknown>`, donc il n'existe aucun objet typé d'où les
   * dériver. La liste est celle des appels `queue({ … })` du fichier.
   */
  const WHAT_THE_EDITOR_SENDS = [
    "archetype",
    "status",
    "title",
    "caption",
    "alt_text",
    "image_slot",
    "scheduled_for",
  ];

  it("chacune est déclarée par contentPatchSchema", () => {
    const declared = new Set(schemaKeys(contentPatchSchema));
    expect(WHAT_THE_EDITOR_SENDS.filter((key) => !declared.has(key))).toEqual([]);
  });

  it("l'aller-retour les rend toutes", () => {
    const sent = {
      archetype: "notes",
      status: "draft",
      title: "A title",
      caption: "A caption",
      alt_text: "Alt",
      image_slot: null,
      scheduled_for: null,
    };
    const parsed = contentPatchSchema.parse(sent);
    expect(Object.keys(parsed).sort()).toEqual(Object.keys(sent).sort());
  });
});

describe("l'éditeur de site : une liste NOIRE, donc rien ne tombe en silence", () => {
  it("une clé inconnue PASSE, et c'est la base qui tranche", () => {
    /*
     * `sanitizePatch` retire les jetons dérivés et les champs non patchables,
     * et laisse tout le reste. C'est le sens INVERSE du défaut : rien ne
     * disparaît en chemin, et `site_spec_patch` refuse bruyamment ce qu'elle
     * n'accepte pas. Vérifié pour que le jour où ça devient une liste
     * blanche, ce test le dise.
     */
    const out = sanitizePatch({ hero: { headline: "x" }, a_new_area: { k: 1 } });
    expect(Object.keys(out).sort()).toEqual(["a_new_area", "hero"]);
  });
});
