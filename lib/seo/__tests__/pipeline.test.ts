import { describe, expect, it } from "vitest";
import { SpendCapReached } from "@/lib/content/generate/openai";
import { repairableFields, runSeoMonth, type PieceInsert, type PipelineInput, type PipelinePorts } from "@/lib/seo/pipeline";
import type { FieldRepairRequest, SeoWriterPort, SeoWriteRequest } from "@/lib/seo/writer";
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
      practitioner: { name: "Dana Whitfield", credential: "LMFT", licenceMention: "LMFT 123456", title: "Licensed Marriage and Family Therapist", doctorate: false },
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

function fakePorts(opts: { quota?: Record<SeoKind, number>; bookRefuses?: boolean; banned?: (t: string) => string[]; taken?: string[] } = {}) {
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
      return !opts.taken?.includes(id);
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
function fakeWriter(plan: Array<(req: SeoWriteRequest) => unknown | Error>, repair?: (req: FieldRepairRequest) => string | null) {
  const calls: SeoWriteRequest[] = [];
  const repairs: FieldRepairRequest[] = [];
  const writer: SeoWriterPort = {
    model: "fixture-model",
    worstCaseUsd: () => 0.15,
    worstCaseRepairUsd: () => 0.02,
    async repairField(req) {
      repairs.push(req);
      const value = repair ? repair(req) : null;
      return { value, model: "fixture-model", costUsd: 0.005, usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 } };
    },
    async write(req) {
      calls.push(req);
      const step = plan[Math.min(calls.length - 1, plan.length - 1)](req);
      if (step instanceof Error) throw step;
      return { output: step, problem: null, model: "fixture-model", costUsd: 0.05, usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 } };
    },
  };
  return { writer, calls, repairs };
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
    // Les trois cibles demandent leur emplacement en parallèle (session 3) ; la base refuse les trois.
    expect(out.pieces.map((p) => p.status)).toEqual(["not_claimed", "not_claimed", "not_claimed"]);
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
    // Les trois emplacements pris en parallèle sont tous rendus, et leurs cibles aussi.
    expect(log.released).toHaveLength(3);
    expect(log.unassigned).toEqual(["t-local", "t-art1", "t-art2"]);
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
    expect(log.inserted[0].gates_report).toMatchObject({ passed: true, attempts: 2, first_pass: false, stage: "rewrite" });
    // Session 3 : la réparation du title a été tentée d'abord (elle n'a rien rendu), d'où trois réservations.
    expect(log.reserved).toBe(3);
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

describe("ses pages ne répondent pas deux fois à la même question", () => {
  it("le second article qui reprend une question du premier est réécrit, avec la question nommée — et le brief la donnait déjà", async () => {
    const shared = { question: "Do I have to share every detail of a difficult experience?", answer: "No, you do not have to share every detail." };
    let seed = 60;
    const withShared = (req: SeoWriteRequest) => {
      const out = good(seed++)(req);
      return { ...out, faq: [...out.faq.slice(0, 3), shared] };
    };
    const { writer, calls } = fakeWriter([withShared, withShared, good(70)]);
    const { ports } = fakePorts();
    const out = await runSeoMonth(ports, input(writer, { local_page: [], article: [ART1, ART2] }));
    // Les deux premiers jets partent ensemble : le second ne voit que la REQUÊTE de son aîné…
    expect(calls[1].brief.siblingQueries).toContain(ART1.primaryQuery);
    // … le contrôle, lui, passe dans l'ordre et voit la question ; la réécriture la reçoit.
    expect(calls[2].failure?.findings.map((f) => f.check)).toContain("gate.question_repeated");
    expect(calls[2].brief.answeredElsewhere).toContain(shared.question);
    expect(out.pieces.map((p) => p.status)).toEqual(["needs_review", "needs_review"]);
  });
});

describe("les questions déjà sur son site : les plus récentes d'abord (session 2)", () => {
  it("le brief de réécriture du troisième texte liste les questions du deuxième avant celles du premier", async () => {
    const withBanned = (req: SeoWriteRequest) => ({ ...good(82)(req), intro: `${good(82)(req).intro} zzbanned` });
    const { writer, calls } = fakeWriter([good(80), good(81), withBanned, good(83)]);
    const { ports, log } = fakePorts({ banned: (t) => (t.includes("zzbanned") ? ["zzbanned"] : []) });
    await runSeoMonth(ports, input(writer));
    expect(calls[3].failure).toBeDefined();
    const list = calls[3].brief.answeredElsewhere;
    const firstOf = (row: PieceInsert) => (row.faq ?? [])[0].question;
    expect(list.indexOf(firstOf(log.inserted[1]))).toBeGreaterThan(-1);
    expect(list.indexOf(firstOf(log.inserted[1]))).toBeLessThan(list.indexOf(firstOf(log.inserted[0])));
  });
});

describe("la réparation du seul champ fautif (session 3)", () => {
  const shortTitle = (req: FieldRepairRequest) => req.primaryQuery;

  it("un title trop long est réparé par un appel court, sans réécrire la pièce", async () => {
    const { writer, calls, repairs } = fakeWriter([tooLongTitle], shortTitle);
    const { ports, log } = fakePorts();
    const out = await runSeoMonth(ports, input(writer, { local_page: [LOCAL], article: [] }));
    expect(calls).toHaveLength(1);
    expect(repairs.map((r) => r.field)).toEqual(["title"]);
    expect(out.pieces[0]).toMatchObject({ status: "needs_review", firstPass: false, stage: "field_repair", attempts: 1 });
    expect(log.inserted[0].gates_report).toMatchObject({ stage: "field_repair", repaired_fields: ["title"] });
    expect(log.inserted[0].title).toBe("EMDR therapy in Oakland, CA");
    expect(out.pieces[0].costUsd).toBeCloseTo(0.055, 6);
  });

  it("le champ réparé repasse par TOUS les contrôles : une phrase bannie renvoie à la réécriture complète", async () => {
    const { writer, calls, repairs } = fakeWriter([tooLongTitle, good(90)], () => "EMDR therapy in Oakland, CA: a safe space");
    const { ports } = fakePorts({ banned: (t) => (t.includes("a safe space") ? ["safe space"] : []) });
    const out = await runSeoMonth(ports, input(writer, { local_page: [LOCAL], article: [] }));
    expect(repairs).toHaveLength(1);
    expect(calls).toHaveLength(2);
    expect(calls[1].failure?.findings.map((f) => f.check)).toContain("banned_phrase");
    expect(out.pieces[0]).toMatchObject({ status: "needs_review", stage: "rewrite" });
  });

  it("un constat hors meta et title : pas de réparation, réécriture complète directement", async () => {
    let first = true;
    const { writer, calls, repairs } = fakeWriter([tooLongTitle, good(91)], shortTitle);
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
    expect(repairs).toHaveLength(0);
    expect(calls).toHaveLength(2);
  });

  it("réparation échouée, réécriture échouée : quarantaine, jamais de troisième appel complet", async () => {
    const { writer, calls, repairs } = fakeWriter([tooLongTitle], () => null);
    const { ports, log } = fakePorts();
    const out = await runSeoMonth(ports, input(writer, { local_page: [LOCAL], article: [] }));
    expect(repairs).toHaveLength(1);
    expect(calls).toHaveLength(2);
    expect(out.pieces[0]).toMatchObject({ status: "quarantined", stage: null });
    expect(log.retired).toEqual(["t-local"]);
  });

  it("seuls la meta et le title se réparent", () => {
    expect(repairableFields([{ check: "seo.meta_length", detail: "the meta description is 132 characters" }])).toEqual(["meta_description"]);
    expect(repairableFields([{ check: "seo.query_missing", detail: 'the title must contain the exact phrase "x".' }])).toEqual(["title"]);
    expect(repairableFields([{ check: "seo.query_missing", detail: 'the h1 must contain the exact phrase "x".' }])).toBeNull();
    expect(repairableFields([{ check: "seo.meta_length", detail: "" }, { check: "structure.word_count", detail: "" }])).toBeNull();
  });
});

describe("une panne du fournisseur n'est pas un échec de pièce", () => {
  it("plafond atteint : emplacement rendu, cible remise disponible, mois arrêté, pas de quarantaine", async () => {
    const { writer } = fakeWriter([() => new SpendCapReached("plafond de session")]);
    const { ports, log } = fakePorts();
    const out = await runSeoMonth(ports, input(writer));
    expect(out.stopped).toMatch(/plafond/);
    // Les trois premiers jets étaient partis ensemble : trois emplacements rendus, aucun écrit.
    expect(out.pieces.map((p) => p.status)).toEqual(["stopped", "stopped", "stopped"]);
    expect(log.released).toHaveLength(3);
    expect(log.unassigned).toEqual(["t-local", "t-art1", "t-art2"]);
    expect(log.retired).toEqual([]);
    expect(log.inserted).toEqual([]);
    expect(log.settled).toEqual([{ actual: 0, ok: false }, { actual: 0, ok: false }, { actual: 0, ok: false }]);
  });

  it("une panne sur un jet n'efface pas les autres déjà payés : ils sont contrôlés et écrits, sans nouvel appel", async () => {
    const { writer, calls } = fakeWriter([good(90), () => new SpendCapReached("plafond"), tooLongTitle]);
    const { ports, log } = fakePorts();
    const out = await runSeoMonth(ports, input(writer));
    expect(out.pieces.map((p) => p.status)).toEqual(["needs_review", "stopped", "stopped"]);
    expect(calls).toHaveLength(3); // le title trop long ne déclenche AUCUN appel de réparation après la panne
    expect(log.inserted).toHaveLength(1);
    expect(log.released).toHaveLength(2);
  });
});

describe("le débit (session 3) : les pièces d'une abonnée partent ensemble, sans doublon", () => {
  it("les trois premiers jets sont en vol en même temps", async () => {
    let inFlight = 0;
    let peak = 0;
    let seed = 100;
    const base = fakeWriter([(r) => good(seed++)(r)]).writer;
    const writer: SeoWriterPort = {
      ...base,
      async write(req) {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight -= 1;
        return base.write(req);
      },
    };
    const { ports } = fakePorts();
    const out = await runSeoMonth(ports, input(writer));
    expect(peak).toBe(3);
    expect(out.pieces.map((p) => p.status)).toEqual(["needs_review", "needs_review", "needs_review"]);
  });

  it("une cible qu'une autre exécution tient déjà : emplacement rendu, aucun appel", async () => {
    let seed = 110;
    const { writer, calls } = fakeWriter([(r) => good(seed++)(r)]);
    const { ports, log } = fakePorts({ taken: ["t-art1"] });
    const out = await runSeoMonth(ports, input(writer));
    expect(calls).toHaveLength(2);
    expect(out.pieces.map((p) => [p.status, p.detail ?? null])).toEqual([
      ["needs_review", null],
      ["not_claimed", "target_taken"],
      ["needs_review", null],
    ]);
    expect(log.released.map((r) => r.reason)).toEqual(["target already assigned by another run"]);
  });
});
