import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/*
 * ── LE PIÈGE DE LA RÉGÉNÉRATION, RENDU BRUYANT ──────────────────────────
 *
 * ⚠ LA PRÉMISSE A CHANGÉ, ET LE TEST AVEC ELLE. Ce fichier disait « THIS FILE
 * IS NOT SAFELY REGENERABLE » parce que des tables et des RPC y avaient été
 * ÉCRITES À LA MAIN : régénérer les effaçait. Le chantier Content a régénéré
 * pour de bon, avec le générateur de Supabase, et tout ce qui était manuel
 * existe maintenant en base — donc le générateur le produit.
 *
 * Ce qui reste vrai, et ce que ce test garde toujours : l'ADDENDUM manuel
 * n'est pas généré. Ce sont des colonnes `text` contraintes par un CHECK, que
 * `gen types` rend en `string` ; les unions vivent ici et disparaissent à
 * chaque régénération si personne ne les remet.
 *
 * Le test ne dit donc plus « ne régénère pas ». Il dit : régénère quand tu
 * veux, ET REMETS L'ADDENDUM — et il reste rouge tant que ce n'est pas fait.
 * Les listes ci-dessous ne sont plus « ce qui a été ajouté à la main » mais
 * « ce qui doit SURVIVRE à une régénération » : si l'une manque, la
 * régénération a été faite contre la mauvaise base.
 */

const FILE = resolve(__dirname, "../supabase.ts");
const SOURCE = readFileSync(FILE, "utf8");

/** Les tables qui doivent survivre à une régénération, et leur migration. */
const HAND_ADDED_TABLES: Record<string, string> = {
  content_items: "20260906155600_content_items",
  content_publications: "20260906155600_content_items",
  user_uploads: "20260906164920_user_uploads",
  content_registers: "20260910083735_content_system_schema",
  content_preferences: "20260910083735_content_system_schema",
  content_checkins: "20260910083735_content_system_schema",
  content_months: "20260910083735_content_system_schema",
  content_grounds: "20260910083735_content_system_schema",
  content_image_allowance: "20260910083735_content_system_schema",
};

/** Les RPC qui doivent survivre. Sans elles, `supabase.rpc(...)` n'est plus typé. */
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
  "set_content_preferences",
  "set_content_checkin",
  "approve_content_month",
  "reserve_content_image",
  "settle_content_image",
  "get_content_image_allowance",
];

/** L'addendum manuel : quatre unions que le générateur écrase en `string`. */
const ADDENDUM_TYPES = [
  "ProjectStatus",
  "SubscriptionStatus",
  "PurchaseStatus",
  // `MonthlyPresenceStatus` stood here until the Content chantier retired the
  // table it described (backend 20260910082539). Removed rather than kept as a
  // union nothing can hold.
];

describe("le fichier est bien celui qu'on croit", () => {
  it("c'est le type généré, pas un fichier vide", () => {
    // Sans cette garde, un fichier tronqué ferait échouer les tests suivants
    // pour la bonne raison — mais un fichier ILLISIBLE les ferait tous
    // échouer pour la mauvaise, et on chercherait au mauvais endroit.
    expect(SOURCE).toContain("export type Database = {");
    expect(SOURCE.length).toBeGreaterThan(50_000);
  });

  it("il porte sa provenance et le rappel de l'addendum en tête", () => {
    // La règle vit à deux endroits : ici, et dans le fichier lui-même. Celui
    // qui régénère lit le fichier avant de lire les tests.
    expect(SOURCE).toContain("GENERATED FROM THE DATABASE");
    expect(SOURCE).toContain("THE ADDENDUM AT THE BOTTOM IS HAND-MAINTAINED");
  });

  it("⚠ et la table morte n'est jamais revenue", () => {
    // Une régénération faite contre une base où la retraite n'a pas été
    // appliquée la ramènerait, silencieusement.
    expect(SOURCE).not.toContain("monthly" + "_presence_" + "content");
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
