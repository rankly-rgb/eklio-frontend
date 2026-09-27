import { describe, expect, it, vi } from "vitest";
import { selectDueMonths, type Candidate, type DuePort } from "@/lib/content/month/due";
import type { MonthStatus } from "@/lib/content/month/preflight";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  L'ÉNUMÉRATION — LA DÉCISION PRODUIT DU 2026-09-27
 * ══════════════════════════════════════════════════════════════════════════
 *
 *   le cron mensuel ne génère que pour les comptes dont l'abonnement est actif et
 *   le quota non épuisé, un mois par compte et par mois, idempotent sur
 *   (compte, mois). Un compte déjà servi n'est jamais resservi, même si le cron
 *   rejoue.
 *
 * ⚠ CE QUI EST ÉPROUVÉ ICI EST SURTOUT UNE ABSENCE DE DÉPENSE : les comptes écartés
 * ne doivent pas figurer dans `due`, et chaque écart doit porter sa raison. Un
 * rapport qui ne compte pas ce qu'il a écarté ne dit rien.
 */

const MONTH = "2027-12-01";
const NOW = new Date("2027-11-20T00:00:00Z");

function account(n: number, over: Partial<Candidate> = {}): Candidate {
  return {
    userId: `user-${n}`,
    projectId: `proj-${n}`,
    brandKitId: `kit-${n}`,
    subscription: { status: "active", currentPeriodEnd: null } as never,
    ...over,
  };
}

function port(over: {
  candidates?: Candidate[];
  status?: Record<string, MonthStatus | null>;
  quota?: Record<string, { remaining: number | null; unlimited: boolean }>;
} = {}) {
  const statusCalls: string[] = [];
  const quotaCalls: string[] = [];
  const p: DuePort = {
    candidates: vi.fn(async () => over.candidates ?? [account(1)]),
    monthStatus: vi.fn(async (kit) => {
      statusCalls.push(kit);
      return over.status?.[kit] ?? null;
    }),
    quotaRemaining: vi.fn(async (user) => {
      quotaCalls.push(user);
      return over.quota?.[user] ?? { remaining: 30, unlimited: false };
    }),
  };
  return { port: p, statusCalls, quotaCalls };
}

const run = (p: DuePort) => selectDueMonths(p, { month: MONTH, now: NOW, posts: 30 });

describe("l'abonnement décide, et la règle n'est pas réécrite", () => {
  it.each([
    ["active", true],
    ["trialing", true],
    ["canceled", false],
    ["incomplete", false],
    ["unpaid", false],
  ])("un abonnement %s : dû = %s", async (status, expected) => {
    const { port: p } = port({
      candidates: [account(1, { subscription: { status, currentPeriodEnd: null } as never })],
    });
    const out = await run(p);
    expect(out.due.length === 1).toBe(expected);
    if (!expected) expect(out.skipped[0].reason).toBe("not_entitled");
  });

  it("aucun abonnement : écarté, et la raison le dit", async () => {
    const { port: p } = port({ candidates: [account(1, { subscription: null })] });
    const out = await run(p);
    expect(out.due).toEqual([]);
    expect(out.skipped[0]).toMatchObject({ reason: "not_entitled", detail: "aucun abonnement" });
  });

  /*
   * ⚠ LE DÉLAI DE GRÂCE D'UN `past_due` VIENT DE `isEntitledToMonthlyPresence`, et
   * ce test existe pour prouver qu'on ne l'a pas réécrit : un compte en souffrance
   * dont la période payée n'est pas close garde son mois.
   */
  it("un past_due dans sa période payée reste dû", async () => {
    const { port: p } = port({
      candidates: [
        account(1, {
          subscription: {
            status: "past_due",
            currentPeriodEnd: "2027-11-25T00:00:00Z",
          } as never,
        }),
      ],
    });
    expect((await run(p)).due).toHaveLength(1);
  });

  it("un past_due sans fin de période connue n'ouvre rien", async () => {
    const { port: p } = port({
      candidates: [
        account(1, { subscription: { status: "past_due", currentPeriodEnd: null } as never }),
      ],
    });
    expect((await run(p)).due).toEqual([]);
  });
});

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  UN COMPTE DÉJÀ SERVI N'EST JAMAIS RESSERVI
 * ══════════════════════════════════════════════════════════════════════════
 */
describe("ce qui compte comme déjà servi", () => {
  it.each([
    ["proposed", false],
    ["approved", false],
  ])("un mois %s : jamais resservi", async (status) => {
    const { port: p } = port({ status: { "kit-1": status as MonthStatus } });
    const out = await run(p);
    expect(out.due).toEqual([]);
    expect(out.skipped[0]).toMatchObject({ reason: "already_served", detail: status });
  });

  /*
   * ⚠ `generating` EST LE SIGNAL « ELLE A PAYÉ ET ATTEND », PAS « C'EST FAIT ».
   * `queue.ts`, appelé par le webhook Stripe à l'achat, pose cette ligne AVANT toute
   * génération. Un cron qui l'écarterait ne servirait jamais un premier mois — c'est
   * le défaut F54, vu depuis l'autre bout.
   */
  it("un mois generating est dû : c'est la ligne posée à l'achat", async () => {
    const { port: p } = port({ status: { "kit-1": "generating" } });
    expect((await run(p)).due).toHaveLength(1);
  });

  /*
   * ⚠ ET `failed` EST DÛ. Ne pas le reprendre laisserait une praticienne qui a payé
   * sans rien ce mois-là ; le reprendre est peu coûteux, puisque le journal porte
   * les réponses déjà payées et que `findResumableRun` les relit.
   */
  it("un mois failed est dû, le journal rendant la reprise peu coûteuse", async () => {
    const { port: p } = port({ status: { "kit-1": "failed" } });
    expect((await run(p)).due).toHaveLength(1);
  });

  it("aucun mois du tout est dû", async () => {
    const { port: p } = port({ status: { "kit-1": null } });
    expect((await run(p)).due).toHaveLength(1);
  });
});

describe("le quota", () => {
  it("épuisé : écarté, et la raison dit les deux nombres", async () => {
    const { port: p } = port({ quota: { "user-1": { remaining: 12, unlimited: false } } });
    const out = await run(p);
    expect(out.due).toEqual([]);
    expect(out.skipped[0].reason).toBe("quota_exhausted");
    expect(out.skipped[0].detail).toContain("12 restant(s) pour 30 promis");
  });

  /*
   * ⚠ « PAS DE BORNE » N'EST PAS « RIEN DE RESTANT ». Lire `remaining` seul
   * écarterait tous les comptes sans plafond — le défaut que le préalable a déjà
   * corrigé une fois.
   */
  it("un compte sans plafond reste dû, même sans remaining", async () => {
    const { port: p } = port({ quota: { "user-1": { remaining: null, unlimited: true } } });
    expect((await run(p)).due).toHaveLength(1);
  });

  it("pile le compte promis passe", async () => {
    const { port: p } = port({ quota: { "user-1": { remaining: 30, unlimited: false } } });
    expect((await run(p)).due).toHaveLength(1);
  });
});

/*
 * ⚠ L'ORDRE DES TROIS LECTURES COMPTE POUR LE MESSAGE, pas pour le verdict. Un mois
 * déjà livré a CONSOMMÉ son quota : demander le quota d'abord l'écarterait pour
 * « quota épuisé », ce qui envoie chercher un problème de facturation là où le mois
 * est simplement fait.
 */
describe("l'ordre des lectures", () => {
  it("un mois servi est écarté comme servi, pas comme sans quota", async () => {
    const { port: p, quotaCalls } = port({
      status: { "kit-1": "approved" },
      quota: { "user-1": { remaining: 0, unlimited: false } },
    });
    const out = await run(p);
    expect(out.skipped[0].reason).toBe("already_served");
    expect(quotaCalls, "le quota a été lu pour un mois déjà fait").toEqual([]);
  });

  it("un compte sans abonnement ne coûte aucune autre lecture", async () => {
    const { port: p, statusCalls, quotaCalls } = port({
      candidates: [account(1, { subscription: null })],
    });
    await run(p);
    expect(statusCalls).toEqual([]);
    expect(quotaCalls).toEqual([]);
  });
});

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  UN MOIS PAR COMPTE ET PAR MOIS
 * ══════════════════════════════════════════════════════════════════════════
 */
describe("un mois par compte", () => {
  it("un kit rendu deux fois n'est généré qu'une", async () => {
    const { port: p } = port({ candidates: [account(1), account(1)] });
    const out = await run(p);
    expect(out.due).toHaveLength(1);
    expect(out.skipped[0].reason).toBe("duplicate_kit");
  });

  it("plusieurs comptes sont tous dus, dans l'ordre reçu", async () => {
    const { port: p } = port({ candidates: [account(1), account(2), account(3)] });
    const out = await run(p);
    expect(out.due.map((c) => c.brandKitId)).toEqual(["kit-1", "kit-2", "kit-3"]);
  });

  it("un compte écarté n'empêche pas les suivants", async () => {
    const { port: p } = port({
      candidates: [account(1, { subscription: null }), account(2), account(3)],
      status: { "kit-2": "approved" },
    });
    const out = await run(p);
    expect(out.due.map((c) => c.brandKitId)).toEqual(["kit-3"]);
    expect(out.skipped.map((s) => s.reason)).toEqual(["not_entitled", "already_served"]);
  });

  it("aucun candidat rend une liste vide, pas une erreur", async () => {
    const { port: p } = port({ candidates: [] });
    expect(await run(p)).toEqual({ due: [], skipped: [] });
  });
});

/*
 * ⚠ ET L'IDEMPOTENCE N'EST PAS TENUE PAR CE MODULE — un test le dit, pour qu'aucune
 * session ne relise cette sélection comme la garantie. Deux invocations simultanées
 * passeraient toutes deux ; c'est `content_months_kit_month_key` qui refuse la
 * seconde, et le journal qui RATTACHE au lieu de repayer.
 */
describe("ce que cette sélection ne garantit pas", () => {
  it("deux appels successifs rendent le même compte dû tant que rien n'a été écrit", async () => {
    const { port: p } = port({ status: { "kit-1": null } });
    expect((await run(p)).due).toHaveLength(1);
    expect((await run(p)).due, "la sélection n'est pas la garantie d'unicité").toHaveLength(1);
  });

  it("et elle le devient dès que la base porte un mois servi", async () => {
    const { port: p } = port({ status: { "kit-1": "proposed" } });
    expect((await run(p)).due).toEqual([]);
  });
});
