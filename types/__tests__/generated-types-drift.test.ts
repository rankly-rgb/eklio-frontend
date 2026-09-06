import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/*
 * ── LE PIÈGE DE LA RÉGÉNÉRATION, RENDU BRUYANT ──────────────────────────
 *
 * « Ne régénère pas types/supabase.ts » est une règle que quelqu'un oubliera,
 * et la perte est SILENCIEUSE : le fichier compile toujours, `Database` reste
 * un type valide, et la première chose qui casse est un appel qui était typé
 * hier et vaut `any` aujourd'hui.
 *
 * Deux choses ne sont pas générées et disparaissent à chaque `gen types` :
 * l'addendum manuel (quatre unions de statut, des colonnes `text` sous CHECK
 * que le générateur rend en `string`) et les ajouts écrits à la main par une
 * session qui n'a pas régénéré. Ce test nomme les deux.
 *
 * Il ne dit PAS que régénérer est interdit. Il dit qu'après régénération, il
 * faut remettre ce qu'il énumère — et il devient rouge tant que ce n'est pas
 * fait.
 */

const FILE = resolve(__dirname, "../supabase.ts");
const SOURCE = readFileSync(FILE, "utf8");

/** Les tables ajoutées à la main, avec la migration qui les a créées. */
const HAND_ADDED_TABLES: Record<string, string> = {
  content_items: "20260906155600_content_items",
  content_publications: "20260906155600_content_items",
  user_uploads: "20260906164920_user_uploads",
};

/** Les RPC ajoutées à la main. Sans elles, `supabase.rpc(...)` n'est plus typé. */
const HAND_ADDED_FUNCTIONS = [
  "create_content_item",
  "update_content_item",
  "delete_content_item",
  "mark_content_posted",
  "get_content_month",
  "get_content_item",
  "get_publishing_log",
  "request_user_upload",
  "record_user_upload",
  "delete_user_upload",
  "list_user_uploads",
];

/** L'addendum manuel : quatre unions que le générateur écrase en `string`. */
const ADDENDUM_TYPES = [
  "ProjectStatus",
  "SubscriptionStatus",
  "PurchaseStatus",
  "MonthlyPresenceStatus",
];

describe("le fichier est bien celui qu'on croit", () => {
  it("c'est le type généré, pas un fichier vide", () => {
    // Sans cette garde, un fichier tronqué ferait échouer les tests suivants
    // pour la bonne raison — mais un fichier ILLISIBLE les ferait tous
    // échouer pour la mauvaise, et on chercherait au mauvais endroit.
    expect(SOURCE).toContain("export type Database = {");
    expect(SOURCE.length).toBeGreaterThan(50_000);
  });

  it("il porte l'avertissement en tête", () => {
    // La règle vit à deux endroits : ici, et dans le fichier lui-même. Celui
    // qui régénère lit le fichier avant de lire les tests.
    expect(SOURCE).toContain("THIS FILE IS NOT SAFELY REGENERABLE");
  });
});

describe("les tables ajoutées à la main sont toujours là", () => {
  it.each(Object.entries(HAND_ADDED_TABLES))("« %s » (%s)", (table) => {
    expect(
      SOURCE.includes(`      ${table}: {`),
      `\`${table}\` a disparu de types/supabase.ts.\n` +
        "C'est la signature d'une régénération : le générateur a écrasé le fichier\n" +
        "et cette table n'a pas été remise. Remets-la, avec ses Row/Insert/Update."
    ).toBe(true);
  });

  it("et avec leurs trois formes, pas seulement leur nom", () => {
    // Une entrée `Row` sans `Insert`/`Update` typerait une écriture en `never`.
    for (const table of Object.keys(HAND_ADDED_TABLES)) {
      const block = SOURCE.slice(SOURCE.indexOf(`      ${table}: {`));
      const head = block.slice(0, 2_000);
      expect(head).toContain("Row: {");
      expect(head).toContain("Insert: {");
      expect(head).toContain("Update: {");
    }
  });
});

describe("les RPC ajoutées à la main sont toujours là", () => {
  it.each(HAND_ADDED_FUNCTIONS)("« %s »", (fn) => {
    expect(
      SOURCE.includes(`      ${fn}: {`) || SOURCE.includes(`      ${fn}: { Args`),
      `\`${fn}\` a disparu de types/supabase.ts.\n` +
        "Sans elle, `supabase.rpc(\"" + fn + '")` n\'est plus typé : les arguments\n' +
        "et le retour deviennent `any`, et le compilateur cesse de couvrir un appel\n" +
        "qui passe par le réseau."
    ).toBe(true);
  });
});

describe("l'addendum manuel est toujours là", () => {
  it.each(ADDENDUM_TYPES)("« %s »", (name) => {
    expect(
      SOURCE.includes(`export type ${name} =`),
      `\`${name}\` a disparu. Ces unions ne sont PAS générées : les colonnes sont\n` +
        "des `text` sous CHECK, que le générateur rend en `string`. Elles ont déjà dû\n" +
        "être remises quatre fois."
    ).toBe(true);
  });

  it("la règle est appliquée, pas vacuously vraie", () => {
    // Témoin : un nom qui n'a jamais existé ne doit PAS être trouvé.
    expect(SOURCE.includes("export type AStatusNobodyDeclared =")).toBe(false);
  });
});
