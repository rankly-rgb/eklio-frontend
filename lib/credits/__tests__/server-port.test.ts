import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { serverCreditPort, type CreditRpcClient } from "@/lib/credits/server-port";
import {
  ReserveRefused,
  aPurchaseWouldHelp,
  withPaidCall,
  type ReserveRefusal,
} from "@/lib/credits/paid-call";

/*
 * ── LE QUOTA EST TENU PAR LE SQL, ET CE FICHIER LE PROUVE ───────────────
 *
 * Aucun appel, aucune dépense : le port est adossé à deux RPC, et une doublure
 * de client suffit à éprouver tout ce qui compte — que le motif du refus
 * traverse, qu'une panne ne se lise pas comme un quota, et qu'un règlement porte
 * le coût réel.
 */

const OPTIONS = { model: "claude-sonnet-5", month: "2027-07-01" };

function client(handlers: {
  reserve?: (args: Record<string, unknown>) => { data: unknown; error: { message: string } | null };
  settle?: (args: Record<string, unknown>) => { data: unknown; error: { message: string } | null };
} = {}) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const db: CreditRpcClient = {
    async rpc(name, args) {
      calls.push({ name, args });
      if (name === "reserve_credit") {
        return handlers.reserve?.(args) ?? { data: { ok: true, reservation_id: "res-1" }, error: null };
      }
      return handlers.settle?.(args) ?? { data: null, error: null };
    },
  };
  return { db, calls };
}

const SPEC = { userId: "u", kind: "post_generation" as const, reason: "month 2027-07: un post" };

describe("la réservation passe les bons arguments", () => {
  it("le kind, le mois et le modèle vont au livre", async () => {
    const { db, calls } = client();
    await serverCreditPort(db, OPTIONS).reserve(SPEC);
    expect(calls[0].name).toBe("reserve_credit");
    expect(calls[0].args).toMatchObject({
      p_user: "u",
      p_kind: "post_generation",
      p_model: "claude-sonnet-5",
      p_month: "2027-07-01",
      p_provider: "anthropic",
    });
  });

  it("une réservation acceptée rend son identifiant", async () => {
    const { db } = client();
    expect(await serverCreditPort(db, OPTIONS).reserve(SPEC)).toEqual({
      ok: true,
      reservationId: "res-1",
    });
  });
});

/*
 * ── ⚠ F47 : LES SEPT MOTIFS TRAVERSENT ─────────────────────────────────
 *
 * AVANT le portage, le port rendait `string | null` : les six refus devenaient
 * un `null`, et l'appelant annonçait « quota refusé » pour cinq causes qui n'en
 * sont pas — dont un abonnement expiré, qu'un achat ne répare pas de la même
 * façon, et trois défauts de programmation. Le SQL prenait soin de les
 * distinguer ; la couche au-dessus jetait ce soin.
 */
describe("le motif du refus traverse", () => {
  it.each([
    ["quota_exhausted", true],
    ["not_entitled", true],
    ["no_quota_configured", false],
    ["no_user", false],
    ["unknown_kind", false],
    ["invalid_cost", false],
  ] as Array<[ReserveRefusal, boolean]>)("%s — un achat aide : %s", async (reason, buyable) => {
    const { db } = client({ reserve: () => ({ data: { ok: false, reason }, error: null }) });
    const outcome = await serverCreditPort(db, OPTIONS).reserve(SPEC);
    expect(outcome).toEqual({ ok: false, reason });
    expect(aPurchaseWouldHelp(reason)).toBe(buyable);
  });

  /*
   * ⚠ UN HUITIÈME MOTIF DEVIENT `unknown`, PAS `quota_exhausted`. Si la RPC en
   * gagne un, l'appelant doit apprendre qu'il ne le connaît pas — pas se le
   * faire raconter comme un quota épuisé.
   */
  it("un motif inconnu ne se déguise pas en quota épuisé", async () => {
    const { db } = client({
      reserve: () => ({ data: { ok: false, reason: "some_new_reason" }, error: null }),
    });
    const outcome = await serverCreditPort(db, OPTIONS).reserve(SPEC);
    expect(outcome).toEqual({ ok: false, reason: "unknown" });
    expect(aPurchaseWouldHelp("unknown")).toBe(false);
  });

  /*
   * ⚠ ET UNE PANNE DE TRANSPORT N'EST PAS UN REFUS. La base tombée ne dit rien
   * du droit de la praticienne ; la lire comme un quota l'enverrait acheter des
   * crédits qu'elle a déjà. C'est le mensonge exact contre lequel le code de
   * `reserve_credit` avertit.
   */
  it("une erreur de transport lève, elle ne devient pas un refus", async () => {
    const { db } = client({ reserve: () => ({ data: null, error: { message: "boom" } }) });
    await expect(serverCreditPort(db, OPTIONS).reserve(SPEC)).rejects.toThrow("reserve_credit: boom");
  });

  it("le refus remonte jusqu'à l'appelant avec son motif", async () => {
    const { db } = client({
      reserve: () => ({ data: { ok: false, reason: "not_entitled" }, error: null }),
    });
    const port = serverCreditPort(db, OPTIONS);
    const boom = withPaidCall(port, SPEC, async () => ({
      value: 1,
      usage: { input: 1, output: 1 },
      costUsd: 0.01,
    }));
    await expect(boom).rejects.toBeInstanceOf(ReserveRefused);
    await boom.catch((e: ReserveRefused) => {
      expect(e.reason).toBe("not_entitled");
      expect(e.buyable).toBe(true);
    });
  });
});

describe("le règlement porte le coût réel", () => {
  /*
   * ⚠ PAS ZÉRO. `settle_credit` rend `already_settled` sans lever : la PREMIÈRE
   * issue est celle qui reste au livre, donc un zéro efface la dépense pour de
   * bon. F40 l'a mesuré sur le remplissage de banque — 1,20 $ dépensés, 0,0046
   * au registre.
   */
  it("six décimales, et la valeur qu'on lui donne", async () => {
    const { db, calls } = client();
    await serverCreditPort(db, OPTIONS).settle("res-1", 0.0123456789, true);
    expect(calls[0].args).toEqual({
      p_reservation_id: "res-1",
      p_actual_cost_usd: 0.012346,
      p_succeeded: true,
    });
  });

  it("un échec se solde à false, et garde son coût", async () => {
    const { db, calls } = client();
    await serverCreditPort(db, OPTIONS).settle("res-1", 0.5, false);
    expect(calls[0].args).toMatchObject({ p_succeeded: false, p_actual_cost_usd: 0.5 });
  });

  /*
   * ⚠ UNE PANNE DE RÈGLEMENT REMONTE. Elle laisse une réservation ouverte, qui
   * tient un crédit ; l'avaler ferait disparaître ce crédit sans que personne
   * l'apprenne.
   */
  it("une erreur de règlement lève", async () => {
    const { db } = client({ settle: () => ({ data: null, error: { message: "nope" } }) });
    await expect(serverCreditPort(db, OPTIONS).settle("res-1", 0.1, true)).rejects.toThrow(
      "settle_credit: nope"
    );
  });
});

/*
 * ── ⚠ ET CE PORT NE RECALCULE AUCUN PLAFOND ─────────────────────────────
 *
 * Le quota est tenu par `credit_ledger_apply()`, qui lève `EK010`. Un plafond
 * recalculé ici serait un second arbitre — et celui des deux qu'on oublie de
 * mettre à jour est celui qui décide.
 */
describe("aucun plafond en TypeScript", () => {
  it("le module ne compte ni ne compare", () => {
    const src = readFileSync("lib/credits/server-port.ts", "utf8");
    const body = src.slice(src.indexOf("export function serverCreditPort"));
    for (const forbidden of ["POSTS_PER_MONTH", "monthly_limit", "consumed", "<=", ">="]) {
      expect(body, `le port applique un plafond (${forbidden}) au lieu de laisser le SQL décider`)
        .not.toContain(forbidden);
    }
  });
});
