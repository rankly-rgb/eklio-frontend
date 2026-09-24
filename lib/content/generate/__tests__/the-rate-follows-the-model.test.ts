import { describe, expect, it, afterEach } from "vitest";
import {
  massCopyModel, rateFor, batchCostUsd, syncCostUsd,
  MASS_COPY_MODEL_DEFAULT, MASS_COPY_MODEL_FALLBACK, MODEL_RATES,
} from "@/lib/content/generate/copy-batch";

/*
 * ── ⚠ LE TARIF SUIT LE MODÈLE, SINON TOUT CHIFFRE DE COÛT EST FAUX ─────
 *
 * `massCopyModel()` était piloté par variable d'environnement depuis le début,
 * et le tarif était une CONSTANTE Haiku. Basculer la rédaction sur Sonnet sans
 * toucher au tarif aurait rendu un coût divisé par deux : les deux moitiés
 * justes, la jonction fausse.
 *
 * C'est la classe de F27, et la grandeur dont cette session doit mesurer la
 * variation est précisément celle-là.
 */
const withModel = (model: string | undefined, run: () => void) => {
  const before = process.env.CONTENT_COPY_MODEL;
  if (model === undefined) delete process.env.CONTENT_COPY_MODEL;
  else process.env.CONTENT_COPY_MODEL = model;
  try { run(); } finally {
    if (before === undefined) delete process.env.CONTENT_COPY_MODEL;
    else process.env.CONTENT_COPY_MODEL = before;
  }
};

afterEach(() => { delete process.env.CONTENT_COPY_MODEL; });

const USAGE = { input: 1_000_000, output: 1_000_000, cacheRead: 0, cacheWrite: 0 };

describe("le tarif suit le modèle", () => {
  it("la rédaction est sur Sonnet par défaut", () => {
    withModel(undefined, () => expect(massCopyModel()).toBe("claude-sonnet-5"));
    expect(MASS_COPY_MODEL_DEFAULT).toBe("claude-sonnet-5");
  });

  it("le repli Haiku passe par la variable, sans redéploiement", () => {
    withModel(MASS_COPY_MODEL_FALLBACK, () =>
      expect(massCopyModel()).toBe("claude-haiku-4-5-20251001"));
  });

  /*
   * ⚠ UN MILLION DE JETONS D'ENTRÉE ET DE SORTIE : le coût doit DOUBLER entre
   * Haiku et Sonnet. S'il ne bouge pas, le tarif est resté sur une constante.
   */
  it("le coût synchrone double quand le modèle double de prix", () => {
    let haiku = 0, sonnet = 0;
    withModel("claude-haiku-4-5", () => { haiku = syncCostUsd(USAGE); });
    withModel("claude-sonnet-5", () => { sonnet = syncCostUsd(USAGE); });
    expect(haiku).toBeCloseTo(6, 5);
    expect(sonnet).toBeCloseTo(12, 5);
  });

  it("le coût en lot double aussi, et reste à moitié prix", () => {
    let haiku = 0, sonnet = 0;
    withModel("claude-haiku-4-5", () => { haiku = batchCostUsd([USAGE]); });
    withModel("claude-sonnet-5", () => { sonnet = batchCostUsd([USAGE]); });
    expect(haiku).toBeCloseTo(3, 5);
    expect(sonnet).toBeCloseTo(6, 5);
  });

  /*
   * ⚠ UN MODÈLE INCONNU PREND LE PLUS CHER, JAMAIS ZÉRO. Un tarif manquant qui
   * rendrait 0 ferait apparaître un modèle inconnu comme gratuit — et un
   * plafond de session se lit sur ce chiffre-là.
   */
  it("un modèle sans tarif est facturé au plus cher connu", () => {
    const dearest = Math.max(...Object.values(MODEL_RATES).map((r) => r.outputPerMTok));
    expect(rateFor("claude-qui-nexiste-pas").outputPerMTok).toBe(dearest);
    expect(rateFor("claude-qui-nexiste-pas").outputPerMTok).toBeGreaterThan(0);
  });

  it("les tarifs connus sont ceux du barème", () => {
    expect(rateFor("claude-sonnet-5")).toEqual({ inputPerMTok: 2, outputPerMTok: 10 });
    expect(rateFor("claude-haiku-4-5")).toEqual({ inputPerMTok: 1, outputPerMTok: 5 });
  });
});
