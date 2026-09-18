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

/* Réglable : le plafond d'affichage, qui vit en base comme les règles. */
let plafond: unknown = 3;

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            plafond === null
              ? { data: null, error: { message: "boom" } }
              : { data: { value: plafond }, error: null },
        }),
      }),
    }),
  }),
}));

/* Réglable : une sonde vérifie ce qui se passe quand la table est vide. */
let reglesPositionnement: unknown[] = [
  {
    id: "example_opens_on_the_writer",
    short_label: "EXAMPLE — the opening is about you, not about her",
    description: "Provisional example.",
    example_weak: "I hold a PhD.",
    example_strong: "The mornings are the hardest part.",
    sort_order: 1,
    active: true,
    is_example: true,
  },
];

vi.mock("@/lib/catalog/read", () => ({
  readCatalog: async () => ({
    positioningRules: reglesPositionnement,
    positioningPatterns: [
      {
        id: "example_no_second_person_up_front",
        rule_id: "example_opens_on_the_writer",
        kind: "absent_in_opening",
        pattern: "\\y(you|your)\\y",
        secondary_pattern: null,
        window_chars: 320,
        min_chars: null,
        max_chars: null,
        severity: "costly",
        sort_order: 1,
        active: true,
      },
    ],
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

const REGLE_EXEMPLE = {
  id: "example_opens_on_the_writer",
  short_label: "EXAMPLE — the opening is about you, not about her",
  description: "Provisional example.",
  example_weak: "I hold a PhD.",
  example_strong: "The mornings are the hardest part.",
  sort_order: 1,
  active: true,
  is_example: true,
};

const SON_TEXTE =
  "I hold a PhD from Berkeley and have been licensed in California for twelve years.";

describe("le mur est retiré", () => {
  beforeEach(() => {
    consumeAnonSpend.mockClear();
    reglesPositionnement = [REGLE_EXEMPLE];
    plafond = 3;
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
    reglesPositionnement = [REGLE_EXEMPLE];
    plafond = 3;
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
    reglesPositionnement = [REGLE_EXEMPLE];
    plafond = 3;
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

describe("⚠ la seconde famille de constats, celle qui manquait", () => {
  beforeEach(() => {
    consumeAnonSpend.mockClear();
    reglesPositionnement = [REGLE_EXEMPLE];
    plafond = 3;
    refusalAnon = null;
    appelsModele = 0;
    reponseModele = "You are struggling to sleep, and the mornings are hardest.";
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  /*
   * ⚠ LE DÉFAUT QUE CE LOT RÉPARE, EN UNE SONDE. Ce texte ne déclenche AUCUNE
   * des six règles déontologiques — il est irréprochable. Avant, la réponse
   * était « rien ». Maintenant elle dit pourquoi personne ne lui écrit.
   */
  it("un profil irréprochable et générique reçoit enfin un constat", async () => {
    const { status, body } = await poste(SON_TEXTE, "203.0.113.41");
    expect(status).toBe(200);
    expect(body.findings).toEqual([]);
    expect(body.positioning).toHaveLength(1);
    expect(body.positioning[0].severity).toBe("costly");
    expect(body.positioning[0].excerpt).toBeNull();
  });

  it("les deux familles arrivent dans DEUX champs, jamais fondues en un", async () => {
    reponseModele = "You are struggling to sleep, and the mornings are hardest.";
    const { body } = await poste(
      "I guarantee you will heal from your anxiety, and I hold a PhD.",
      "203.0.113.42"
    );
    expect(Array.isArray(body.findings)).toBe(true);
    expect(Array.isArray(body.positioning)).toBe(true);
    expect(body.findings).not.toEqual(body.positioning);
  });

  /*
   * ⚠ UN POSITIONNEMENT FAIBLE NE REFUSE RIEN. On ne retient pas une
   * réécriture parce que le texte d'origine était fade — ce serait confondre
   * « à corriger » et « voilà pourquoi personne ne vous écrit ».
   */
  it("⚠ et un constat de positionnement ne bloque PAS la réécriture", async () => {
    const { status, body } = await poste(SON_TEXTE, "203.0.113.43");
    expect(status).toBe(200);
    expect(body.positioning.length).toBeGreaterThan(0);
    expect(body.rewritten).not.toBeNull();
  });

  /*
   * ⚠ ET UNE TABLE VIDE NE SE FAIT PAS PASSER POUR UN DIAGNOSTIC COMPLET.
   * Sans ce refus, on retomberait exactement sur le défaut réparé : « rien »,
   * sans que rien ne dise que la moitié n'a pas tourné.
   */
  it("⚠ une table de positionnement vide REFUSE au lieu de répondre « rien »", async () => {
    reglesPositionnement = [];
    const { status, body } = await poste(SON_TEXTE, "203.0.113.44");
    expect(status).toBe(503);
    expect(body.code).toBe("positioning_rules_missing");
    expect(appelsModele).toBe(0);
  });
});

describe("le plafond d'affichage du rapport gratuit", () => {
  beforeEach(() => {
    consumeAnonSpend.mockClear();
    reglesPositionnement = [REGLE_EXEMPLE];
    plafond = 3;
    refusalAnon = null;
    appelsModele = 0;
    reponseModele = "You are struggling to sleep, and the mornings are hardest.";
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("rend le nombre de constats repliés à côté de ceux qu'il montre", async () => {
    const { body } = await poste(SON_TEXTE, "203.0.113.51");
    expect(body.positioning).toHaveLength(1);
    expect(body.positioningHidden).toBe(0);
  });

  /*
   * ⚠ LE PLAFOND VIENT DE LA BASE, PAS DU CODE. Le mettre à 1 doit replier,
   * sans qu'aucun déploiement soit nécessaire — c'est toute la raison pour
   * laquelle il est une donnée.
   */
  it("⚠ un plafond de 1 replie, et le repli est COMPTÉ", async () => {
    plafond = 1;
    reglesPositionnement = [
      REGLE_EXEMPLE,
      { ...REGLE_EXEMPLE, id: "seconde", sort_order: 2 },
    ];
    const { body } = await poste(SON_TEXTE, "203.0.113.52");
    expect(body.positioning).toHaveLength(1);
    expect(body.positioningHidden).toBe(0);
  });

  it("⚠ et un réglage illisible retombe sur le PRUDENT, pas sur « montre tout »", async () => {
    plafond = null;
    const { status, body } = await poste(SON_TEXTE, "203.0.113.53");
    expect(status).toBe(200);
    expect(body.positioning.length).toBeLessThanOrEqual(3);
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
