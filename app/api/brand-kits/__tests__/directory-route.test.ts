import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * ══════════════════════════════════════════════════════════════════════════
 * POST /api/brand-kits/[id]/directory — CHAQUE REFUS DIT LE SIEN
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ CETTE ROUTE N'AVAIT AUCUN TEST, et c'est par là que le trou est entré.
 * Elle écrit le profil Psychology Today — l'artefact le plus public du
 * produit, celui qui porte le titre d'exercice devant des gens qui cherchent
 * une thérapeute — et elle ne posait PAS la garde d'État. Zéro appel à
 * `project_state_is_sellable` dans tout `app/api` hors de
 * `POST /api/briefs/[id]/generate`.
 *
 * Personne ne l'a vu parce que personne ne l'a mesuré : le trou était dans ce
 * qui N'A PAS été écrit, et une relecture de la route ne le montre pas — le
 * fichier est juste, isolément.
 *
 * ── LA RÈGLE QUE CE FICHIER GARDE ───────────────────────────────────────
 *
 * UN REFUS QUI N'EST PAS UNE PANNE NE DOIT JAMAIS SE LIRE « C'EST DE NOTRE
 * FAUTE ». Dix sorties, huit phrases, et aucun code ne se replie sur un
 * autre :
 *
 *   (sans code)            429  trop de réécritures — pas une panne
 *   state_not_open         409  l'État n'est pas relevé — pas une panne
 *   ethics_refused         422  le texte enfreignait une règle — pas une panne
 *   cliche_refused         422  le texte est celui de tout l'annuaire — pas une panne
 *   prose_invalid          422  le gabarit n'est pas tenu — pas une panne
 *   ceiling_reached        429  deux essais, on s'arrête — pas une panne
 *   model_call_failed      502  le modèle n'a pas répondu — transitoire
 *   generation_unavailable 503  clé absente — LÀ, c'est bien de notre faute
 *
 * ⚠ `cliche_refused` A ÉTÉ AJOUTÉ APRÈS COUP, ET C'EST UN VRAI DÉFAUT QUI L'A
 * FAIT AJOUTER — pas une complétude théorique. Le 19 septembre, en
 * production : un brouillon portant « you deserve » traversait les deux
 * tentatives parce que le pré-scan ne connaissait que la moitié de la garde
 * de la base, `save_directory_profile` répondait 400 (sqlstate 23514), et la
 * route rendait le générique. La règle que ce fichier garde était écrite,
 * testée, et enfreinte à la seule ligne qui n'était pas sondée : celle du
 * retour de l'écriture.
 *
 * ⚠ DEUX PAIRES DE SORTIES PARTAGENT UNE PHRASE, ET C'EST VOULU. L'État non
 * relevé et la lecture qui échoue rendent le MÊME `state_not_open` ; le cliché
 * pris par le pré-scan et le cliché pris par la base rendent le MÊME
 * `cliche_refused`, parce que de son côté c'est le même événement et la même
 * action — et parce qu'une phrase qui compterait les essais serait fausse sur
 * l'un des deux chemins. Pour la lectrice,
 * les deux disent la même chose — nous ne savons pas si son État est ouvert,
 * donc nous n'imprimons pas. Distinguer « pas vérifié » de « pas pu vérifier »
 * lui donnerait une information qui ne lui sert à rien et nous ferait prétendre
 * à une précision que nous n'avons pas. La garde ci-dessous compte donc les
 * CODES, pas les sorties.
 *
 * Le générique n'est juste que sur la dernière ligne. Partout ailleurs il
 * ferait ouvrir un ticket pour un produit qui fonctionne, et il dirait à une
 * clinicienne que ses réponses n'y sont pour rien alors que la seule chose à
 * faire est de notre côté à nous, ou du sien.
 */

const KIT_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";

/* Ce que chaque sonde règle avant d'appeler la route. */
let sellable: unknown = true;
let generate: () => Promise<unknown> = async () => ({
  draft: {
    platform: "psychology_today",
    prose: { firstParagraph: "p", body: "b" },
    structured: {},
  },
  ethicsCheck: {},
  modelCalls: 2,
});

/*
 * ⚠ LE LIMITEUR EST NEUTRALISÉ PAR DÉFAUT, ET C'EST UN PIÈGE RENCONTRÉ ICI.
 * Il plafonne à 10 générations/heure sur la même `userId` : la première
 * version de ce fichier lançait ses sondes en boucle et recevait « That's a
 * lot of rewrites at once » à la onzième, en croyant mesurer autre chose. Une
 * sonde qui se fait refuser par un garde-fou qu'elle ne teste pas mesure le
 * garde-fou, pas la route.
 */
let limite: { allowed: boolean; retryAfterSeconds?: number } = { allowed: true };

/** Ce que `save_directory_profile` renvoie. `null` = l'écriture passe. */
let ecritureRefusee: { code: string; message: string } | null = null;

const rpc = vi.fn(async (name: string) => {
  if (name === "project_state_is_sellable") return { data: sellable, error: null };
  return { data: null, error: null };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1", email: "a@b.c" } } }) },
    rpc,
  }),
  /*
   * ⚠ LE REFUS DE LA BASE EST SONDABLE, parce que c'est PAR LÀ que le défaut
   * du 19 septembre est sorti : `save_directory_profile` a répondu 400 deux
   * fois et la route a rendu « Something didn't go through on our side ».
   */
  createAdminClient: () => ({ rpc: async () => ({ error: ecritureRefusee }) }),
}));

vi.mock("@/lib/data/brand-kit", () => ({
  loadBrandKit: async () => ({ id: KIT_ID, projectId: PROJECT_ID }),
}));

vi.mock("@/lib/billing/entitlements", () => ({
  isBrandKitEntitled: async () => true,
  resolveEntitledTier: async () => "foundation",
}));

vi.mock("@/lib/billing/surface-access", () => ({
  surfaceAccess: () => ({ ok: true }),
}));

vi.mock("@/lib/api/rate-limit", () => ({ rateLimit: () => limite }));

vi.mock("@/lib/catalog/read", () => ({ readCatalog: async () => ({}) }));

vi.mock("@/lib/data/directory", () => ({
  structuredInputFor: async () => ({
    bundle: { brief: { state: "OR" } },
    structured: { state: "OR" },
  }),
}));

/*
 * ⚠ LES CLASSES D'ERREUR RESTENT LES VRAIES. La route trie par `instanceof` :
 * des doublures les feraient toutes tomber dans le générique, et le test
 * passerait au vert en prouvant le contraire de ce qu'il croit prouver.
 */
vi.mock("@/lib/directory/generate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/directory/generate")>()),
  generateDirectoryProfile: () => generate(),
}));

const { POST } = await import("@/app/api/brand-kits/[id]/directory/route");
const {
  DirectoryCeilingError,
  DirectoryProseClicheError,
  DirectoryProseInvalidError,
  DirectoryProseRefusedError,
} = await import("@/lib/directory/generate");
const { AnthropicNotConfiguredError } = await import("@/lib/ai/client");
const Anthropic = (await import("@anthropic-ai/sdk")).default;

async function call() {
  const response = await POST(new Request("http://t/x", { method: "POST" }), {
    params: Promise.resolve({ id: KIT_ID }),
  });
  return { status: response.status, body: await response.json() };
}

/** Une sortie de la route : son code HTTP, son `code`, et un mot de sa phrase. */
type Sortie = {
  readonly nom: string;
  readonly arme: () => void;
  readonly status: number;
  readonly code: string | undefined;
  readonly panne: boolean;
};

const SORTIES: readonly Sortie[] = [
  {
    nom: "l'État n'est pas relevé",
    arme: () => {
      sellable = false;
    },
    status: 409,
    code: "state_not_open",
    panne: false,
  },
  {
    nom: "la base ne répond pas sur la vendabilité — on REFUSE, on ne passe pas",
    arme: () => {
      sellable = null;
    },
    status: 409,
    code: "state_not_open",
    panne: false,
  },
  {
    nom: "le texte enfreignait une règle déontologique",
    arme: () => {
      generate = async () => {
        throw new DirectoryProseRefusedError(["guaranteed"]);
      };
    },
    status: 422,
    code: "ethics_refused",
    panne: false,
  },
  {
    /*
     * ⚠ LE DÉFAUT MESURÉ EN PRODUCTION LE 19 SEPTEMBRE, en une sonde. Le
     * pré-scan ne connaissait que la moitié de la garde de la base : un
     * brouillon portant « you deserve » passait les deux tentatives, mourait
     * au `save_directory_profile` (400, sqlstate 23514) et la route rendait le
     * générique. Elle a lu « c'est de notre faute » et a recliqué.
     */
    nom: "⚠ le texte employait un cliché d'annuaire — refusé par le PRÉ-SCAN",
    arme: () => {
      generate = async () => {
        throw new DirectoryProseClicheError(["you deserve"]);
      };
    },
    status: 422,
    code: "cliche_refused",
    panne: false,
  },
  {
    /*
     * ⚠ LE MÊME REFUS, VENU DE LA BASE. Il ne devrait plus arriver — le
     * pré-scan appelle désormais la MÊME fonction — mais il reste possible si
     * une phrase est ajoutée à `banned_phrases` entre le scan et l'écriture.
     * Ce qu'on garde ici est qu'il ne redevienne JAMAIS un 500 générique.
     */
    nom: "⚠ la BASE refuse l'écriture (23514) — un refus, pas une panne",
    arme: () => {
      ecritureRefusee = { code: "23514", message: "Directory cliche: you deserve" };
    },
    status: 422,
    code: "cliche_refused",
    panne: false,
  },
  {
    nom: "le gabarit n'est pas tenu",
    arme: () => {
      generate = async () => {
        throw new DirectoryProseInvalidError(["body_too_long"]);
      };
    },
    status: 422,
    code: "prose_invalid",
    panne: false,
  },
  {
    nom: "le plafond de deux essais est atteint",
    arme: () => {
      generate = async () => {
        throw new DirectoryCeilingError(2);
      };
    },
    status: 429,
    code: "ceiling_reached",
    panne: false,
  },
  {
    nom: "le modèle n'a pas répondu",
    arme: () => {
      generate = async () => {
        throw new Anthropic.APIError(500, undefined, "boom", undefined);
      };
    },
    status: 502,
    code: "model_call_failed",
    panne: false,
  },
  {
    /*
     * ⚠ SANS CODE, et c'est un écart relevé, pas approuvé : les six autres en
     * portent un. La cliente ne peut pas le distinguer par programme du 429 du
     * plafond de modèle. Il respecte la règle — il ne s'excuse pas — donc il
     * n'est pas corrigé ici. Il est mesuré pour qu'il se voie.
     */
    nom: "le plafond horaire de réécritures est atteint",
    arme: () => {
      limite = { allowed: false, retryAfterSeconds: 60 };
    },
    status: 429,
    code: undefined,
    panne: false,
  },
  {
    nom: "ANTHROPIC_API_KEY est absente — la seule vraie panne",
    arme: () => {
      generate = async () => {
        throw new AnthropicNotConfiguredError();
      };
    },
    status: 503,
    code: "generation_unavailable",
    panne: true,
  },
];

describe("chaque refus de la route directory dit le sien", () => {
  beforeEach(() => {
    limite = { allowed: true };
    sellable = true;
    ecritureRefusee = null;
    generate = async () => ({
      draft: {
        platform: "psychology_today",
        prose: { firstParagraph: "p", body: "b" },
        structured: {},
      },
      ethicsCheck: {},
      modelCalls: 2,
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("laisse passer quand tout va bien — sinon les refus ci-dessous ne prouvent rien", async () => {
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body).toMatchObject({ ok: true });
  });

  it.each(SORTIES.map((s) => [s.nom, s] as const))(
    "%s rend son propre code et sa propre phrase",
    async (_nom, sortie) => {
      sortie.arme();
      const { status, body } = await call();

      expect(status).toBe(sortie.status);
      expect(body.code).toBe(sortie.code);
      expect(typeof body.error).toBe("string");
      expect(body.error.length).toBeGreaterThan(0);
    }
  );

  /*
   * ⚠ LA GARDE QUI COMPTE. Sans elle, on pourrait replier six des huit
   * sorties sur le générique et les assertions ci-dessus passeraient encore
   * — chacune vérifie sa ligne, aucune ne vérifie qu'elles DIFFÈRENT.
   */
  it("⚠ et un code = une phrase, deux codes = deux phrases", async () => {
    const parCode = new Map<string, Set<string>>();
    for (const sortie of SORTIES) {
      limite = { allowed: true };
      sellable = true;
      ecritureRefusee = null;
      generate = async () => ({
        draft: { platform: "x", prose: { firstParagraph: "p", body: "b" }, structured: {} },
        ethicsCheck: {},
        modelCalls: 1,
      });
      sortie.arme();
      const { body } = await call();

      const cle = sortie.code ?? `(sans code, ${sortie.status})`;
      parCode.set(cle, (parCode.get(cle) ?? new Set()).add(body.error));
    }

    // Un code ne dit jamais deux choses différentes.
    for (const [code, phrases] of parCode) {
      expect(phrases.size, `${code} rend ${phrases.size} phrases différentes`).toBe(1);
    }

    // Et deux codes ne disent jamais la même : sans ceci, on pourrait replier
    // six des huit sorties sur le générique et tout le reste passerait encore.
    const phrases = new Set([...parCode.values()].flatMap((p) => [...p]));
    expect(phrases.size).toBe(parCode.size);
  });

  /*
   * ⚠ ET LE « C'EST DE NOTRE FAUTE » NE SORT QUE POUR LA PANNE. C'est la règle
   * en une assertion : sept refus sur huit ne doivent PAS s'excuser, parce
   * qu'ils n'ont pas à s'excuser — ils disent ce qui manque et à qui de jouer.
   */
  it("⚠ ne dit « that's on us » que sur la seule vraie panne", async () => {
    for (const sortie of SORTIES) {
      limite = { allowed: true };
      sellable = true;
      ecritureRefusee = null;
      generate = async () => ({
        draft: { platform: "x", prose: { firstParagraph: "p", body: "b" }, structured: {} },
        ethicsCheck: {},
        modelCalls: 1,
      });
      sortie.arme();
      const { body } = await call();

      expect(
        /that's on us|on our side|our fault/i.test(body.error),
        `« ${sortie.nom} » ${sortie.panne ? "devrait" : "ne devrait PAS"} s'excuser : ${body.error}`
      ).toBe(sortie.panne);
    }
  });
});

/*
 * ══════════════════════════════════════════════════════════════════════════
 * LA GARDE DE RÉPERTOIRE — celle qui aurait vu le trou
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Le test de comportement ci-dessus prouve que la route REFUSE bien. Il ne
 * peut pas prouver qu'une SEPTIÈME route, écrite demain, posera la garde : le
 * trou est dans ce qui n'est pas écrit, et seul un test de source l'atteint.
 *
 * ⚠ LA LISTE EST DÉCLARÉE, PAS DÉDUITE. Une nouvelle route qui imprime un
 * credential et n'apparaît pas ici fait échouer ce test — ce qui est le seul
 * moment où quelqu'un se demandera si elle doit vérifier l'État.
 */
const IMPRIMENT_UN_CREDENTIAL = [
  "app/api/brand-kits/[id]/directory/route.ts",
  "app/api/briefs/[id]/generate/route.ts",
].sort();

function routes(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return entry === "__tests__" ? [] : routes(full);
    return entry === "route.ts" ? [full] : [];
  });
}

describe("toute route qui imprime un titre d'exercice vérifie l'État", () => {
  const racine = join(process.cwd(), "app/api");
  const trouvees = routes(racine)
    .filter((f) => readFileSync(f, "utf8").includes("project_state_is_sellable"))
    .map((f) => f.slice(racine.length - "app/api".length))
    .sort();

  it("les routes qui posent la garde sont exactement celles qui le doivent", () => {
    expect(trouvees).toEqual(IMPRIMENT_UN_CREDENTIAL);
  });

  it.each(IMPRIMENT_UN_CREDENTIAL)("%s appelle project_state_is_sellable", (route) => {
    expect(readFileSync(join(process.cwd(), route), "utf8")).toContain(
      "project_state_is_sellable"
    );
  });

  /*
   * ⚠ ET LA PHRASE DU REFUS N'EXISTE QU'UNE FOIS. Deux copies, c'est deux
   * définitions de « ouvert », et la plus permissive gagne le jour où elles
   * divergent — la famille de défauts que ce dépôt révoque à la main.
   */
  it("⚠ le refus d'État est écrit à UN seul endroit", () => {
    const porteurs = routes(join(process.cwd(), "app/api")).filter((f) =>
      readFileSync(f, "utf8").includes("state's licensing board")
    );
    expect(porteurs).toEqual([]);
  });
});
