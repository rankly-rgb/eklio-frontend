import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * ── ON TENTE L'ACHAT, ET ON EXIGE UN REFUS ──────────────────────────────
 *
 * `DECISIONS_NEEDED.md` §4, écrit au lot 1 :
 *
 *   « ⚠ Un siège se vend et ne livre rien. Il ne faut pas le mettre en vente
 *     avant L21. RIEN DANS LE CODE NE L'EMPÊCHE AUJOURD'HUI — c'est une
 *     décision de mise en vente, pas une garde technique. »
 *
 * Ce fichier est ce qui a changé cette phrase. Il ne LIT pas le code source
 * pour vérifier qu'une garde y figure : il appelle `createCheckoutSession`
 * avec chacun des trois SKU invendables et exige que rien n'atteigne Stripe.
 * Une garde dont on vérifie l'existence par `toContain` reste verte le jour où
 * elle est contournée par un chemin qu'on n'avait pas prévu.
 *
 * Son jumeau SQL : eklio-backend/supabase/tests/20260914190000_sellability.test.sql
 *
 * ⚠ LE MOCK STRIPE EST L'ASSERTION PRINCIPALE. `sessions.create` lève s'il est
 * appelé. Un test qui se contente d'attendre une exception passerait aussi si
 * la session Stripe avait été créée d'abord et l'erreur levée ensuite — c'est
 * à dire après que la cliente a vu une page de paiement.
 */

const sessionsCreate = vi.fn(() => {
  throw new Error(
    "Stripe a été appelé pour un SKU invendable. La garde est arrivée trop tard : " +
      "une session Checkout existe, et la cliente peut la payer."
  );
});
const customersCreate = vi.fn(() => {
  throw new Error(
    "Un customer Stripe a été créé pour un SKU invendable. Rien ne doit partir " +
      "vers Stripe avant que la vendabilité soit tranchée."
  );
});

vi.mock("@/lib/stripe/client", () => ({
  getStripeClient: () => ({
    checkout: { sessions: { create: sessionsCreate } },
    customers: { create: customersCreate },
  }),
  kitPriceId: () => "price_test",
  monthlyPresencePriceId: () => "price_test_monthly",
  StripeConfigError: class StripeConfigError extends Error {},
}));

vi.mock("@/lib/site-url", () => ({ siteUrl: () => "https://example.test" }));

import { UnsellableSkuError, createCheckoutSession } from "@/lib/stripe/checkout";

/*
 * `plans` telle qu'elle est en base au 14 septembre 2026, vérifiée contre le
 * projet vivant. Les trois `false` sont la décision ; les autres sont là pour
 * que le test prouve aussi que la garde LAISSE PASSER ce qui se vend.
 */
const PLANS: Record<string, boolean> = {
  foundation: true,
  roster: true,
  identity_addon: true,
  roster_seat: false,
  fill_solo: false,
  fill_practice: false,
};

/**
 * Un client Supabase réduit à ce que le chemin de checkout lit vraiment.
 *
 * Il ENREGISTRE l'ordre des tables lues, parce que l'ordre est la moitié de ce
 * qui est vérifié ici : une garde de vendabilité posée après la création du
 * customer Stripe ne garde plus rien.
 */
function fakeSupabase(options: { readFails?: boolean } = {}) {
  const readOrder: string[] = [];
  const client = {
    from(table: string) {
      readOrder.push(table);
      if (table === "plans") {
        return {
          select: () => ({
            eq: (_col: string, sku: string) => ({
              maybeSingle: async () => {
                if (options.readFails) {
                  return { data: null, error: { message: "connexion perdue" } };
                }
                if (!(sku in PLANS)) return { data: null, error: null };
                return { data: { sellable: PLANS[sku] }, error: null };
              },
            }),
          }),
        };
      }
      if (table === "profiles") {
        // Un customer déjà enregistré : `ensureStripeCustomer` rend la main
        // sans rien créer, et le chemin continue jusqu'à Stripe.
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { stripe_customer_id: "cus_test" },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "purchases") {
        return {
          select: () => ({
            eq: () => ({ eq: async () => ({ data: [], error: null }) }),
          }),
        };
      }
      throw new Error(`table inattendue dans le chemin de checkout : ${table}`);
    },
    readOrder,
  };
  return client as never as import("@supabase/supabase-js").SupabaseClient<
    import("@/types/supabase").Database
  > & { readOrder: string[] };
}

function attemptToBuy(sku: string, supabase = fakeSupabase()) {
  return createCheckoutSession(supabase, {
    userId: "11111111-1111-1111-1111-111111111111",
    email: "her@example.test",
    // Le type dit `KitTier` ; la base, elle, reçoit la chaîne. C'est
    // exactement ce que fera L20 ou L21 en élargissant l'entrée.
    tier: sku as never,
    projectId: null,
    withMonthlyPresence: false,
  });
}

describe("⚠ un SKU qu'on ne sait pas livrer ne peut pas être encaissé", () => {
  beforeEach(() => {
    sessionsCreate.mockClear();
    customersCreate.mockClear();
  });

  const UNSELLABLE = [
    {
      sku: "roster_seat",
      why: "un siège acheté ne produit rien tant que L21 n'a pas écrit le déclenchement",
    },
    { sku: "fill_solo", why: "le cycle mensuel vendu n'existe pas (L18)" },
    {
      sku: "fill_practice",
      why: "le cycle n'existe pas, et la quantité par siège ne s'écrit nulle part (L18 + L20)",
    },
  ];

  it.each(UNSELLABLE)("$sku est refusé — $why", async ({ sku }) => {
    await expect(attemptToBuy(sku)).rejects.toBeInstanceOf(UnsellableSkuError);

    // ⚠ L'assertion qui compte : rien n'est parti vers Stripe.
    expect(
      sessionsCreate,
      "une session Checkout a été créée pour un SKU qui ne livre rien"
    ).not.toHaveBeenCalled();
    expect(customersCreate).not.toHaveBeenCalled();
  });

  it("l'erreur porte le SKU, pour le journal serveur", async () => {
    await expect(attemptToBuy("fill_solo")).rejects.toMatchObject({
      sku: "fill_solo",
      name: "UnsellableSkuError",
    });
  });

  it("⚠ une lecture en ÉCHEC refuse aussi", async () => {
    /*
     * L'inverse de sa voisine `alreadyPaidFor`, qui rend `null` sur une
     * lecture ratée pour ne pas perdre une cliente sur un hoquet de base. Les
     * deux questions ne sont pas de la même nature : « a-t-elle déjà payé ce
     * projet » change d'une minute à l'autre et exige une lecture vivante ;
     * « cette ligne est-elle en vente » est un fait de catalogue, le même pour
     * tout le monde. Une absence de réponse sur un fait quasi statique n'ouvre
     * pas une caisse.
     */
    await expect(
      attemptToBuy("foundation", fakeSupabase({ readFails: true }))
    ).rejects.toBeInstanceOf(UnsellableSkuError);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("⚠ la vendabilité est la PREMIÈRE lecture du chemin", async () => {
    /*
     * Une garde juste ne sert à rien au mauvais endroit. `plans` doit être lue
     * avant `profiles` et avant `purchases` : dès qu'un customer Stripe existe,
     * quelque chose est parti vers Stripe pour une vente qu'on va refuser.
     */
    const supabase = fakeSupabase();
    await expect(attemptToBuy("roster_seat", supabase)).rejects.toBeInstanceOf(
      UnsellableSkuError
    );
    expect(supabase.readOrder).toEqual(["plans"]);
  });

  it("⚠ un SKU absent du catalogue est refusé, pas ignoré", async () => {
    /*
     * Sans cette branche, la garde ne garderait que les noms qu'on a pensé à
     * écrire : un SKU inconnu rendrait `data = null`, et un `!data.sellable`
     * écrit à la légère aurait laissé passer. C'est la forme locale du défaut
     * que ce dépôt appelle « une valeur qui disparaît sans erreur ».
     */
    await expect(attemptToBuy("a_sku_nobody_wrote")).rejects.toBeInstanceOf(
      UnsellableSkuError
    );
    expect(sessionsCreate).not.toHaveBeenCalled();
  });
});

describe("et la garde ne ferme pas ce qui se vend", () => {
  beforeEach(() => {
    sessionsCreate.mockClear();
    customersCreate.mockClear();
  });

  it.each(["foundation", "roster", "identity_addon"])(
    "%s passe la garde",
    async (sku) => {
      /*
       * ⚠ GARDE ANTI-ZÈLE. Une garde qui refuse tout est verte sur le bloc du
       * dessus et coûte l'intégralité du chiffre d'affaires. On ne va pas
       * jusqu'au bout du checkout — le mock lève dès `customers.create` — mais
       * l'erreur attendue N'EST PAS `UnsellableSkuError` : la garde a rendu la
       * main.
       */
      const supabase = fakeSupabase();
      await expect(attemptToBuy(sku, supabase)).rejects.not.toBeInstanceOf(
        UnsellableSkuError
      );
      expect(
        sessionsCreate,
        `${sku} n'a pas dépassé la garde de vendabilité`
      ).toHaveBeenCalled();
      // Et elle a bien été interrogée en premier, y compris sur un OUI.
      expect(supabase.readOrder[0]).toBe("plans");
    }
  );
});
