import { describe, expect, it } from "vitest";
import { SpendCapReached } from "@/lib/content/generate/openai";
import { runSeoMonth, type PieceInsert, type PipelineInput, type PipelinePorts } from "@/lib/seo/pipeline";
import type { SeoWriterPort, SeoWriteRequest } from "@/lib/seo/writer";
import type { StoredCandidate } from "@/lib/seo/plan";
import type { SeoKind } from "@/lib/seo/kinds";
import { fixtureOutput } from "@/lib/seo/__tests__/fixture-output";

/*
 * Le pipeline ENTIER — réservation, livre, rédaction, contrôles, réécriture,
 * quarantaine, écriture — avec des doublures de ports et de rédacteur. Aucune
 * base, aucun modèle : ce que ce fichier prouve est l'ENCHAÎNEMENT. Le vrai
 * chemin (base locale + OpenAI) est éprouvé à part et rapporté dans SAMPLES/.
 */

function target(id: string, kind: SeoKind, query: string): StoredCandidate {
  return {
    id,
    kind,
    templateId: kind === "local_page" ? "local_modality_city" : id,
    modalityKey: "emdr",
    populationKey: null,
    state: kind === "local_page" ? "CA" : null,
    city: kind === "local_page" ? "Oakland" : null,
    primaryQuery: query,
    intentKey: `${kind}:${id}`,
    priority: 10,
    modalityRank: 0,
    populationRank: 0,
  };
}

const LOCAL = target("t-local", "local_page", "EMDR therapy in Oakland, CA");
const ART1 = target("t-art1", "article", "how EMDR therapy works");
const ART2 = target("t-art2", "article", "what to expect in a first EMDR therapy session");

function input(writer: SeoWriterPort, chosen = { local_page: [LOCAL], article: [ART1, ART2] }): PipelineInput {
  return {
    ctx: {
      userId: "u1",
      brandKitId: "k1",
      projectId: "p1",
      grid: { modalityKeys: ["emdr"], populationKeys: [], state: "CA", city: "Oakland" },
      practitioner: { name: "Dana Whitfield", credential: "LMFT", licenceMention: "LMFT 123456" },
      brand: { practiceName: "Whitfield Therapy", positioning: "", usp: "", soundsLike: [], neverWrite: [] },
      builder: "squarespace",
      siteUrl: null,
      sources: [{ label: "NIMH", url: "https://www.nimh.nih.gov/news" }],
    },
    month: "2026-12-01",
    runId: "run-1",
    plan: { quota: { local_page: 1, article: 2 }, chosen, excluded: 0 },
    writer,
    ethicsRules: [],
    bannedList: [],
    terms: { modality: new Map([["emdr", "EMDR therapy"]]), population: new Map() },
  };
}

type Log = {
  claims: SeoKind[];
  released: Array<{ claimId: string; reason: string }>;
  assigned: string[];
  unassigned: string[];
  retired: string[];
  reserved: number;
  settled: Array<{ actual: number; ok: boolean }>;
  inserted: PieceInsert[];
};

function fakePorts(opts: { quota?: Record<SeoKind, number>; bookRefuses?: boolean; banned?: (t: string) => string[] } = {}) {
  const quota = { ...(opts.quota ?? { local_page: 1, article: 2 }) };
  const log: Log = { claims: [], released: [], assigned: [], unassigned: [], retired: [], reserved: 0, settled: [], inserted: [] };
  let n = 0;
  const ports: PipelinePorts = {
    async claim(kind) {
      log.claims.push(kind);
      if (quota[kind] <= 0) return { ok: false, reason: "quota_reached" };
      quota[kind] -= 1;
      n += 1;
      return { ok: true, reason: "claimed", claim_id: `00000000-0000-4000-8000-00000000000${n}` };
    },
    async release(claimId, reason) {
      log.released.push({ claimId, reason });
    },
    async assignTarget(id) {
      log.assigned.push(id);
    },
    async unassignTarget(id) {
      log.unassigned.push(id);
    },
    async retireTarget(id) {
      log.retired.push(id);
    },
    bannedPhrases: async (t) => opts.banned?.(t) ?? [],
    ethicsBlocks: async () => [],
    ownPieces: async () => [],
    peerPieces: async () => [],
    async reserveCost() {
      if (opts.bookRefuses) return null;
      log.reserved += 1;
      return `res-${log.reserved}`;
    },
    async settleCost(_id, actual, ok) {
      log.settled.push({ actual, ok });
    },
    async insertPiece(row) {
      log.inserted.push(row);
      return `piece-${log.inserted.length}`;
    },
  };
  return { ports, log };
}

/** Un rédacteur doublure : une sortie par appel, dans l'ordre donné. */
function fakeWriter(plan: Array<(req: SeoWriteRequest) => unknown | Error>) {
  const calls: SeoWriteRequest[] = [];
  const writer: SeoWriterPort = {
    model: "fixture-model",
    worstCaseUsd: () => 0.15,
    async write(req) {
      calls.push(req);
      const step = plan[Math.min(calls.length - 1, plan.length - 1)](req);
      if (step instanceof Error) throw step;
      return { output: step, problem: null, model: "fixture-model", costUsd: 0.05, usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 } };
    },
  };
  return { writer, calls };
}

const good = (seed: number) => (req: SeoWriteRequest) =>
  fixtureOutput({ query: req.brief.primaryQuery, seed, bodyWords: req.brief.kind === "local_page" ? 900 : 1300 });

const tooLongTitle = (req: SeoWriteRequest) => ({
  ...fixtureOutput({ query: req.brief.primaryQuery, seed: 99, bodyWords: req.brief.kind === "local_page" ? 900 : 1300 }),
  title: `${req.brief.primaryQuery} — everything a careful reader may want to know first`,
});

describe("le chemin nominal", () => {
  it("1 page locale + 2 articles, chacun par un emplacement réservé, au livre, en needs_review", async () => {
    let seed = 10;
    const { writer, calls } = fakeWriter([(r) => good(seed++)(r)]);
    const { ports, log } = fakePorts();
    const out = await runSeoMonth(ports, input(writer));

    expect(out.pieces.map((p) => p.status)).toEqual(["needs_review", "needs_review", "needs_review"]);
    expect(out.pieces.every((p) => p.firstPass && p.attempts === 1)).toBe(true);
    expect(calls).toHaveLength(3);
    expect(log.claims).toEqual(["local_page", "article", "article"]);
    expect(log.reserved).toBe(3);
    expect(log.settled).toEqual([{ actual: 0.05, ok: true }, { actual: 0.05, ok: true }, { actual: 0.05, ok: true }]);
    expect(out.costUsd).toBeCloseTo(0.15, 6);

    const local = log.inserted[0];
    expect(local.slot_id).toBe("00000000-0000-4000-8000-000000000001");
    expect(local.slug).toBe("emdr-therapy-oakland-ca");
    expect(local.schema_jsonld?.["@type"]).toBe("WebPage");
    expect(local.checklist.length).toBeGreaterThan(5);
    expect(local.body_md).not.toMatch(/^# /m);
    expect(log.inserted[1].schema_jsonld?.["@type"]).toBe("Article");
  });
});

describe("refus sans emplacement", () => {
  it("quota zéro : aucun appel au rédacteur, aucune écriture", async () => {
    const { writer, calls } = fakeWriter([good(1)]);
    const { ports, log } = fakePorts({ quota: { local_page: 0, article: 0 } });
    const out = await runSeoMonth(ports, input(writer));
    expect(calls).toHaveLength(0);
    expect(log.inserted).toHaveLength(0);
    expect(log.reserved).toBe(0);
    expect(out.pieces.map((p) => p.status)).toEqual(["not_claimed", "not_claimed"]);
  });

  it("le quatrième emplacement refusé arrête le genre, sans appel", async () => {
    let seed = 30;
    const { writer, calls } = fakeWriter([(r) => good(seed++)(r)]);
    const { ports } = fakePorts({ quota: { local_page: 1, article: 1 } });
    const out = await runSeoMonth(ports, input(writer));
    expect(calls).toHaveLength(2);
    expect(out.pieces.map((p) => p.status)).toEqual(["needs_review", "needs_review", "not_claimed"]);
  });

  it("le livre refuse la réservation : l'appel ne part pas, l'emplacement est rendu", async () => {
    const { writer, calls } = fakeWriter([good(1)]);
    const { ports, log } = fakePorts({ bookRefuses: true });
    const out = await runSeoMonth(ports, input(writer));
    expect(calls).toHaveLength(0);
    expect(log.released).toHaveLength(1);
    expect(log.unassigned).toEqual(["t-local"]);
    expect(out.stopped).toMatch(/cost book/);
  });
});

describe("réécriture ciblée, puis quarantaine — jamais de boucle", () => {
  it("un échec puis un succès : deux appels, le second porte le rapport", async () => {
    const { writer, calls } = fakeWriter([tooLongTitle, good(40)]);
    const { ports, log } = fakePorts();
    const out = await runSeoMonth(ports, input(writer, { local_page: [LOCAL], article: [] }));
    expect(calls).toHaveLength(2);
    expect(calls[1].failure?.findings.map((f) => f.check)).toContain("seo.title_length");
    expect(out.pieces[0]).toMatchObject({ status: "needs_review", attempts: 2, firstPass: false });
    expect(log.inserted[0].gates_report).toMatchObject({ passed: true, attempts: 2, first_pass: false });
    expect(log.reserved).toBe(2);
  });

  it("deux échecs : quarantaine, cible retirée, aucun troisième appel", async () => {
    const { writer, calls } = fakeWriter([tooLongTitle]);
    const { ports, log } = fakePorts();
    const out = await runSeoMonth(ports, input(writer, { local_page: [LOCAL], article: [] }));
    expect(calls).toHaveLength(2);
    expect(out.pieces[0]).toMatchObject({ status: "quarantined", attempts: 2 });
    expect(log.inserted[0].status).toBe("quarantined");
    expect(log.inserted[0].gates_report).toMatchObject({ passed: false, reason: "seo.title_length" });
    expect(log.retired).toEqual(["t-local"]);
    // ⚠ l'emplacement est rendu PAR LA BASE (trigger seo_pieces_slot_gate), pas ici
    expect(log.released).toEqual([]);
  });

  it("une phrase bannie déclenche la réécriture avec la phrase nommée", async () => {
    let first = true;
    const { writer, calls } = fakeWriter([good(50), good(51)]);
    const { ports } = fakePorts({
      banned: () => {
        if (first) {
          first = false;
          return ["safe space"];
        }
        return [];
      },
    });
    await runSeoMonth(ports, input(writer, { local_page: [LOCAL], article: [] }));
    expect(calls[1].failure?.findings).toContainEqual({ check: "banned_phrase", detail: 'remove the phrase "safe space".' });
  });

  it("une sortie hors schéma est un échec de contrôle, pas une panne", async () => {
    const { writer, calls } = fakeWriter([() => ({ title: "x" }), () => ({ nope: true })]);
    const { ports, log } = fakePorts();
    const out = await runSeoMonth(ports, input(writer, { local_page: [LOCAL], article: [] }));
    expect(calls).toHaveLength(2);
    expect(out.pieces[0].status).toBe("quarantined");
    expect(log.inserted[0].title).toBeNull();
    expect(log.inserted[0].faq).toBeNull();
  });
});

describe("une panne du fournisseur n'est pas un échec de pièce", () => {
  it("plafond atteint : emplacement rendu, cible remise disponible, mois arrêté, pas de quarantaine", async () => {
    const { writer } = fakeWriter([() => new SpendCapReached("plafond de session")]);
    const { ports, log } = fakePorts();
    const out = await runSeoMonth(ports, input(writer));
    expect(out.stopped).toMatch(/plafond/);
    expect(out.pieces).toHaveLength(1);
    expect(log.released).toHaveLength(1);
    expect(log.unassigned).toEqual(["t-local"]);
    expect(log.retired).toEqual([]);
    expect(log.inserted).toEqual([]);
    expect(log.settled).toEqual([{ actual: 0, ok: false }]);
  });
});
