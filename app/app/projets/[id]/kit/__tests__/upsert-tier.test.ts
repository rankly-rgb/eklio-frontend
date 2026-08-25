import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Le tier écrit en base à la génération d'un kit.
 *
 * ── Pourquoi ce test existe ──────────────────────────────────────────────
 *
 * `brand_kits.tier` a un DÉFAUT `'starter'` en base. Un upsert qui n'écrirait
 * pas la colonne explicitement enregistrerait donc tout kit en `starter`, quel
 * que soit le tier réellement acheté — un praticien Signature verrait sa page
 * de kit annoncer « Starter », et le jour où le tier livré servira à autre
 * chose qu'un libellé, ce sera un livrable rogné sans que personne ait rien
 * décidé. Le défaut d'une colonne est un piège silencieux : il ne lève pas, il
 * ment.
 *
 * Le risque symétrique est la DOUBLE ÉCRITURE. Tant que `brand_kits.tier`
 * n'existait pas (Lot 3), le tier vivait dans le jsonb `content`. Écrire les
 * deux ferait cohabiter deux copies d'un même fait, et deux copies finissent
 * toujours par diverger — c'est exactement le désalignement colonne/JSONB
 * qu'on cherche à éviter.
 *
 * D'où le contrat figé ici : UN SEUL ÉCRIVAIN, la colonne, et un jsonb qui ne
 * porte plus le tier du tout. Colonne et `content` ne peuvent pas se
 * contredire parce qu'il n'y a rien à contredire. Les kits d'avant le Lot 4
 * gardent leur `content.tier` et restent relus (cf. `lib/kit/content.ts`), mais
 * plus rien ne l'écrit.
 */

const upsertCalls: { table: string; payload: Record<string, unknown> }[] = [];
const generateBrandKit = vi.fn();

/** Requête Supabase factice : chaînable, et « awaitable » comme la vraie. */
function builder(result: unknown) {
  const self: Record<string, unknown> = {
    select: () => self,
    eq: () => self,
    or: () => self,
    is: () => self,
    order: () => self,
    maybeSingle: async () => result,
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(result).then(resolve),
  };
  return self;
}

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const DIRECTION_ID = "22222222-2222-4222-8222-222222222222";

/** Tier renvoyé par `purchases` — c'est le droit acheté que le test pilote. */
let purchasedTier = "signature";

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: "user-1", email: "clinician@example.com" } },
      }),
    },
    from(table: string) {
      switch (table) {
        case "projects":
          return {
            ...builder({ data: { id: PROJECT_ID, name: "Hearth Counseling" } }),
            update: () => builder({ error: null }),
          };
        case "project_briefs":
          return builder({
            data: { data: { practice_name: "Hearth Counseling", pages_wanted: [] } },
          });
        case "directions":
          return builder({
            data: {
              id: DIRECTION_ID,
              name: "Quiet Hearth",
              description: "A composed, unhurried presence.",
              palette: { primary: "#2C4A6E" },
              typographie_titre: "Fraunces",
              typographie_corps: "Inter",
            },
          });
        case "purchases":
          return builder({
            data: [{ tier: purchasedTier, project_id: PROJECT_ID }],
            error: null,
          });
        case "brand_kits":
          return {
            ...builder({ data: { share_slug: "hearth-abc1234" } }),
            upsert: (payload: Record<string, unknown>) => {
              upsertCalls.push({ table, payload });
              return builder({ error: null });
            },
          };
        default:
          throw new Error(`table inattendue dans ce test : ${table}`);
      }
    },
  }),
}));

vi.mock("@/lib/ai/kit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai/kit")>()),
  generateBrandKit,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

/* `redirect()` lève en vrai : on reproduit ce contrat, sinon le code continue. */
class RedirectSignal extends Error {}
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new RedirectSignal("redirect");
  },
}));

const { generateKit } = await import("@/app/app/projets/[id]/kit/actions");
const { KIT_TIERS } = await import("@/lib/kit/tiers");

function kitGeneration() {
  return {
    positioning_statement: "A couples practice for partners who keep circling.",
    brand_story: "Why this practice exists.",
    voice_and_tone: {
      adjectives: ["warm", "direct", "unhurried"],
      do_examples: ["A first session is ninety minutes."],
      dont_examples: ["Naming a timeframe for how someone will feel."],
    },
    website_copy: [
      { page: "home", sections: [{ heading: "Welcome", body: "Body copy." }] },
      { page: "about", sections: [{ heading: "Who I am", body: "Body copy." }] },
      { page: "approach", sections: [{ heading: "How I work", body: "Body." }] },
      { page: "contact", sections: [{ heading: "Reach out", body: "Body." }] },
    ],
    social_templates: [],
    website_prompt: "Build a site using #2C4A6E and Fraunces.",
  };
}

/** Lance une génération et rend la charge utile envoyée à l'upsert. */
async function runGeneration(tier: string) {
  purchasedTier = tier;
  upsertCalls.length = 0;

  generateBrandKit.mockImplementation(async (input: { scope: { pages: string[] } }) => ({
    ...kitGeneration(),
    // Le kit rendu couvre exactement le périmètre demandé, sinon `applyScope`
    // lèverait avant la moindre écriture.
    website_copy: input.scope.pages.map((page) => ({
      page,
      sections: [{ heading: "Heading", body: "Body copy." }],
    })),
  }));

  await expect(generateKit(PROJECT_ID)).rejects.toBeInstanceOf(RedirectSignal);

  expect(upsertCalls).toHaveLength(1);
  return upsertCalls[0].payload;
}

beforeEach(() => {
  generateBrandKit.mockReset();
});

describe("upsert du kit — le tier va en COLONNE", () => {
  it("écrit le tier acheté dans la colonne, jamais le défaut de la base", async () => {
    const payload = await runGeneration("signature");

    expect(payload.tier).toBe("signature");
    // Le piège précis : `brand_kits.tier` vaut `'starter'` par défaut. Si la
    // colonne n'était pas écrite, ce test verrait `undefined` — et la base,
    // elle, verrait `'starter'` sans rien signaler.
    expect(payload.tier).not.toBeUndefined();
    expect(payload.tier).not.toBe("starter");
  });

  it("écrit le tier réellement résolu, pour chacun des trois tiers", async () => {
    for (const tier of KIT_TIERS) {
      const payload = await runGeneration(tier);
      expect(payload.tier).toBe(tier);
    }
  });
});

describe("colonne et content ne peuvent pas se contredire", () => {
  it("n'écrit AUCUN tier dans le jsonb `content`", async () => {
    const payload = await runGeneration("practice");
    const content = payload.content as Record<string, unknown>;

    /*
     * Le cœur du contrat. Il n'y a qu'un seul écrivain du tier — la colonne —
     * donc colonne et `content` ne peuvent pas diverger : il n'y a rien dans
     * `content` avec quoi diverger. Si quelqu'un réintroduit
     * `{ ...content, tier }` ici, ce test tombe, et c'est le but : deux copies
     * d'un même fait finissent toujours par se contredire.
     */
    expect(content).not.toHaveProperty("tier");
    expect(payload.tier).toBe("practice");
  });

  it("laisse `content` porter le livrable, et le prompt sa propre colonne", async () => {
    const payload = await runGeneration("practice");
    const content = payload.content as Record<string, unknown>;

    expect(content).toHaveProperty("positioning_statement");
    expect(content).toHaveProperty("website_copy");
    // Le prompt multi-plateformes a sa colonne au schéma : lui non plus n'est
    // pas dupliqué dans le jsonb.
    expect(content).not.toHaveProperty("website_prompt");
    expect(payload.multi_builder_prompt).toBe(
      "Build a site using #2C4A6E and Fraunces."
    );
  });

  it("le périmètre généré suit le tier écrit en colonne", async () => {
    // Ce que la colonne raconte est ce qui a réellement été livré : Starter
    // plafonne à 3 pages, Signature n'en plafonne aucune.
    const starter = await runGeneration("starter");
    expect(starter.tier).toBe("starter");
    expect((starter.content as { website_copy: unknown[] }).website_copy).toHaveLength(3);

    const signature = await runGeneration("signature");
    expect(signature.tier).toBe("signature");
    expect(
      (signature.content as { website_copy: unknown[] }).website_copy
    ).toHaveLength(4);
  });
});
