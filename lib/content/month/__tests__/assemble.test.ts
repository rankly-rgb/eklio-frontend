import { describe, expect, it, vi } from "vitest";
import { assembleMonth, type Assemblable, type AssemblePorts } from "@/lib/content/month/assemble";
import type { CreditPort, ReserveRefusal } from "@/lib/credits/paid-call";

/*
 * ── L'ASSEMBLAGE, ÉPROUVÉ SANS UN APPEL NI UN CENTIME ───────────────────
 *
 * Les posts arrivent déjà écrits ; les deux seuls accès au monde sont des ports.
 * Une doublure suffit donc à tenir le portillon, l'échange, le remplaçant
 * d'insert et la comptabilité — ce qui est la seule façon d'écrire ce module
 * pendant que le compte fournisseur est sous limite d'usage.
 */

/** Un post propre : rien qu'un contrôle puisse reprocher. */
function post(n: number, over: Partial<Assemblable> = {}): Assemblable {
  return {
    cardLine: `A quiet line ${n}`,
    composeArchetype: "single_statement",
    payload: { archetype_key: "single_statement", statement: `Something ordinary happens ${n}.` },
    svg: null,
    /*
     * ⚠ UN SURTITRE VIDE EST UN DÉFAUT, et le portillon l'a dit dès le premier
     * essai : mes fixtures « propres » étaient refusées douze fois sur douze pour
     * `eyebrow.empty`. Le contrôle avait raison ; c'est la fixture qui était
     * fausse. Elle porte donc un libellé du catalogue.
     */
    eyebrow: "BEHIND THE PRACTICE",
    footer: "Still Water · LMFT 12345",
    candidate: {
      topic: { id: `topic-${n}`, title: `Sujet ${n}`, hook: `crochet ${n}` },
      result: { caption: `Une légende ordinaire, la ${n}.`, altText: `Un alternatif ${n}.`, rationale: "parce que" },
    },
    ...over,
  };
}

function ports(over: Partial<AssemblePorts> = {}) {
  const inserted: string[] = [];
  const reserved: string[] = [];
  const credits: CreditPort = {
    reserve: vi.fn(async (spec) => {
      reserved.push(spec.reason);
      return { ok: true as const, reservationId: `res-${reserved.length}` };
    }),
    settle: vi.fn(async () => {}),
  };
  const p: AssemblePorts = {
    insert: vi.fn(async (row) => {
      inserted.push(row.topicId);
      return null;
    }),
    credits,
    ...over,
  };
  return { ports: p, inserted, reserved };
}

const input = (prepared: Assemblable[], wanted = 3) => ({
  prepared,
  wanted,
  dates: ["2027-07-01", "2027-07-08", "2027-07-15", "2027-07-22"],
  context: {
    direction: "warm",
    modalities: [],
    eyebrowCatalogue: [{ id: "behind_the_practice", label: "Behind the practice" }],
  } as never,
  direction: "warm" as never,
  practiceName: "Still Water",
  identityAllowList: [] as string[],
  intentCatalogue: [{ id: "behind_the_practice", label: "Behind the practice" }],
  licenceMention: "LMFT 12345",
  modalities: [] as string[],
  completeness: {},
  userId: "user",
  month: "2027-07-01",
});

describe("le portillon écarte à l'arrivée, pas à l'assemblage", () => {
  it("un mois propre passe entier", async () => {
    const { ports: p, inserted } = ports();
    const out = await assembleMonth(p, input([post(1), post(2), post(3)]));
    expect(out.gate).toMatchObject({ arrived: 3, passedAlone: 3 });
    expect(out.written).toBe(3);
    expect(inserted).toEqual(["topic-1", "topic-2", "topic-3"]);
  });

  /*
   * ⚠ ET L'ÉCARTÉ NE CONSOMME AUCUN ÉCHANGE. C'est tout l'objet du portillon :
   * `sable.ingram` a réussi dix échanges puis est mort sur `month.short`, et les
   * dix défauts se lisaient chacun sur un post seul.
   */
  it("un post fautif est écarté seul, et ne coûte pas un échange", async () => {
    const guilty = post(2, {
      candidate: {
        topic: { id: "topic-2", title: "Sujet 2", hook: "h" },
        result: { caption: "Guaranteed relief from anxiety.", altText: "a", rationale: "r" },
      },
    });
    const { ports: p } = ports();
    const out = await assembleMonth(p, input([post(1), guilty, post(3), post(4)]));
    expect(out.gate.passedAlone).toBe(3);
    expect(out.gate.refused).toHaveLength(1);
    expect(out.gate.byCheck["ethics.blocked"]).toBe(1);
    /* Aucun échange : le fautif n'est jamais entré dans la sélection. */
    expect(out.selection.dropped).toEqual([]);
    expect(out.written).toBe(3);
  });

  it("il nomme le post et les classes qu'il lui reproche", async () => {
    const guilty = post(1, { cardLine: "When your life and" });
    const { ports: p } = ports();
    const out = await assembleMonth(p, input([guilty, post(2), post(3), post(4)]));
    expect(out.gate.refused[0].topic).toBe("Sujet 1");
    expect(out.gate.refused[0].checks).toContain("text.unfinished");
    expect(out.gate.refused[0].detail.length).toBeGreaterThan(10);
  });
});

describe("un insert refusé prend un remplaçant, au même créneau", () => {
  it("le remplaçant occupe la date du refusé", async () => {
    const dates: string[] = [];
    let first = true;
    const { ports: p } = ports({
      insert: vi.fn(async (row) => {
        dates.push(`${row.topicId}@${row.scheduledFor}`);
        if (first) {
          first = false;
          return "Advertising ethics: guarantee";
        }
        return null;
      }),
    });
    const out = await assembleMonth(p, input([post(1), post(2), post(3), post(4)]));
    expect(out.inserts.replacements).toBe(1);
    expect(out.inserts.refused[0]).toContain("Sujet 1");
    /*
     * ⚠ LA MÊME DATE. Décaler le remplaçant d'un rang ferait sortir un mois de
     * trente posts sur vingt-neuf jours.
     */
    expect(dates[0]).toBe("topic-1@2027-07-01");
    expect(dates[1]).toBe("topic-4@2027-07-01");
    expect(out.written).toBe(3);
  });

  /*
   * ⚠ ET SANS REMPLAÇANT, LE MOIS SORT COURT — ce que `checkCount` refuse. On ne
   * livre pas vingt-neuf posts en silence.
   */
  it("plus aucun remplaçant : le mois sort court, et le dit", async () => {
    const { ports: p } = ports({ insert: vi.fn(async () => "refusé") });
    const out = await assembleMonth(p, input([post(1), post(2), post(3)]));
    expect(out.written).toBe(0);
    expect(out.inserts.refused).toHaveLength(3);
    expect(out.inserts.replacements).toBe(0);
  });
});

describe("le crédit se prend un par post écrit, après l'écriture", () => {
  it("trois posts écrits, trois réservations", async () => {
    const { ports: p, reserved } = ports();
    const out = await assembleMonth(p, input([post(1), post(2), post(3)]));
    expect(reserved).toHaveLength(3);
    expect(out.creditRefusal).toBeNull();
  });

  /*
   * ⚠ APRÈS L'ÉCRITURE, PAS AVANT. Un post que la base refuse ne doit pas
   * prendre de crédit : la praticienne a acheté trente POSTS, pas des tentatives.
   */
  it("un insert refusé ne prend pas de crédit", async () => {
    let first = true;
    const { ports: p, reserved } = ports({
      insert: vi.fn(async () => {
        if (first) { first = false; return "refusé"; }
        return null;
      }),
    });
    await assembleMonth(p, input([post(1), post(2), post(3), post(4)]));
    /* Trois écrits, trois crédits — le refusé n'en a pas pris. */
    expect(reserved).toHaveLength(3);
  });

  /*
   * ── ⚠ F47 : LES SEPT ISSUES TRAVERSENT JUSQU'ICI ──────────────────────
   *
   * Un abonnement expiré ne se lit pas comme un quota épuisé, et l'appelant sait
   * lequel des deux mérite une page de paiement.
   */
  it.each([
    ["quota_exhausted", true],
    ["not_entitled", true],
    ["no_quota_configured", false],
    ["unknown_kind", false],
    ["unknown", false],
  ] as Array<[ReserveRefusal, boolean]>)("%s traverse, achat utile : %s", async (reason, buyable) => {
    const credits: CreditPort = {
      reserve: vi.fn(async () => ({ ok: false as const, reason })),
      settle: vi.fn(async () => {}),
    };
    const { ports: p } = ports({ credits });
    const out = await assembleMonth(p, input([post(1), post(2), post(3)]));
    expect(out.creditRefusal).toEqual({ reason, buyable });
    /* ⚠ L'écriture s'arrête : elle n'en a pas acheté plus. */
    expect(out.written).toBe(1);
  });
});

/*
 * ── ⚠ ET LE PORTILLON PASSE AVANT LA SÉLECTION, TOUJOURS ────────────────
 *
 * Inversé, il ne gagnerait rien : la sélection aurait déjà dépensé ses échanges
 * sur des défauts qu'un post seul suffisait à voir.
 */
describe("l'ordre des quatre moments", () => {
  it("le portillon voit tous les posts, la sélection seulement les propres", async () => {
    const guilty = post(2, { cardLine: "When your life and" });
    const { ports: p } = ports();
    const out = await assembleMonth(p, input([post(1), guilty, post(3), post(4)], 2));
    expect(out.gate.arrived).toBe(4);
    expect(out.gate.passedAlone).toBe(3);
    /* La sélection a choisi 2 parmi les 3 propres, jamais parmi les 4. */
    expect(out.selection.chosen).toHaveLength(2);
    for (const chosen of out.selection.chosen) {
      expect(chosen.cardLine).not.toBe("When your life and");
    }
  });
});
