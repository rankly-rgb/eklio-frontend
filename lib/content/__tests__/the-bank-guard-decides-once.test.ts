import { describe, expect, it, vi } from "vitest";
import { guardBank, type BankGuardPort } from "@/lib/content/bank-guard";
import { CANDIDATES_PER_ATTEMPT, bankTarget, fillTrigger, type BankDemand } from "@/lib/content/bank";
import { FORMAT_FAMILIES } from "@/lib/content/month-checks";

/*
 * ── LA DÉCISION DU GARDE-FOU, ÉPROUVÉE PAR LE COMPORTEMENT ──────────────
 *
 * Elle vivait dans le harnais, et ses garanties n'étaient tenues que par des
 * `expect(SOURCE).toContain(...)` — un grep voit qu'une ligne existe, jamais ce
 * qu'elle décide. Extraite dans `lib/content/bank-guard.ts` avec un port injecté,
 * elle s'éprouve entièrement hors ligne et sans dépense.
 */

const DEMAND: BankDemand = { practitioners: 1, attempts: 1, rounds: 1 };
const ARCHETYPES = Object.values(FORMAT_FAMILIES).flat();

/** Un port qui rend ce qu'on lui dit, et compte ses appels. */
function stub(drawable: Record<string, number>, released = 0) {
  const calls: string[] = [];
  const port: BankGuardPort = {
    async releaseStale() {
      calls.push("release");
      return released;
    },
    async drawableCounts() {
      calls.push("count");
      return drawable;
    },
  };
  return { port, calls };
}

const plenty = () => Object.fromEntries(ARCHETYPES.map((a) => [a, 1000]));

describe("il rend AVANT de compter", () => {
  /*
   * ⚠ L'ORDRE EST LA MOITIÉ DU MÉCANISME. Mesuré le 2026-09-26 : 994 sujets
   * assignés à des exécutions tuées. Compter d'abord aurait vu une banque courte
   * et déclenché un remplissage payant pour racheter ce qu'on possédait déjà.
   */
  it("release puis count, dans cet ordre", async () => {
    const { port, calls } = stub(plenty(), 994);
    const verdict = await guardBank(port, "kit", DEMAND);
    expect(calls).toEqual(["release", "count"]);
    expect(verdict.released).toBe(994);
  });

  it("une panne de libération remonte, elle n'est pas avalée", async () => {
    const port: BankGuardPort = {
      releaseStale: vi.fn().mockRejectedValue(new Error("rpc down")),
      drawableCounts: vi.fn(),
    };
    await expect(guardBank(port, "kit", DEMAND)).rejects.toThrow("rpc down");
    expect(port.drawableCounts, "il a compté malgré une libération en panne")
      .not.toHaveBeenCalled();
  });
});

describe("le verdict", () => {
  it("une banque pleine passe, et nomme l'archétype au plus bas", async () => {
    const counts = { ...plenty(), cycle: 42 };
    const { port } = stub(counts);
    const verdict = await guardBank(port, "kit", DEMAND);
    expect(verdict.ok).toBe(true);
    expect(verdict.short).toEqual([]);
    expect(verdict.thinnest).toEqual({ archetype: "cycle", drawable: 42 });
    expect(verdict.said).toContain("cycle");
    expect(verdict.said).toContain("42");
  });

  /*
   * ⚠ LA PHRASE NOMME L'ARCHÉTYPE ET LES DEUX NOMBRES. « La banque est courte »
   * envoie chercher dans onze archétypes ; « cycle 5/12 » se règle en une
   * commande. C'est la règle de `licenceMissingMessage`.
   */
  it("un seul archétype court suffit à refuser, et il est nommé", async () => {
    const { port } = stub({ ...plenty(), cycle: 1 });
    const verdict = await guardBank(port, "kit", DEMAND);
    expect(verdict.ok).toBe(false);
    expect(verdict.short.map((s) => s.archetype)).toEqual(["cycle"]);
    expect(verdict.said).toMatch(/^cycle 1\/\d+$/);
  });

  /*
   * ⚠ LE TOTAL MENT, ET IL A MENTI. Le 2026-09-23 la banque portait 88 sujets
   * libres au total et le tirage n'en a trouvé que 18 sur 54 : `cycle` et
   * `numbered_strategies` en avaient cinq chacun.
   */
  it("un total généreux ne sauve pas un archétype vide", async () => {
    const counts = Object.fromEntries(ARCHETYPES.map((a) => [a, 0]));
    counts.single_statement = 5000;
    const verdict = await guardBank(stub(counts).port, "kit", DEMAND);
    expect(verdict.ok).toBe(false);
    expect(verdict.short.length).toBeGreaterThan(5);
  });

  it("un archétype inconnu de la banque compte comme zéro", async () => {
    const verdict = await guardBank(stub({}).port, "kit", DEMAND);
    expect(verdict.ok).toBe(false);
    expect(verdict.thinnest).toBeNull();
    expect(verdict.said).not.toBe("");
  });
});

describe("le seuil est celui d'UN tour, pas la cible du segment", () => {
  /*
   * ⚠ EXIGER LA CIBLE REFUSERAIT DES MOIS QU'ON SAIT COMPOSER. La cible
   * dimensionne un segment sur trois mois de fenêtre anti-collision ; la
   * question ici est « ce tirage-ci peut-il se faire maintenant ».
   */
  it("il applique attempts: 1 et rounds: 1 quelle que soit la demande", async () => {
    const trigger = fillTrigger({ practitioners: 1, attempts: 1, rounds: 1 });
    const atThreshold = Object.fromEntries(
      ARCHETYPES.map((a) => [a, trigger[a] ?? 0])
    );
    /* Pile au seuil : ça passe. */
    expect((await guardBank(stub(atThreshold).port, "kit", DEMAND)).ok).toBe(true);

    /* Et une demande de dix praticiennes sur quatre essais ne durcit pas ce seuil. */
    const wide: BankDemand = { practitioners: 1, attempts: 4, rounds: 3 };
    expect((await guardBank(stub(atThreshold).port, "kit", wide)).ok).toBe(true);
  });

  /* Un de moins sur un seul archétype, et ça ne passe plus. */
  it("un sujet sous le seuil refuse", async () => {
    const trigger = fillTrigger({ practitioners: 1, attempts: 1, rounds: 1 });
    const counts = Object.fromEntries(ARCHETYPES.map((a) => [a, trigger[a] ?? 0]));
    counts.carousel -= 1;
    const verdict = await guardBank(stub(counts).port, "kit", DEMAND);
    expect(verdict.ok).toBe(false);
    expect(verdict.short.map((s) => s.archetype)).toContain("carousel");
  });

  /*
   * ⚠ ET LE SEUIL SUIT LE TIRAGE (F41). Il valait 174 pour un essai quand le
   * tirage était de 102 ; il vaut 99 depuis qu'il est de 57. Ce test tombe si
   * quelqu'un refixe l'un sans l'autre.
   */
  it("le seuil est cohérent avec le tirage courant", () => {
    const total = Object.values(fillTrigger({ practitioners: 1, attempts: 1, rounds: 1 }))
      .reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(CANDIDATES_PER_ATTEMPT);
    expect(total).toBeLessThan(CANDIDATES_PER_ATTEMPT * 2.5);
  });
});

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  2026-10-04 — UNE REPRISE N'EST PAS REFUSÉE PAR LA BANQUE QU'ELLE DÉTIENT
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Un mois tué à mi-rédaction garde ses 57 sujets assignés : la banque ne les
 * compte plus comme tirables, et la garde refusait la reprise — qui ne tire
 * rien. Les sujets détenus par CE mois sont comptés comme siens : la garde juge
 * la banque telle qu'elle était au départ, au même seuil.
 */
describe("les sujets détenus par le mois repris", () => {
  const demand = { practitioners: 1, attempts: 1, rounds: 1 };
  const full = bankTarget(demand);
  const heldByRun = Object.fromEntries(Object.entries(full).map(([k, n]) => [k, Math.ceil(n / 2)]));
  const leftInBank = Object.fromEntries(Object.entries(full).map(([k, n]) => [k, n - Math.ceil(n / 2)]));
  const bankPort = { releaseStale: async () => 0, drawableCounts: async () => ({ ...leftInBank }) };

  it("sans eux, la reprise est refusée pour une pénurie qu'elle a créée", async () => {
    expect((await guardBank(bankPort, "kit", demand)).ok).toBe(false);
  });

  it("avec eux, la même banque qu'au départ passe", async () => {
    expect((await guardBank(bankPort, "kit", demand, heldByRun)).ok).toBe(true);
  });

  /* ⚠ ET LE SEUIL NE BOUGE PAS : détenir peu ne suffit pas à passer une banque vide. */
  it("détenir quelques sujets ne fait pas passer une banque à sec", async () => {
    const empty = { releaseStale: async () => 0, drawableCounts: async () => ({}) };
    expect((await guardBank(empty, "kit", demand, { single_statement: 3 })).ok).toBe(false);
  });
});
