import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { KIT_PLANS, MONTHLY_PRESENCE } from "@/lib/billing/plans";
import { KIT_TIERS, LEGACY_KIT_TIERS } from "@/lib/kit/tiers";

/*
 * ── ⚠ LE CODE PEUT EXIGER UNE VARIABLE QUE RIEN NE DÉCLARE ──────────────
 *
 * Relevé le 2026-09-26 : `.env.example` déclare SEPT variables Stripe, le code
 * en lit DOUZE. Deux des cinq manquantes — `STRIPE_PRICE_FOUNDATION` (390 $) et
 * `STRIPE_PRICE_ROSTER` (690 $) — sont atteignables depuis l'action de checkout,
 * parce que `kitTierSchema` est un `z.enum(KIT_TIERS)` et que `KIT_TIERS` porte
 * les cinq paliers. `requireEnv` lève alors, et un point d'entrée de PAIEMENT
 * rend un 500 non géré.
 *
 * Ce n'est pas une fuite d'argent — rien n'est débité. C'est un palier
 * achetable par requête, invisible à l'écran, dont personne ne connaît le prix.
 *
 * ⚠ ET C'EST EXACTEMENT LA CLASSE DE F27 : deux moitiés justes — un catalogue de
 * paliers, une liste de variables — et la jonction fausse, que rien ne comparait.
 */

const ENV_EXAMPLE = readFileSync(".env.example", "utf8");

/** Les variables que `.env.example` déclare, quelle que soit leur valeur. */
function declared(): Set<string> {
  return new Set(
    [...ENV_EXAMPLE.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1])
  );
}

describe("les quatre prix en vente correspondent aux paliers annoncés", () => {
  /*
   * ⚠ ÉCRITS EN CENTIMES DES DEUX CÔTÉS. Une confusion dollars/centimes ici ne
   * se voit pas à la relecture — elle se voit sur la facture.
   */
  it.each([
    ["starter", 7900],
    ["practice", 14900],
    ["signature", 24900],
  ] as const)("%s vaut %i centimes", (tier, cents) => {
    expect(KIT_PLANS[tier].amountCents).toBe(cents);
  });

  it("Monthly Presence vaut 3900 centimes par mois", () => {
    expect(MONTHLY_PRESENCE.amountCents).toBe(3900);
    expect(MONTHLY_PRESENCE.interval).toBe("month");
  });

  /*
   * ⚠ LA PAGE DE TARIFS ITÈRE `LEGACY_KIT_TIERS`, PAS `KIT_TIERS`. C'est ce qui
   * rend `foundation` et `roster` invisibles — et achetables quand même.
   */
  it("la page de tarifs ne montre que les trois paliers annoncés", () => {
    expect([...LEGACY_KIT_TIERS]).toEqual(["starter", "practice", "signature"]);
  });
});

describe("toute variable de prix que le code peut exiger est déclarée", () => {
  const isDeclared = declared();

  /*
   * ⚠ CE QUI EST VENDU DOIT ÊTRE DÉCLARÉ, SANS EXCEPTION. Ces quatre-là sont
   * sur la page de tarifs : une variable manquante y est un bouton d'achat qui
   * rend un 500.
   */
  it.each([...LEGACY_KIT_TIERS])("%s a sa variable déclarée", (tier) => {
    expect(
      isDeclared.has(KIT_PLANS[tier].priceEnvVar),
      `${KIT_PLANS[tier].priceEnvVar} est exigée par le code et absente de .env.example`
    ).toBe(true);
  });

  it("Monthly Presence a sa variable déclarée", () => {
    expect(isDeclared.has(MONTHLY_PRESENCE.priceEnvVar)).toBe(true);
  });

  /*
   * ── ⚠ ET LES PALIERS ACHETABLES MAIS NON DÉCLARÉS SONT NOMMÉS ──────────
   *
   * Tant qu'ils ne sont pas tranchés, ils sont ici, avec ce qu'il faut faire.
   * Ce test tombe le jour où quelqu'un pose la variable OU restreint le schéma —
   * et c'est l'intention : les deux réponses sont bonnes, l'oubli ne l'est pas.
   */
  const UNDECLARED_BUT_REACHABLE: Record<string, string> = {
    foundation:
      "390 $, accepté par kitTierSchema et absent de la page de tarifs. Poser STRIPE_PRICE_FOUNDATION si le palier se vend, sinon restreindre le schéma de l'action de checkout à LEGACY_KIT_TIERS",
    roster:
      "690 $, même situation que foundation. La bonne réponse tant que la page ne le montre pas est de restreindre le schéma : un palier achetable et invisible est un palier dont personne ne connaît le prix",
  };

  it("les paliers atteignables et non déclarés sont exactement ceux qu'on a nommés", () => {
    const reachable = KIT_TIERS.filter((t) => !isDeclared.has(KIT_PLANS[t].priceEnvVar));
    expect(
      [...reachable].sort(),
      "un palier atteignable a changé de statut : soit sa variable est posée, soit le schéma est restreint, soit il faut le nommer ici"
    ).toEqual(Object.keys(UNDECLARED_BUT_REACHABLE).sort());
  });

  it("chaque palier non déclaré dit quoi faire, et pas « plus tard »", () => {
    for (const [tier, why] of Object.entries(UNDECLARED_BUT_REACHABLE)) {
      expect(KIT_TIERS as readonly string[]).toContain(tier);
      expect(why.length, tier).toBeGreaterThan(60);
      expect(why, `${tier} : « plus tard » n'est pas une décision`).toMatch(
        /Poser|restreindre/i
      );
    }
  });
});

/*
 * ── ⚠ ET LE CATALOGUE D'OFFRES N'EST IMPORTÉ PAR RIEN ───────────────────
 *
 * `lib/billing/offer.ts` porte quatre variables de plus — IDENTITY_ADDON 89 $,
 * ROSTER_SEAT 120 $, FILL_SOLO 59 $, FILL_PRACTICE 69 $ — et aucun fichier hors
 * de ses propres tests ne l'importe. De la configuration morte : ne pas poser
 * ces variables. Ce test tombe le jour où quelqu'un le branche, et il faudra
 * alors les déclarer comme les autres.
 */
describe("le catalogue d'offres reste débranché", () => {
  /*
   * ⚠ UN `import`, PAS UNE MENTION. La première version cherchait la chaîne
   * « billing/offer » et a trouvé un COMMENTAIRE de `lib/kit/tiers.ts` : elle
   * annonçait un branchement qui n'existait pas. C'est la troisième fois de la
   * journée qu'un recensement attrape un commentaire — le motif doit donc porter
   * sur la syntaxe d'import, pas sur le nom du module.
   */
  it("rien hors de ses tests ne l'importe", () => {
    const out = execFileSync(
      "grep",
      ["-rlE", "from \"[^\"]*billing/offer\"", "--include=*.ts", "--include=*.tsx", "lib", "app", "components"],
      { encoding: "utf8" }
    ).trim();
    const importers = out.split("\n").filter((f) => f && !f.includes("__tests__"));
    expect(
      importers,
      `lib/billing/offer.ts est maintenant importé par ${importers.join(", ")} — ses quatre variables doivent être déclarées`
    ).toEqual([]);
  });
});
