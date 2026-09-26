import { describe, expect, it, vi } from "vitest";
import { preflight, type PreflightPort } from "@/lib/content/month/preflight";
import { POSTS_PER_MONTH, fillTrigger, type BankDemand } from "@/lib/content/bank";
import { FORMAT_FAMILIES } from "@/lib/content/month-checks";

/*
 * ── L'ÉTAGE A DE F45, ÉPROUVÉ SANS UN APPEL NI UN CENTIME ───────────────
 *
 * C'est l'étage qui porte le blocage légal et la protection de l'argent. Il est
 * écrit avec des ports injectés précisément pour pouvoir être tenu par des tests
 * pendant que le compte fournisseur est sous limite d'usage.
 */

const DEMAND: BankDemand = { practitioners: 1, attempts: 1, rounds: 1 };
const ARCHETYPES = Object.values(FORMAT_FAMILIES).flat();
const FULL_BANK = Object.fromEntries(ARCHETYPES.map((a) => [a, 1000]));

const GOOD_LICENCE = {
  licenseTypeId: "lmft",
  licenseNumber: "12345",
  abbreviation: "LMFT",
};

function port(over: Partial<PreflightPort> = {}): PreflightPort {
  return {
    monthExists: vi.fn().mockResolvedValue(false),
    licenceFacts: vi.fn().mockResolvedValue(GOOD_LICENCE),
    stateVerified: vi.fn().mockResolvedValue(true),
    creditRemaining: vi.fn().mockResolvedValue({ remaining: 30, unlimited: false }),
    bank: {
      releaseStale: vi.fn().mockResolvedValue(0),
      drawableCounts: vi.fn().mockResolvedValue(FULL_BANK),
    },
    ...over,
  };
}

const INPUT = {
  brandKitId: "kit",
  projectId: "proj",
  userId: "user",
  month: "2027-07-01",
  stateCode: "CA",
  demand: DEMAND,
};

describe("un mois qui peut se générer passe", () => {
  it("il rend la mention de licence, le verdict de banque et le quota", async () => {
    const verdict = await preflight(port(), INPUT);
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.licenceMention).toBe("LMFT 12345");
    expect(verdict.bank.ok).toBe(true);
    expect(verdict.quota.remaining).toBe(30);
  });

  /*
   * ⚠ LA MENTION N'EST JAMAIS VIDE QUAND ÇA PASSE. C'est l'invariant qui
   * empêche un mois de sortir sans pied de licence : l'appelant reçoit une
   * chaîne, pas un `string | null` qu'il pourrait ignorer.
   */
  it("la mention n'est jamais vide", async () => {
    const verdict = await preflight(port(), INPUT);
    if (!verdict.ok) throw new Error("attendu ok");
    expect(verdict.licenceMention.length).toBeGreaterThan(3);
  });
});

describe("les quatre refus, et leur ordre", () => {
  it("un mois déjà là refuse le premier, sans rien lire d'autre", async () => {
    const p = port({ monthExists: vi.fn().mockResolvedValue(true) });
    const verdict = await preflight(p, INPUT);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.code).toBe("month_exists");
    /* ⚠ RIEN D'AUTRE N'EST INTERROGÉ : c'est le refus le moins cher. */
    expect(p.licenceFacts).not.toHaveBeenCalled();
    expect(p.creditRemaining).not.toHaveBeenCalled();
    expect(p.bank.releaseStale).not.toHaveBeenCalled();
  });

  /*
   * ⚠ LE REFUS LÉGAL NOMME LE CHAMP. « Le brief est incomplet » envoie chercher
   * dans onze champs ; « il manque le numéro de licence » se règle en trente
   * secondes.
   */
  it.each([
    ["sans numéro", { ...GOOD_LICENCE, licenseNumber: null }, "numéro de licence"],
    ["sans type", { ...GOOD_LICENCE, licenseTypeId: null }, "type de licence"],

  ])("une licence %s refuse et nomme ce qui manque", async (_label, facts, needle) => {
    const p = port({ licenceFacts: vi.fn().mockResolvedValue(facts) });
    const verdict = await preflight(p, INPUT);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.code).toBe("licence_missing");
    expect(verdict.refusal).toContain(needle);
    /* ⚠ ET LA BANQUE N'EST PAS BALAYÉE pour un mois qu'on refuse déjà. */
    expect(p.bank.releaseStale).not.toHaveBeenCalled();
  });

  /*
   * ⚠ UNE ABRÉVIATION ABSENTE NE REFUSE PAS, et c'est ce que ce test a appris.
   * `licenceMention` retombe sur `LICENCE_ABBREVIATION`, une table du code : la
   * mention s'imprime quand même. L'absence d'abréviation n'est donc PAS un
   * contrôle de vérification d'État — d'où la porte `stateVerified`, séparée.
   */
  it("une abréviation absente retombe sur la table du code et passe", async () => {
    const p = port({
      licenceFacts: vi.fn().mockResolvedValue({ ...GOOD_LICENCE, abbreviation: null }),
    });
    const verdict = await preflight(p, INPUT);
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.licenceMention).toBe("LMFT 12345");
  });

  /*
   * ⚠ ET C'EST `stateVerified` QUI TIENT F12. 240 couples (type, État), une
   * colonne `verified_at`, et un État n'est vendable que lorsqu'une personne a lu
   * la règle de son board. Le harnais lisait `abbreviation` sans la regarder.
   */
  it("un État non vérifié refuse, et dit où lire la procédure", async () => {
    const p = port({ stateVerified: vi.fn().mockResolvedValue(false) });
    const verdict = await preflight(p, INPUT);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.code).toBe("state_unverified");
    expect(verdict.refusal).toContain("CA");
    expect(verdict.refusal).toContain("F12");
    expect(p.creditRemaining).not.toHaveBeenCalled();
    expect(p.bank.releaseStale).not.toHaveBeenCalled();
  });

  it("un État absent du brief refuse aussi", async () => {
    const verdict = await preflight(port(), { ...INPUT, stateCode: null });
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.code).toBe("state_unverified");
  });

  it("un quota épuisé refuse, et dit ce qui reste", async () => {
    const p = port({
      creditRemaining: vi.fn().mockResolvedValue({ remaining: 4, unlimited: false }),
    });
    const verdict = await preflight(p, INPUT);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.code).toBe("quota_exhausted");
    expect(verdict.refusal).toContain("4");
    expect(verdict.refusal).toContain(String(POSTS_PER_MONTH));
    expect(p.bank.releaseStale).not.toHaveBeenCalled();
  });

  /*
   * ⚠ `remaining: null` VEUT DIRE ILLIMITÉ, PAS ZÉRO. Confondre les deux
   * refuserait tous les comptes sans plafond — et `overhead` est justement de
   * ceux-là.
   */
  it("un quota illimité passe", async () => {
    const p = port({
      creditRemaining: vi.fn().mockResolvedValue({ remaining: null, unlimited: true }),
    });
    expect((await preflight(p, INPUT)).ok).toBe(true);
  });

  it("une banque courte refuse en nommant l'archétype", async () => {
    const thin = { ...FULL_BANK, cycle: 1 };
    const p = port({
      bank: { releaseStale: vi.fn().mockResolvedValue(7), drawableCounts: vi.fn().mockResolvedValue(thin) },
    });
    const verdict = await preflight(p, INPUT);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.code).toBe("bank_short");
    expect(verdict.refusal).toContain("cycle");
    /* ⚠ ET LE BALAYAGE A QUAND MÊME EU LIEU : sept assignations rendues. */
    expect(verdict.bank?.released).toBe(7);
  });
});

describe("chaque refus dit que rien n'a été dépensé", () => {
  /*
   * ⚠ C'EST LA PHRASE QUI ÉVITE UN APPEL AU SUPPORT. Un refus qui ne dit pas si
   * l'argent est parti envoie chercher dans Stripe.
   */
  it.each([
    ["month_exists", { monthExists: vi.fn().mockResolvedValue(true) }],
    ["licence_missing", { licenceFacts: vi.fn().mockResolvedValue({ ...GOOD_LICENCE, licenseNumber: null }) }],
    ["quota_exhausted", { creditRemaining: vi.fn().mockResolvedValue({ remaining: 0, unlimited: false }) }],
    ["state_unverified", { stateVerified: vi.fn().mockResolvedValue(false) }],
    ["bank_short", { bank: { releaseStale: vi.fn().mockResolvedValue(0), drawableCounts: vi.fn().mockResolvedValue({}) } }],
  ])("%s", async (_code, over) => {
    const verdict = await preflight(port(over as never), INPUT);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.refusal.toLowerCase()).toContain("dépens");
  });
});

describe("le seuil de banque est celui du tirage courant", () => {
  /*
   * ⚠ PILE AU SEUIL, ÇA PASSE. C'est ce qui relie le préalable à F41 : le seuil
   * a baissé de 43 % quand le tirage est passé de 102 à 57, et les deux doivent
   * bouger ensemble.
   */
  it("une banque pile au seuil passe", async () => {
    const trigger = fillTrigger({ practitioners: 1, attempts: 1, rounds: 1 });
    const atThreshold = Object.fromEntries(ARCHETYPES.map((a) => [a, trigger[a] ?? 0]));
    const p = port({
      bank: { releaseStale: vi.fn().mockResolvedValue(0), drawableCounts: vi.fn().mockResolvedValue(atThreshold) },
    });
    expect((await preflight(p, INPUT)).ok).toBe(true);
  });
});
