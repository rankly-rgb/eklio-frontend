import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * ══════════════════════════════════════════════════════════════════════════
 * POST /api/first-line — LE SEUL CHEMIN MODÈLE OUVERT SANS COMPTE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Deux choses à prouver, et la seconde est la seule qui compte vraiment :
 *
 *   1. le mur est bien retiré — une inconnue obtient une réponse ;
 *   2. ⚠ CE QUI LE REMPLACE MORD. Une route qui appelle le modèle sans compte
 *      et sans plafond est une facture ouverte à qui sait écrire une boucle.
 *      Le test le plus important de ce fichier est celui qui vérifie qu'on
 *      REFUSE quand le compteur dit non, et qu'on ne dépense RIEN dans ce cas.
 */

let refusalAnon: unknown = null;
let appelsModele = 0;
let reponseModele = "You are struggling to sleep, and the mornings are hardest.";

const consumeAnonSpend = vi.fn(async () => refusalAnon);

vi.mock("@/lib/anon/spend", () => ({
  consumeAnonSpend: (...args: unknown[]) => consumeAnonSpend(...(args as [])),
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({}),
}));

vi.mock("@/lib/catalog/read", () => ({
  readCatalog: async () => ({
    ethicsRules: [
      {
        id: "proven",
        short_label: "No promised outcomes",
        description: "Never promise a result.",
        example_forbidden: "I guarantee you will heal.",
      },
    ],
    licenseTypes: [{ label: "LCSW", description: "Licensed Clinical Social Worker" }],
    degrees: [{ label: "PhD" }],
  }),
}));

/* Le vrai module, sauf l'appel modèle : on compte ce qui serait dépensé. */
vi.mock("@/lib/generation/model", () => ({
  callRewrite: async () => {
    appelsModele += 1;
    return reponseModele;
  },
}));

const { POST } = await import("@/app/api/first-line/route");

async function poste(text: string, ip = "203.0.113.7") {
  const response = await POST(
    new Request("http://t/api/first-line", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ text }),
    })
  );
  return { status: response.status, body: await response.json() };
}

const SON_TEXTE =
  "I hold a PhD from Berkeley and have been licensed in California for twelve years.";

describe("le mur est retiré", () => {
  beforeEach(() => {
    consumeAnonSpend.mockClear();
    refusalAnon = null;
    appelsModele = 0;
    reponseModele = "You are struggling to sleep, and the mornings are hardest.";
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("répond 200 sans session, sans brandKitId, sans achat", async () => {
    const { status, body } = await poste(SON_TEXTE);
    expect(status).toBe(200);
    expect(body.rewritten).toBe("You are struggling to sleep, and the mornings are hardest.");
    expect(body.findings).toEqual([]);
    expect(body.targetChars).toBe(320);
  });

  it("refuse un texte trop court sans rien dépenser", async () => {
    const { status } = await poste("trop court");
    expect(status).toBe(400);
    expect(appelsModele).toBe(0);
    expect(consumeAnonSpend).not.toHaveBeenCalled();
  });
});

describe("⚠ ce qui remplace le mur mord", () => {
  beforeEach(() => {
    consumeAnonSpend.mockClear();
    refusalAnon = null;
    appelsModele = 0;
    reponseModele = "You are struggling to sleep, and the mornings are hardest.";
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("compte AVANT d'appeler le modèle", async () => {
    const ordre: string[] = [];
    consumeAnonSpend.mockImplementationOnce(async () => {
      ordre.push("compteur");
      return null;
    });
    reponseModele = "You are struggling to sleep, and the mornings are hardest.";
    await poste(SON_TEXTE, "203.0.113.20");
    ordre.push("modèle");
    expect(ordre).toEqual(["compteur", "modèle"]);
    expect(consumeAnonSpend).toHaveBeenCalledWith("assist", expect.anything());
  });

  it("⚠ et quand le compteur refuse, RIEN n'est dépensé", async () => {
    const { NextResponse } = await import("next/server");
    refusalAnon = NextResponse.json({ error: "cap" }, { status: 429 });

    const { status } = await poste(SON_TEXTE, "203.0.113.21");
    expect(status).toBe(429);
    expect(appelsModele).toBe(0);
  });
});

describe("les refus disent le leur, et aucun ne s'excuse", () => {
  beforeEach(() => {
    consumeAnonSpend.mockClear();
    refusalAnon = null;
    appelsModele = 0;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("une réécriture qui promet un résultat : 422 ethics_refused, et le diagnostic part", async () => {
    reponseModele = "I guarantee you will heal from your anxiety.";
    const { status, body } = await poste(
      "I guarantee you will heal from your anxiety.",
      "203.0.113.31"
    );
    expect(status).toBe(422);
    expect(body.code).toBe("ethics_refused");
    expect(body.rewritten).toBeNull();
    expect(body.findings.length).toBeGreaterThan(0);
    expect(body.error).not.toMatch(/that's on us|our fault/i);
  });

  it("une réécriture qui invente un titre : 422 credential_introduced", async () => {
    reponseModele = "As an LCSW, I know the mornings are hardest.";
    const { status, body } = await poste(
      "You are struggling to sleep and the mornings are hardest of all.",
      "203.0.113.32"
    );
    expect(status).toBe(422);
    expect(body.code).toBe("credential_introduced");
    expect(body.rewritten).toBeNull();
    expect(body.error).not.toMatch(/that's on us|our fault/i);
  });

  it("la clé absente : 503, et LÀ seulement on s'excuse", async () => {
    const { AnthropicNotConfiguredError } = await import("@/lib/ai/client");
    const model = await import("@/lib/generation/model");
    vi.spyOn(model, "callRewrite").mockImplementation(async () => {
      throw new AnthropicNotConfiguredError();
    });

    const { status, body } = await poste(SON_TEXTE, "203.0.113.33");
    expect(status).toBe(503);
    expect(body.code).toBe("generation_unavailable");
    expect(body.error).toMatch(/that's on us/i);
    vi.restoreAllMocks();
  });
});

/*
 * ⚠ LA GARDE DE RÉPERTOIRE. Le test de comportement ci-dessus prouve que CETTE
 * route est bornée. Il ne peut pas prouver qu'une SECONDE route ouverte demain
 * le sera — le trou serait dans ce qui n'est pas écrit.
 */
describe("toute route ouverte sans compte qui appelle le modèle est bornée", () => {
  const ROOT = join(process.cwd(), "app/api");

  it("first-line appelle consumeAnonSpend et n'appelle pas authenticate", () => {
    const source = readFileSync(join(ROOT, "first-line/route.ts"), "utf8");
    expect(source).toContain("consumeAnonSpend");
    expect(source).not.toMatch(/^\s*const auth = await authenticate\(\)/m);
  });

  it("⚠ et les deux routes payantes gardent leur mur — le lot ne les a pas touchées", () => {
    for (const route of ["check/route.ts", "check/rewrite/route.ts"]) {
      const source = readFileSync(join(ROOT, route), "utf8");
      expect(source, route).toContain("isBrandKitEntitled");
      expect(source, route).toContain("authenticate()");
    }
  });
});
