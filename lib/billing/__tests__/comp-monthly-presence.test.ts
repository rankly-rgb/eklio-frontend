import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { canUseMonthlyPresence } from "@/lib/billing/entitlements";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/*
 * ── L'OCTROI COMP OUVRE MONTHLY PRESENCE, ET IL L'OUVRE À UN SEUL ENDROIT ──
 *
 * ⚠ CET ENDROIT A CHANGÉ, ET CE FICHIER A ÉTÉ RÉÉCRIT AVEC LUI.
 *
 * Il gardait une architecture qui n'existe plus. `20260901182419` s'était
 * arrêté sur un manque — la base n'avait aucun point d'étranglement où OU-er
 * le comp — et le manque avait été fermé en TypeScript, dans
 * `canUseMonthlyPresence` : règle pure d'abord, aller-retour comp ensuite.
 * Ce fichier COMPTAIT les appels pour garantir cet ordre.
 *
 * `20260920140000_monthly_presence_has_a_chokepoint` a levé cet arrêt. La
 * phrase entière — abonnement, grâce de trois jours, comp — vit maintenant
 * dans `check_monthly_presence_entitlement(uuid)`, et `reserve_credit`
 * l'appelle avant toute dépense. `canUseMonthlyPresence` n'en est plus que
 * l'appelante.
 *
 * ── CE QUE LE TEST SUPPRIMÉ DISAIT, ET POURQUOI IL NE DIT PLUS RIEN ──────
 *
 * Il disait : « n'interroge pas la base quand l'abonnement a déjà répondu
 * oui », et il le prouvait en comptant à zéro. C'était juste tant que la
 * question était « qu'affiche-t-on ». Depuis que des appels d'API payants
 * sont derrière ce droit, la question est devenue « que peut-on dépenser »,
 * et une règle tenue en mémoire ne répond qu'à qui l'interroge. L'aller-retour
 * épargné était exactement le prix de cette garantie-là.
 *
 * Ce que ce fichier garde, et qui n'a pas bougé :
 *
 *   1. un compte comp ouvre la surface sans la moindre ligne `subscriptions` ;
 *   2. l'échec est FERMÉ : une lecture en erreur n'ouvre rien ;
 *   3. `isEntitledToMonthlyPresence` n'a toujours RIEN appris du comp — elle
 *      reste un fait sur une ligne d'abonnement, pour choisir un texte.
 */

/**
 * Un client dont le seul comportement utile est
 * `rpc("monthly_presence_entitled")`.
 *
 * ⚠ IL REFUSE TOUT AUTRE NOM DE RPC, et c'est le cœur du test : si
 * `canUseMonthlyPresence` se remettait à décider elle-même, ou repassait par
 * `comp_access_active`, chaque cas ci-dessous lèverait.
 */
function clientWithGate(
  result: { data: unknown; error: unknown }
): { supabase: SupabaseClient<Database>; calls: () => string[] } {
  const calls: string[] = [];
  const supabase = {
    rpc: async (name: string) => {
      if (name !== "monthly_presence_entitled") {
        throw new Error(`rpc inattendu : ${name}`);
      }
      calls.push(name);
      return result;
    },
  } as unknown as SupabaseClient<Database>;
  return { supabase, calls: () => calls };
}

const GATE_OPEN = () => clientWithGate({ data: true, error: null });
const GATE_SHUT = () => clientWithGate({ data: false, error: null });

describe("canUseMonthlyPresence", () => {
  /* ⚠ LE MANQUE QUI RESTE FERMÉ. Aucun abonnement, et pourtant l'accès. */
  it("un octroi comp ouvre la surface sans la moindre ligne `subscriptions`", async () => {
    // La base a OU-é le comp elle-même : elle rend `true` pour un compte qui
    // n'a aucun abonnement. Le client n'en sait rien et n'a rien à en savoir.
    const { supabase } = GATE_OPEN();
    await expect(canUseMonthlyPresence(supabase)).resolves.toBe(true);
  });

  it("sans abonnement ET sans comp, la surface reste fermée", async () => {
    const { supabase } = GATE_SHUT();
    await expect(canUseMonthlyPresence(supabase)).resolves.toBe(false);
  });

  /*
   * ⚠ LA PROPRIÉTÉ QUI A REMPLACÉ LE COMPTE À ZÉRO. On ne compte plus « pas
   * d'aller-retour », on compte « UN SEUL, et c'est le bon ». Une seconde
   * question posée ici serait une seconde règle qui commence.
   */
  it("pose exactement une question, et c'est celle de la base", async () => {
    const { supabase, calls } = GATE_OPEN();
    await canUseMonthlyPresence(supabase);
    expect(calls()).toEqual(["monthly_presence_entitled"]);
  });

  /*
   * ── ÉCHEC FERMÉ ────────────────────────────────────────────────────────
   * Un droit qu'on n'a pas pu vérifier n'est pas un droit accordé.
   */
  it("une erreur de lecture n'ouvre rien", async () => {
    const { supabase } = clientWithGate({ data: null, error: { message: "boom" } });
    await expect(canUseMonthlyPresence(supabase)).resolves.toBe(false);
  });

  /* Anti-vacuité : `null` n'est pas `true`, et n'est pas traité comme tel. */
  it("une réponse nulle sans erreur n'ouvre rien non plus", async () => {
    const { supabase } = clientWithGate({ data: null, error: null });
    await expect(canUseMonthlyPresence(supabase)).resolves.toBe(false);
  });
});

/* ── La règle d'abonnement n'a rien appris ─────────────────────────────── */

describe("le comp n'est pas entré dans la règle d'abonnement", () => {
  /*
   * Le pendant de `independence.test.ts` : là-bas on garde la fonction contre
   * `purchases` et les paliers, ici contre le comp. Même raison, et c'est la
   * raison qui compte : deux réponses à une même question finissent par
   * diverger, et c'est la plus permissive qui gagne.
   *
   * Elle n'est plus la DÉCISION — la base l'est — mais elle choisit encore un
   * texte sur `/app/checkout/success`, et un texte faux reste un texte faux.
   */
  it("le corps de `isEntitledToMonthlyPresence` ne lit aucun comp", () => {
    const source = readFileSync("lib/billing/entitlements.ts", "utf8");
    const fn = source.slice(
      source.indexOf("export function isEntitledToMonthlyPresence")
    );
    const body = fn.slice(0, fn.indexOf("\n}"));

    expect(body).not.toMatch(/comp/i);
    expect(body).not.toMatch(/supabase/);

    // Anti-vacuité : c'est bien un corps de fonction qu'on inspecte.
    expect(body).toMatch(/status === "trialing"/);
    expect(body).toMatch(/past_due/);
    expect(body.length).toBeGreaterThan(120);
  });

  /*
   * ⚠ ET `canUseMonthlyPresence` NE REDÉCIDE PLUS RIEN. Son corps n'appelle
   * ni la règle pure ni la lecture comp : il pose UNE question et rend la
   * réponse. C'est ce qui fait que l'écran ne peut plus dire oui pendant que
   * `reserve_credit` dit non.
   */
  it("le corps de `canUseMonthlyPresence` ne contient aucune règle", () => {
    const source = readFileSync("lib/billing/entitlements.ts", "utf8");
    const fn = source.slice(
      source.indexOf("export async function canUseMonthlyPresence")
    );
    const body = fn.slice(0, fn.indexOf("\n}"));

    expect(body).toMatch(/monthly_presence_entitled/);
    expect(body).not.toMatch(/isEntitledToMonthlyPresence/);
    expect(body).not.toMatch(/isCompAccessActive/);
    expect(body).not.toMatch(/past_due/);
  });

  /*
   * ⚠ ET LE PORTAIL STRIPE RESTE SUR L'ABONNEMENT NU. Un compte comp n'a aucun
   * client Stripe : lui ouvrir un portail échouerait, et lui répondre « tu es
   * abonnée » serait faux. Cette route pose la bonne question, qu'elle garde.
   */
  it("la route du portail Stripe ne passe pas par le point d'étranglement comp", () => {
    const source = readFileSync("app/api/billing/portal/route.ts", "utf8");
    expect(source).not.toMatch(/canUseMonthlyPresence/);
    expect(source).toMatch(/getSubscription/);
  });
});
