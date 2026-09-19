import { describe, expect, it, vi } from "vitest";
import { ethicsCheckSchema } from "@/lib/brand/shapes";
import { generateDirectoryProfile, type DirectoryCall } from "@/lib/directory/generate";

/*
 * ⚠ La seconde garde de la base (`usp_banned_phrases_check`) est injectée
 * muette : ce fichier sonde la FORME de `ethics_check`, pas les clichés, et
 * sans injection il ouvrirait un client service-role. Les clichés sont sondés
 * dans `generate.test.ts`.
 */
const NO_CLICHE = async () => [];
import { loadDirectoryProfile } from "@/lib/data/directory";
import { FIXTURE_CATALOG } from "@/lib/brief/fixtures/catalog";
import type { BriefBundle } from "@/lib/data/brief";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/*
 * ── LE CONTRAT DE LA BASE, ÉPINGLÉ ──────────────────────────────────────
 *
 * ⚠ CE FICHIER EXISTE PARCE QUE DEUX DÉFAUTS SONT PASSÉS, ET C'EST LE MÊME.
 *
 * `generate.test.ts` injectait le modèle et ne touchait jamais la base. Il
 * était vert pendant que le bouton échouait à chaque clic. Ce qui manquait
 * n'était pas un test de plus sur ce que j'avais écrit : c'était un test sur
 * ce que la BASE exige.
 *
 *   1. `ethics_check` partait en `{ violations, scanned_at }` — une forme
 *      inventée. Le CHECK `brand_kit_ethics_check_valid` veut
 *      `{ passed, flagged[{field, excerpt, rule_id}], checked_at }`. Vérifié
 *      contre le projet vivant : `23514 directory_profiles_ethics_check_shape`.
 *      L'insertion échouait APRÈS l'appel modèle — la génération était payée
 *      et rien n'était rangé.
 *
 *   2. `get_directory_profile` rend une ENVELOPPE (`{error}` / `{profile:null}`
 *      / `{profile:{…}}`) et ce module lisait les champs à la racine.
 *      `{ profile: null }` est TRUTHY : « aucune ligne » passait pour « une
 *      ligne vide », et l'écran affichait « rangée mais refusée » — la
 *      confusion exacte que ces deux phrases existent pour empêcher.
 *
 * La leçon du dépôt, enfreinte : ce qui fait autorité se LIT, il ne se suppose
 * pas. `ethicsCheckSchema` existait déjà ; l'enveloppe est dans la définition
 * de la fonction.
 */

const BUNDLE = {
  project: { id: "p1" },
  brief: {
    practice_name: "Elm & Ember Counseling",
    specialty_ids: [],
    modality_ids: [],
    client_persona_ids: [],
    session_style_ids: [],
    not_a_fit_ids: [],
    problem_card_ids: [],
    gain_card_ids: [],
    site_goal_ids: [],
    palette_family_ids: [],
  },
  data: {},
} as unknown as BriefBundle;

const EMPTY = {
  state: null,
  specialties: [],
  modalities: [],
  personas: [],
  insurances: [],
};

const GOOD: DirectoryCall = async () => ({
  firstParagraph: "You keep having the same argument, and neither of you can say why.",
  body: "We start by slowing that argument down until you can both hear it.",
});

describe("⚠ 1. `ethics_check` a la forme que le CHECK exige", () => {
  it("ce qui sort de la génération passe `ethicsCheckSchema`", async () => {
    /*
     * `ethicsCheckSchema` est le miroir applicatif de
     * `brand_kit_ethics_check_valid`, et il existait AVANT ce module. Le
     * valider ici attrape l'écart sans base de données.
     */
    const result = await generateDirectoryProfile(BUNDLE, FIXTURE_CATALOG, EMPTY, GOOD, NO_CLICHE);
    expect(() => ethicsCheckSchema.parse(result.ethicsCheck)).not.toThrow();
  });

  it("les trois clés que la base lit sont là, et nommées comme elle les nomme", async () => {
    const result = await generateDirectoryProfile(BUNDLE, FIXTURE_CATALOG, EMPTY, GOOD, NO_CLICHE);
    expect(Object.keys(result.ethicsCheck).sort()).toEqual([
      "checked_at",
      "flagged",
      "passed",
    ]);
    // ⚠ Et surtout PAS celles que j'avais inventées.
    expect(result.ethicsCheck).not.toHaveProperty("violations");
    expect(result.ethicsCheck).not.toHaveProperty("scanned_at");
  });

  it("⚠ un avertissement non bloquant est journalisé avec son CHAMP", async () => {
    /*
     * `flagged[].field` doit dire lequel des deux champs, sinon le journal ne
     * sert à rien le jour où on le relit. Une violation `warn` passe la garde
     * et doit quand même être inscrite.
     */
    const warned: DirectoryCall = async () => ({
      firstParagraph: "You keep having the same argument.",
      body: "We will find an approach that works best for you, whatever that takes.",
    });
    const result = await generateDirectoryProfile(BUNDLE, FIXTURE_CATALOG, EMPTY, warned, NO_CLICHE);
    expect(() => ethicsCheckSchema.parse(result.ethicsCheck)).not.toThrow();
    for (const entry of result.ethicsCheck.flagged) {
      expect(["first_paragraph", "body"]).toContain(entry.field);
      expect(typeof entry.rule_id).toBe("string");
      expect(typeof entry.excerpt).toBe("string");
    }
  });
});

/** Un client réduit à ce que `loadDirectoryProfile` lit, avec l'enveloppe voulue. */
function clientReturning(envelope: unknown) {
  return {
    rpc: async () => ({ data: envelope, error: null }),
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    }),
  } as unknown as SupabaseClient<Database>;
}

describe("⚠ 2. l'enveloppe de `get_directory_profile` est lue telle qu'elle est", () => {
  it("`{ profile: null }` est une prose JAMAIS PRODUITE", async () => {
    /*
     * LE DÉFAUT, EN UNE ASSERTION. `{ profile: null }` est un objet truthy :
     * le lire comme « une ligne existe » donnait « rangée mais refusée » sur
     * un kit où rien n'avait jamais été écrit.
     */
    const view = await loadDirectoryProfile(clientReturning({ profile: null }), "k1", "p1");
    expect(view.prose).toBeNull();
    expect(view.proseIssue).toBe("not_produced");
  });

  it("`{ profile: { … } }` est lue, et c'est là que vivent les champs", async () => {
    const view = await loadDirectoryProfile(
      clientReturning({
        profile: {
          platform: "psychology_today",
          first_paragraph: "You keep having the same argument.",
          body: "We start by slowing it down.",
          structured: {},
        },
      }),
      "k1",
      "p1"
    );
    expect(view.proseIssue).toBeNull();
    expect(view.prose?.firstParagraph).toBe("You keep having the same argument.");
    expect(view.prose?.body).toBe("We start by slowing it down.");
  });

  it("⚠ `{ error }` n'est PAS une prose absente", async () => {
    /*
     * `kit_paid_access` peut refuser. Le dire « pas encore écrite » enverrait
     * chercher du côté de la génération pour un problème de droit.
     */
    const view = await loadDirectoryProfile(
      clientReturning({ error: "payment_required" }),
      "k1",
      "p1"
    );
    expect(view.prose).toBeNull();
    expect(view.proseIssue).toBe("not_produced");
  });

  it("une prose VRAIMENT vide reste « rangée mais refusée »", async () => {
    /*
     * La branche doit rester atteignable : elle existe pour le jour où une
     * ligne rangée cesse de passer les bornes. La confondre avec l'absence
     * dans un sens comme dans l'autre est le défaut.
     */
    const view = await loadDirectoryProfile(
      clientReturning({ profile: { first_paragraph: "  ", body: "  " } }),
      "k1",
      "p1"
    );
    expect(view.proseIssue).toBe("stored_prose_rejected");
  });

  it("⚠ les champs ne sont PAS lus à la racine de l'enveloppe", async () => {
    /*
     * La forme exacte du premier jet. Si quelqu'un la remet, ce test rougit
     * au lieu de laisser un écran mentir.
     */
    const view = await loadDirectoryProfile(
      clientReturning({
        first_paragraph: "à la racine, comme le premier jet le croyait",
        body: "idem",
      }),
      "k1",
      "p1"
    );
    expect(view.prose).toBeNull();
    expect(view.proseIssue).toBe("not_produced");
  });
});
