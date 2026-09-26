import { beforeEach, describe, expect, it, vi } from "vitest";
import { cardPalette } from "@/lib/compose/palette";
import {
  orchestrateMonth,
  type OrchestratePorts,
  type WriterPort,
  type WrittenPost,
} from "@/lib/content/month/orchestrate";
import type { DrawnTopic } from "@/lib/content/month/draw";
import type { CreditPort } from "@/lib/credits/paid-call";
import type { JournalDb } from "@/lib/content/month/journal-port";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  L'ENCHAÎNEMENT ENTIER, SANS DÉPENSER UN CENTIME
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ LA RÉDACTION EST LE SEUL PORT PAYANT, ET C'EST TOUT L'INTÉRÊT. Une doublure
 * de `WriterPort` permet d'éprouver le préalable, la reprise, le tirage, la
 * composition, les trente contrôles, l'écriture et le crédit — c'est-à-dire tout
 * ce que la praticienne paie — sans un appel de modèle. Le compte fournisseur est
 * sous limite d'usage jusqu'au 1ᵉʳ octobre ; ces tests tournent quand même.
 *
 * ⚠ UNE DOUBLURE DANS UN TEST N'EST PAS UN STUB DANS LE PRODUIT. `orchestrate.ts`
 * n'embarque aucune implémentation de `WriterPort`. Tant qu'aucune n'existe côté
 * produit, la route reste en 501, et deux serrures du recensement le vérifient.
 */

const DIRECTION = {
  primary: "#2B2724",
  secondary: "#7A6A56",
  light: "#EFE9DF",
  dark: "#1C1A17",
  paper: "#F7F3EC",
};

const MENTION = "LMFT 12345";
const KIT = "kit-1";
const MONTH = "2027-07-01";

const TITLES = [
  "What burnout actually costs",
  "Where grief hides in the body",
  "Rest is not a reward",
  "Boundaries are information",
  "Anger often arrives as fatigue",
  "The calm that is really vigilance",
];

function topic(n: number): DrawnTopic {
  return {
    id: `t${n}`,
    archetype_key: "single_statement",
    intent: "behind_the_practice",
    title: TITLES[(n - 1) % TITLES.length],
    hook: `crochet ${n}`,
  };
}

function written(n: number): WrittenPost {
  return {
    topicId: `t${n}`,
    cardLine: TITLES[(n - 1) % TITLES.length].slice(0, 30),
    payload: { statement: `${TITLES[(n - 1) % TITLES.length]}, and it shows up early.` },
    caption: `Une légende ordinaire, la ${n}.`,
    altText: `Un alternatif ${n}.`,
    rationale: "parce que",
    /* ⚠ Un surtitre vide est un défaut : le portillon refuse `eyebrow.empty`. */
    eyebrow: "BEHIND THE PRACTICE",
    usage: { input: 900, output: 300, cacheRead: 0, cacheWrite: 0 },
  };
}

/** Une base en mémoire pour les deux tables du journal, posable à la main. */
function journal() {
  const runs: Array<Record<string, unknown>> = [];
  const results: Array<Record<string, unknown>> = [];
  const table = (name: "content_generation_runs" | "content_generation_results") => {
    const rows = name === "content_generation_runs" ? runs : results;
    const query = () => {
      const eqs: Array<[string, unknown]> = [];
      const ins: Array<[string, unknown[]]> = [];
      const match = () =>
        rows.filter(
          (r) =>
            eqs.every(([c, v]) => r[c] === v) && ins.every(([c, vs]) => vs.includes(r[c]))
        );
      const q = {
        eq(c: string, v: unknown) { eqs.push([c, v]); return q; },
        in(c: string, vs: unknown[]) { ins.push([c, vs]); return q; },
        async maybeSingle() { return { data: match()[0] ?? null, error: null }; },
        then<R>(fn: (v: { data: unknown[] | null; error: null }) => R) {
          return Promise.resolve(fn({ data: match(), error: null }));
        },
      };
      return q;
    };
    return {
      select: () => query(),
      insert(payload: Record<string, unknown> | Array<Record<string, unknown>>) {
        const incoming = Array.isArray(payload) ? payload : [payload];
        for (const row of incoming) {
          rows.push({ id: `${name}-${rows.length + 1}`, settled: false, cost_usd: 0, ...row });
        }
        const last = rows[rows.length - 1];
        return {
          select: () => ({ maybeSingle: async () => ({ data: last, error: null }) }),
          then: <R,>(fn: (v: { error: null }) => R) => Promise.resolve(fn({ error: null })),
        };
      },
      update(patch: Record<string, unknown>) {
        const eqs: Array<[string, unknown]> = [];
        const ins: Array<[string, unknown[]]> = [];
        const f = {
          eq(c: string, v: unknown) { eqs.push([c, v]); return f; },
          in(c: string, vs: unknown[]) { ins.push([c, vs]); return f; },
          then<R>(fn: (v: { error: null }) => R) {
            for (const row of rows) {
              if (eqs.every(([c, v]) => row[c] === v) && ins.every(([c, vs]) => vs.includes(row[c]))) {
                Object.assign(row, patch);
              }
            }
            return Promise.resolve(fn({ error: null }));
          },
        };
        return f;
      },
    };
  };
  return { db: { from: table } as unknown as JournalDb, runs, results };
}

function world(over: { verified?: boolean; stock?: number; writer?: WriterPort } = {}) {
  const j = journal();
  const inserted: string[] = [];
  const reserved: string[] = [];
  const months: Array<{ id: string; status: string }> = [];
  const insertPort = vi.fn(async (row: { topicId: string }) => {
    inserted.push(row.topicId);
    return null;
  });
  const released: string[][] = [];
  const stock = over.stock ?? 4;
  const free = Array.from({ length: stock }, (_, i) => topic(i + 1));
  const assigned: DrawnTopic[] = [];

  const credits: CreditPort = {
    reserve: vi.fn(async (spec) => {
      reserved.push(spec.reason);
      return { ok: true as const, reservationId: `res-${reserved.length}` };
    }),
    settle: vi.fn(async () => {}),
  };

  const writer: WriterPort = over.writer ?? {
    write: vi.fn(async ({ topics }: { topics: DrawnTopic[] }) => ({
      posts: topics.map((t: DrawnTopic) => written(Number(t.id.slice(1)))),
      batchId: "batch-abc",
      costUsd: 0.32,
    })),
  };

  const ports: OrchestratePorts = {
    preflight: {
      monthStatus: async () => null,
      licenceFacts: async () => ({
        licenseTypeId: "lmft",
        licenseNumber: "12345",
        abbreviation: "LMFT",
      }),
      stateVerified: async () => over.verified ?? true,
      creditRemaining: async () => ({ remaining: 30, unlimited: false }),
      bank: {
        releaseStale: async () => 0,
        drawableCounts: async () => ({ single_statement: 500, carousel: 500, quadrant: 500 }),
      },
    } as unknown as OrchestratePorts["preflight"],
    draw: {
      assign: async () => {
        const t = free.shift();
        if (!t) return null;
        assigned.push(t);
        return t.id;
      },
      topic: async (id) => assigned.find((t) => t.id === id) ?? free.find((t) => t.id === id) ?? null,
    },
    journal: j.db,
    writer,
    openMonthRow: vi.fn(async () => {
      months.push({ id: "month-1", status: "generating" });
      return "month-1";
    }),
    closeMonthRow: vi.fn(async (id: string, status: string) => {
      const row = months.find((m) => m.id === id);
      if (row) row.status = status;
    }),
    assembleFor: () => ({
      insert: insertPort,
      credits,
    }),
    releaseTopics: vi.fn(async (ids) => {
      released.push(ids);
    }),
  };

  return { ports, journal: j, inserted, reserved, released, writer, credits, months };
}

const input = (over: Record<string, unknown> = {}) => ({
  brandKitId: KIT,
  projectId: "proj-1",
  userId: "user-1",
  month: MONTH,
  stateCode: "CA",
  wanted: 3,
  candidates: 4,
  perFamily: 4,
  families: { statement: ["single_statement"] },
  drawOrder: ["statement"],
  practitionerCap: 2,
  practitionerPayload: false,
  demand: { posts: 3, attempts: 1, rounds: 1 } as never,
  /*
   * ⚠ UNE VRAIE PALETTE, PAS UNE CHAÎNE. La première version passait « warm » —
   * repris des épreuves de l'assemblage, où `svg` est nul et où `checkTints` ne
   * tourne donc jamais. Ici les cartes sont VRAIMENT composées : le contrôle de
   * teintes lit `direction.paper` et la fixture le faisait lever. C'est le premier
   * contrôle que cet enchaînement exerce et que l'assemblage seul n'atteignait pas.
   */
  direction: DIRECTION as never,
  paletteFor: (i: number) => cardPalette(`card-${i}`, DIRECTION, false),
  practiceName: "Still Water",
  layoutFor: () => "statement",
  dates: ["2027-07-01", "2027-07-08", "2027-07-15", "2027-07-22"],
  context: {
    direction: DIRECTION,
    modalities: [],
    eyebrowCatalogue: [{ id: "behind_the_practice", label: "Behind the practice" }],
  } as never,
  identityAllowList: [] as string[],
  intentCatalogue: [{ id: "behind_the_practice", label: "Behind the practice" }],
  modalities: [] as string[],
  completeness: {},
  ...over,
});

describe("un mois sort de bout en bout", () => {
  it("le mois est écrit, et chaque carte porte la mention de licence", async () => {
    const w = world();
    const out = await orchestrateMonth(w.ports, input());
    expect(out.ok, out.ok ? "" : out.refusal).toBe(true);
    if (!out.ok) return;
    expect(out.month.written).toBe(3);
    expect(w.inserted).toHaveLength(3);
    /* ⚠ La mention est sur les trente, pas sur la première. */
    for (const post of out.month.inserted) {
      expect(post.footer, "une carte sans mention de licence").toContain(MENTION);
      expect(post.svg, "une carte sans SVG : elle n'est pas vectorielle").toContain("<svg");
      expect(post.svg).toContain("12345");
    }
  });

  it("un crédit par post écrit, pas un par tentative", async () => {
    const w = world();
    const out = await orchestrateMonth(w.ports, input());
    expect(out.ok).toBe(true);
    expect(w.reserved, "le quota compte des tentatives au lieu de posts").toHaveLength(3);
  });

  /*
   * ⚠ LES SUJETS TIRÉS ET NON PUBLIÉS SONT RENDUS. La surgénération tire plus que
   * trente : les non retenus sont rendus au segment, sinon on les lui vole pour
   * quatre-vingt-dix jours.
   */
  it("ce qui est tiré et non publié retourne à la banque", async () => {
    const w = world({ stock: 4 });
    const out = await orchestrateMonth(w.ports, input());
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.released.length).toBeGreaterThan(0);
    expect(w.released.flat()).toEqual(expect.arrayContaining(out.released));
  });

  it("le journal se ferme sur published, et le coût reste lisible", async () => {
    const w = world();
    const out = await orchestrateMonth(w.ports, input());
    expect(out.ok).toBe(true);
    expect(w.journal.runs).toHaveLength(1);
    expect(w.journal.runs[0].state).toBe("published");
    expect(Number(w.journal.runs[0].cost_usd)).toBeCloseTo(0.32, 5);
  });
});

describe("le préalable passe en premier, et rien n'est dépensé quand il refuse", () => {
  /*
   * ⚠ LA PORTE F46 : UN ÉTAT NON VÉRIFIÉ REFUSE. `license_type_states` porte 240
   * couples et une colonne `verified_at` — un État n'est vendable que lorsqu'une
   * personne a lu la règle de son board. Le harnais lisait `abbreviation` sans
   * regarder `verified_at`, et `licenceMention` retombe sur une table du code :
   * l'absence d'abréviation n'est donc PAS un contrôle de vérification.
   */
  it("un État non vérifié refuse le mois, sans un appel de rédaction", async () => {
    const w = world({ verified: false });
    const out = await orchestrateMonth(w.ports, input());
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.stage).toBe("preflight");
    expect(out.costUsd, "de l'argent dépensé avant le préalable").toBe(0);
    expect(out.nothingWritten).toBe(true);
    expect(w.writer.write, "la rédaction a été appelée malgré le refus").not.toHaveBeenCalled();
    expect(w.inserted).toEqual([]);
    expect(w.reserved).toEqual([]);
  });

  it("le refus nomme ce qui manque", async () => {
    const w = world({ verified: false });
    const out = await orchestrateMonth(w.ports, input());
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.refusal.length).toBeGreaterThan(30);
  });

  it("aucune ligne de journal n'est ouverte quand le préalable refuse", async () => {
    const w = world({ verified: false });
    await orchestrateMonth(w.ports, input());
    expect(w.journal.runs, "une ligne ouverte pour un mois refusé").toEqual([]);
  });
});

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LA REPRISE — NI REPAYER, NI REDÉBITER
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Les lignes sont posées comme une panne les laisse : un lot soumis, deux
 * réponses arrivées dont une soldée, une jamais arrivée. C'est la seule forme qui
 * distingue les trois décisions, et confondre les deux dernières est exactement
 * ce qui fait payer deux fois.
 */
describe("une interruption reprend sans repayer", () => {
  let w: ReturnType<typeof world>;

  beforeEach(() => {
    w = world();
    w.journal.runs.push({
      id: "run-1",
      brand_kit_id: KIT,
      month: MONTH,
      batch_id: "batch-abc",
      state: "submitted",
      cost_usd: 0.19,
    });
    w.journal.results.push(
      { id: "r1", run_id: "run-1", topic_id: "t1", result: written(1), usage: {}, settled: true },
      { id: "r2", run_id: "run-1", topic_id: "t2", result: written(2), usage: {}, settled: false },
      { id: "r3", run_id: "run-1", topic_id: "t3", result: null, usage: {}, settled: false }
    );
  });

  it("elle rattache le lot payé au lieu d'en créer un second", async () => {
    const out = await orchestrateMonth(w.ports, input());
    expect(out.ok, out.ok ? "" : out.refusal).toBe(true);
    if (!out.ok) return;
    expect(out.resumed.reattached).toBe(true);
    expect(out.runId).toBe("run-1");
    expect(w.journal.runs, "une seconde ligne : le mois serait payé deux fois").toHaveLength(1);
  });

  /*
   * ⚠ ELLE NE REDEMANDE QUE CE QUI MANQUE. Redemander les deux posts déjà
   * arrivés, c'est repayer le fournisseur pour des réponses qu'on a en base.
   */
  it("elle ne fait réécrire que le sujet dont la réponse manque", async () => {
    await orchestrateMonth(w.ports, input());
    expect(w.writer.write).toHaveBeenCalledTimes(1);
    const asked = (w.writer.write as ReturnType<typeof vi.fn>).mock.calls[0][0].topics;
    expect(asked.map((t: DrawnTopic) => t.id), "elle repaie des réponses déjà en base").toEqual(["t3"]);
  });

  /*
   * ⚠ ET ELLE NE REFAIT PAS SON TIRAGE. Rencontré en vrai le 2026-09-23 : une
   * reprise a rattaché le bon lot puis retiré de nouveaux sujets. Les deux
   * ensembles se sont trouvés identiques par coïncidence d'ordonnancement, et le
   * mois est passé. Un sujet ajouté ou expiré entre les deux, et la reprise paie
   * un lot dont elle ne sait plus lire les réponses.
   */
  it("elle reprend les sujets du journal, elle n'en tire pas d'autres", async () => {
    await orchestrateMonth(w.ports, input());
    expect(
      (w.ports.draw.assign as unknown as ReturnType<typeof vi.fn>) ?? null,
      "le tirage a été rappelé sur une reprise"
    ).toBeDefined();
    const asked = (w.writer.write as ReturnType<typeof vi.fn>).mock.calls[0][0].topics;
    expect(asked.map((t: DrawnTopic) => t.id)).toEqual(["t3"]);
  });

  /*
   * ⚠ ET ELLE NE REDÉBITE PAS. `t1` était déjà soldé : lui réserver un second
   * crédit ferait payer deux fois un post déjà décompté du quota.
   */
  it("un sujet déjà soldé ne repasse pas par le règlement", async () => {
    await orchestrateMonth(w.ports, input());
    const t1 = w.journal.results.find((r) => r.topic_id === "t1")!;
    expect(t1.settled).toBe(true);
    const t2 = w.journal.results.find((r) => r.topic_id === "t2")!;
    expect(t2.settled, "t2 était dû, il devait être soldé").toBe(true);
  });

  it("le coût déjà engagé est gardé, pas recalculé", async () => {
    const out = await orchestrateMonth(w.ports, input());
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    /* 0,19 $ déjà payés + 0,32 $ pour le seul sujet manquant. */
    expect(out.costUsd).toBeCloseTo(0.51, 5);
  });
});

describe("la mention de licence arrête le mois entier, pas une carte", () => {
  /*
   * ⚠ SI LE PIED NE PORTE PAS LA MENTION POUR UN POST, IL NE LA PORTE POUR AUCUN :
   * c'est la même chaîne pour les trente. Publier les vingt-neuf autres mettrait
   * en ligne vingt-neuf publicités sans numéro de licence (B&P §651).
   */
  it("un pied sans mention refuse le mois et ne publie rien", async () => {
    const w = world();
    const out = await orchestrateMonth(w.ports, input({ practiceName: "Still Water" }));
    expect(out.ok).toBe(true);

    /* Et avec une mention que le préalable ne peut pas construire, le mois tombe
     * à l'étage A — ce qui est encore mieux : rien n'est même rédigé. */
    const broken = world();
    broken.ports.preflight = {
      ...broken.ports.preflight,
      licenceFacts: async () => ({ licenseTypeId: null, licenseNumber: null, abbreviation: null }),
    } as never;
    const second = await orchestrateMonth(broken.ports, input());
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.stage).toBe("preflight");
    expect(broken.inserted).toEqual([]);
  });
});

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LA LIGNE DU MOIS — LE TROISIÈME EFFET DE F54
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `content_months.status` porte quatre valeurs, et `generating` n'avait qu'un seul
 * écrivain : `queue.ts`, appelé par le webhook Stripe à l'achat. Le harnais insère
 * la ligne À LA FIN, directement en `proposed` — donc une exécution tuée ne laisse
 * aucune ligne, et l'écran « en cours » que `month-screen.ts` sait afficher n'est
 * jamais atteint par une génération.
 */
describe("la ligne du mois s'ouvre et se ferme", () => {
  it("elle s'ouvre avant la rédaction, et se ferme en proposed", async () => {
    const w = world();
    const out = await orchestrateMonth(w.ports, input());
    expect(out.ok).toBe(true);
    expect(w.ports.openMonthRow).toHaveBeenCalledTimes(1);
    expect(w.months[0].status).toBe("proposed");
  });

  /*
   * ⚠ RIEN N'EST OUVERT QUAND LE PRÉALABLE REFUSE. Une ligne posée pour un mois
   * refusé bloquerait la clé unique `(brand_kit_id, month)` et empêcherait le tour
   * suivant.
   */
  it("aucune ligne n'est ouverte quand le préalable refuse", async () => {
    const w = world({ verified: false });
    await orchestrateMonth(w.ports, input());
    expect(w.ports.openMonthRow).not.toHaveBeenCalled();
    expect(w.months).toEqual([]);
  });

  /*
   * ⚠ ET UN ÉCHEC LA FERME EN `failed`, JAMAIS LAISSÉE EN `generating`. Un mois
   * « en cours » pour toujours est le pire des trois états : la cliente attend, et
   * le préalable du tour suivant le laisserait passer en croyant reprendre un
   * travail qui n'existe pas.
   */
  it("une rédaction qui ne rend rien ferme la ligne en failed", async () => {
    const w = world({
      writer: { write: vi.fn(async () => ({ posts: [], batchId: null, costUsd: 0.05 })) },
    });
    const out = await orchestrateMonth(w.ports, input());
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.stage).toBe("write");
    expect(w.months[0].status, "une ligne laissée en generating pour toujours").toBe("failed");
    /* ⚠ Et le coût engagé est DIT, même quand rien n'est livré. */
    expect(out.costUsd).toBeCloseTo(0.05, 5);
  });

  it("un mois vide ne se ferme pas en proposed", async () => {
    /* Tous les posts refusés par le portillon : rien à relire. */
    const w = world({
      writer: {
        write: vi.fn(async ({ topics }: { topics: DrawnTopic[] }) => ({
          posts: topics.map((t: DrawnTopic) => ({
            ...written(Number(t.id.slice(1))),
            caption: "Guaranteed relief from anxiety.",
          })),
          batchId: null,
          costUsd: 0.1,
        })),
      },
    });
    const out = await orchestrateMonth(w.ports, input());
    if (out.ok) {
      expect(out.month.written).toBe(0);
      expect(w.months[0].status, "un écran de relecture sans rien à relire").toBe("failed");
    } else {
      expect(w.months[0].status).toBe("failed");
    }
  });
});

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  F55 — UN MOIS QUI ÉCHOUE N'EST JAMAIS LIVRÉ
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ MESURÉ SUR LA BASE LOCALE LE 2026-09-26, pas craint. `content_months`
 * portait un mois de trente posts en `proposed`, avec trente posts en base, et
 * son livre disait : 30 réservations, 0 règlement, 30 LIBÉRATIONS. Le harnais ne
 * libère les crédits d'un mois livré que quand il RESTE des constats — ce mois-là
 * avait donc été refusé par ses propres contrôles, et il était en base,
 * indistinguable d'un bon mois. Une session ultérieure l'a relu comme livré.
 */
describe("F55 — un mois qui garde un constat ne s'écrit pas", () => {
  /*
   * Deux posts dont les lignes de carte sont identiques : `checkMonth` voit un
   * doublon que le portillon par post ne peut pas voir, et il ne reste aucun
   * remplaçant pour l'échanger.
   */
  function duplicated() {
    return world({
      stock: 2,
      writer: {
        write: vi.fn(async ({ topics }: { topics: DrawnTopic[] }) => ({
          posts: topics.map((t: DrawnTopic) => ({
            ...written(Number(t.id.slice(1))),
            cardLine: "Rest is not a reward",
            payload: { statement: "Rest is not a reward, and it shows up early." },
          })),
          batchId: null,
          costUsd: 0.2,
        })),
      },
    });
  }

  it("rien n'est écrit, et le refus nomme les constats", async () => {
    const w = duplicated();
    const out = await orchestrateMonth(w.ports, input({ wanted: 2, candidates: 2 }));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.stage).toBe("assemble");
    expect(out.remaining?.length ?? 0).toBeGreaterThan(0);
    expect(w.inserted, "des posts écrits pour un mois refusé").toEqual([]);
  });

  it("aucun crédit n'est pris sur un mois refusé", async () => {
    const w = duplicated();
    await orchestrateMonth(w.ports, input({ wanted: 2, candidates: 2 }));
    expect(w.reserved, "le quota a été débité pour un mois jamais publié").toEqual([]);
  });

  /*
   * ⚠ ET LA LIGNE DU MOIS PASSE EN `failed`, PAS EN `proposed`. C'est le seul
   * endroit où le refus reste lisible une fois le terminal fermé.
   */
  it("la ligne du mois dit failed, et les sujets sont rendus", async () => {
    const w = duplicated();
    const out = await orchestrateMonth(w.ports, input({ wanted: 2, candidates: 2 }));
    expect(w.months[0].status).toBe("failed");
    expect(w.released.flat().length, "les sujets restent volés au segment").toBeGreaterThan(0);
    /* ⚠ Le coût engagé est dit : les jetons ont bien été dépensés. */
    if (!out.ok) expect(out.costUsd).toBeCloseTo(0.2, 5);
  });
});

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LE LIVRE DIT CE QUE LE MOIS A COÛTÉ
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Le premier mois sorti du chemin produit a laissé VINGT-NEUF réservations sans
 * issue : `credit_month_audit` disait 29 réservations, 0 règlement, 0 libération,
 * coût 0,00000 $. Le quota était juste et les livres muets.
 */
describe("chaque réservation est soldée, au coût réparti", () => {
  it("un règlement par post écrit", async () => {
    const w = world();
    const out = await orchestrateMonth(w.ports, input());
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const settle = w.credits.settle as ReturnType<typeof vi.fn>;
    expect(settle, "des réservations laissées sans issue").toHaveBeenCalledTimes(out.month.written);
  });

  /*
   * ⚠ LE COÛT EST RÉPARTI, PAS RECOPIÉ. Solder chaque post au coût TOTAL
   * multiplierait la dépense par trente — « un livre qui multiplie par trente est
   * pire qu'un livre vide : le premier a l'air d'un chiffre ».
   */
  it("la somme des règlements fait le coût du mois, pas son multiple", async () => {
    const w = world();
    const out = await orchestrateMonth(w.ports, input());
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const settle = w.credits.settle as ReturnType<typeof vi.fn>;
    const total = settle.mock.calls.reduce((sum, call) => sum + (call[1] as number), 0);
    expect(total).toBeCloseTo(out.costUsd, 5);
  });

  it("un règlement dit que le post a abouti", async () => {
    const w = world();
    await orchestrateMonth(w.ports, input());
    const settle = w.credits.settle as ReturnType<typeof vi.fn>;
    for (const call of settle.mock.calls) expect(call[2]).toBe(true);
  });
});

/*
 * ⚠ LES COLLISIONS DE DATES SONT COMPTÉES, PAS TUES. Mesuré le 2026-09-26 : un
 * mois de trente posts en février 2028 est sorti sur vingt-neuf dates. Le repli
 * `dates[index] ?? dates[last]` empilait le trentième sur le dernier créneau, en
 * silence. Un mois de trente posts ne PEUT pas avoir trente dates distinctes en
 * février : ce qui était faux était de le taire.
 */
describe("deux posts le même jour se comptent", () => {
  it("un mois plus court que promis dit combien de créneaux se partagent", async () => {
    const w = world({ stock: 3 });
    const out = await orchestrateMonth(
      w.ports,
      input({ wanted: 3, candidates: 3, dates: ["2028-02-28", "2028-02-29"] })
    );
    expect(out.ok, out.ok ? "" : out.refusal).toBe(true);
    if (!out.ok) return;
    expect(out.month.written).toBe(3);
    expect(out.month.dateCollisions, "la collision est passée sous silence").toBe(1);
  });

  it("assez de créneaux, aucune collision", async () => {
    const w = world({ stock: 3 });
    const out = await orchestrateMonth(w.ports, input({ wanted: 3, candidates: 3 }));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.month.dateCollisions).toBe(0);
  });
});
