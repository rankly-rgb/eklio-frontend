import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { arrivalDate, exportOpen, monthLabel, pagesScreen, parseMonthParam, searchLine, stateUnavailableText } from "@/lib/seo/screen";
import { applyPieceAction, editFindings, pieceActionSchema } from "@/lib/seo/actions";

const NOW = new Date("2026-11-12T15:00:00Z");

describe("l'écran Website pages", () => {
  it("sans abonnement ni historique : l'explication et l'offre", () => {
    expect(pagesScreen({ eligibility: { ok: true }, armed: true, entitled: false, hasHistory: false, monthHasPieces: false, month: "2026-11-01", now: NOW })).toEqual({ kind: "no_subscription" });
  });
  it("après résiliation : l'historique, en lecture seule", () => {
    expect(pagesScreen({ eligibility: { ok: true }, armed: true, entitled: false, hasHistory: true, monthHasPieces: true, month: "2026-10-01", now: NOW })).toEqual({ kind: "list", readOnly: true });
  });
  it("abonnée, rien encore : la date d'arrivée, pas un faux « en cours »", () => {
    expect(pagesScreen({ eligibility: { ok: true }, armed: true, entitled: true, hasHistory: false, monthHasPieces: false, month: "2026-11-01", now: NOW })).toEqual({
      kind: "not_yet",
      arrives: "December 1, 2026",
    });
    expect(arrivalDate(NOW)).toBe("December 1, 2026");
  });
  it("un mois passé vide reste vide", () => {
    expect(pagesScreen({ eligibility: { ok: true }, armed: true, entitled: true, hasHistory: true, monthHasPieces: false, month: "2026-09-01", now: NOW })).toEqual({ kind: "empty_month" });
  });
  it("le paramètre de mois", () => {
    expect(parseMonthParam("2026-12-01", NOW)).toBe("2026-12-01");
    expect(parseMonthParam("2026-12-15", NOW)).toBe("2026-11-01");
    expect(parseMonthParam(["2026-13-01"], NOW)).toBe("2026-11-01");
    expect(monthLabel("2026-12-01")).toBe("December 2026");
  });
  it("pas de jargon : la requête se dit en mots à elle", () => {
    expect(searchLine("EMDR therapy in Oakland, CA")).toBe("For people searching “EMDR therapy in Oakland, CA”");
  });
  it("l'export ne s'ouvre qu'après la relecture", () => {
    expect(exportOpen("needs_review")).toBe(false);
    expect(exportOpen("approved")).toBe(true);
    expect(exportOpen("published")).toBe(true);
  });
});

describe("les gestes", () => {
  it("approuver exige la case cochée", () => {
    expect(pieceActionSchema.safeParse({ action: "approve" }).success).toBe(false);
    expect(pieceActionSchema.safeParse({ action: "approve", reviewed: false }).success).toBe(false);
    expect(pieceActionSchema.safeParse({ action: "approve", reviewed: true }).success).toBe(true);
  });
  it("une adresse publiée est une vraie URL", () => {
    expect(pieceActionSchema.safeParse({ action: "publish", url: "my site" }).success).toBe(false);
    expect(pieceActionSchema.safeParse({ action: "publish", url: "https://her.site/emdr" }).success).toBe(true);
  });
  it("un corps modifié passe par les phrases bannies ET l'Ethics Guard", async () => {
    const seen: string[] = [];
    const findings = await editFindings("text", {
      bannedPhrases: async (t) => (seen.push(`banned:${t}`), ["safe space"]),
      ethicsBlocks: async (t) => (seen.push(`ethics:${t}`), [{ rule: "proven", excerpt: "guaranteed" }]),
    });
    expect(seen.sort()).toEqual(["banned:text", "ethics:text"]);
    expect(findings.map((f) => f.check)).toEqual(["banned_phrase", "ethics.proven"]);
  });

  function fakeClient(result: { data: unknown; error: { code?: string; message: string } | null }) {
    const calls: Array<Record<string, unknown>> = [];
    const client = {
      from: () => ({
        update: (patch: Record<string, unknown>) => {
          calls.push(patch);
          return { eq: () => ({ select: async () => result }) };
        },
      }),
      rpc: async () => ({ data: null, error: null }),
    };
    return { client, calls };
  }

  it("on ne modifie plus le texte après l'approbation", async () => {
    const { client, calls } = fakeClient({ data: [{ id: "x" }], error: null });
    const r = await applyPieceAction(client, "x", { action: "edit", body_md: "y".repeat(300) }, "approved");
    expect(r).toMatchObject({ ok: false, status: 409 });
    expect(calls).toEqual([]);
  });
  it("copier une pièce relue la marque copiée, une fois", async () => {
    const { client, calls } = fakeClient({ data: [{ id: "x" }], error: null });
    expect(await applyPieceAction(client, "x", { action: "export" }, "approved")).toEqual({ ok: true });
    expect(calls).toEqual([{ status: "exported" }]);
    const again = fakeClient({ data: [{ id: "x" }], error: null });
    expect(await applyPieceAction(again.client, "x", { action: "export" }, "exported")).toEqual({ ok: true });
    expect(again.calls).toEqual([]);
  });
  it("zéro ligne touchée (pas la sienne, ou plus d'abonnement) : 404", async () => {
    const { client } = fakeClient({ data: [], error: null });
    expect(await applyPieceAction(client, "x", { action: "approve", reviewed: true }, "needs_review")).toMatchObject({ ok: false, status: 404 });
  });
  it("un refus de la garde éthique de la base se dit en clair", async () => {
    const { client } = fakeClient({ data: null, error: { code: "23514", message: "Advertising ethics: guarantee" } });
    const r = await applyPieceAction(client, "x", { action: "edit", body_md: "y".repeat(300) }, "needs_review");
    expect(r).toMatchObject({ ok: false, status: 400 });
    expect((r as { message: string }).message).toMatch(/license/);
  });
});

describe("les États non vérifiés (session 3) — les quatre cas", () => {
  const base = { hasHistory: false, monthHasPieces: false, month: "2026-11-01", now: NOW };
  const verified = { ok: true } as const;
  const newYork = { ok: false, reason: "state_unverified", state: "NY" } as const;

  it("1. État vérifié, avec abonnement : la date d'arrivée", () => {
    expect(pagesScreen({ ...base, entitled: true, eligibility: verified, armed: true })).toEqual({ kind: "not_yet", arrives: "December 1, 2026" });
  });
  it("2. État vérifié, sans abonnement : l'offre", () => {
    expect(pagesScreen({ ...base, entitled: false, eligibility: verified, armed: true })).toEqual({ kind: "no_subscription" });
  });
  it("3. État non vérifié, avec abonnement : pas de date, pas de promesse", () => {
    const screen = pagesScreen({ ...base, entitled: true, eligibility: newYork, armed: true });
    expect(screen).toEqual({ kind: "state_unavailable", state: "New York" });
    const text = stateUnavailableText("New York");
    expect(text).toBe(
      "Website pages aren't available yet for clinicians licensed in New York. Nothing is generated or counted for you until they are."
    );
    expect(text).not.toMatch(/\d|arrive|soon|coming/i);
  });
  it("4. drapeau éteint : l'écran dit la même chose qu'allumé, dans les trois cas", () => {
    for (const [entitled, eligibility] of [[true, verified], [false, verified], [true, newYork]] as const) {
      expect(pagesScreen({ ...base, entitled, eligibility, armed: false })).toEqual(pagesScreen({ ...base, entitled, eligibility, armed: true }));
    }
  });
  it("un État non vérifié ne reçoit pas l'offre « three pages every month » ; son historique reste lisible", () => {
    expect(pagesScreen({ ...base, entitled: false, eligibility: newYork, armed: true })).toEqual({ kind: "state_unavailable", state: "New York" });
    expect(pagesScreen({ ...base, hasHistory: true, monthHasPieces: true, entitled: false, eligibility: newYork, armed: true })).toEqual({
      kind: "list",
      readOnly: true,
    });
  });
});

describe("l'écran et le pipeline lisent la même source (session 3)", () => {
  const root = resolve(__dirname, "../../..");
  const src = (f: string) => readFileSync(resolve(root, f), "utf8");
  it("le pipeline refuse par `licenceEligibility`, et n'a plus sa propre lecture de l'État", () => {
    const ctx = src("lib/seo/context.ts");
    const body = ctx.slice(ctx.indexOf("export async function readSeoContext"));
    expect(body).toContain("await licenceEligibility(db, kit.projectId)");
    expect(body).not.toContain("stateVerified(");
  });
  it("l'écran décide de son message par `licenceEligibility`", () => {
    const page = src("app/app/pages/page.tsx");
    expect(page).toContain("await licenceEligibility(seoDb(supabase), kit.projectId)");
    expect(page).toContain("eligibility,");
  });
});
