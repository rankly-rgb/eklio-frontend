import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

/*
 * ── LE DOUBLE PAIEMENT, MESURÉ PUIS FERMÉ ───────────────────────────────
 *
 * Exercé en session 4 contre la base de production, en transaction annulée :
 * deux sessions Checkout pour le MÊME projet et le MÊME palier écrivaient deux
 * lignes `purchases` et ouvraient DEUX allocations. $158 encaissés pour un kit
 * à $79, et rien dans le schéma ne l'a remarqué — `purchases` est unique sur
 * l'id de session Stripe, et une seconde pression obtient une seconde session.
 *
 * Il n'y a AUCUNE primitive de remboursement dans ce produit. La garde doit
 * donc être devant le paiement, jamais derrière.
 */

describe("⚠ on ne facture pas deux fois le même kit", () => {
  const CHECKOUT = read("lib/stripe/checkout.ts");
  const ACTION = read("app/app/checkout/actions.ts");

  it("la garde est AVANT la création de la session Stripe", () => {
    const guard = CHECKOUT.indexOf("alreadyPaidFor(supabase, projectId, tier)");
    const customer = CHECKOUT.indexOf("ensureStripeCustomer(supabase");
    const create = CHECKOUT.indexOf("checkout.sessions.create");
    expect(guard).toBeGreaterThan(-1);
    // Une garde posée après l'appel à Stripe ne garde rien du tout.
    expect(guard).toBeLessThan(customer);
    expect(guard).toBeLessThan(create);
  });

  it("elle ne bloque PAS une montée en gamme", () => {
    /*
     * Starter puis Signature est un vrai achat. La règle est celle de tout le
     * reste du produit : ce qu'elle possède est le plus généreux de ses achats.
     */
    expect(CHECKOUT).toContain("tierRank(owned) >= tierRank(tier)");
  });

  it("⚠ une lecture en échec ne refuse PAS la vente", () => {
    /*
     * Toutes les autres règles « fail closed » de ce produit gardent un
     * livrable ; celle-ci garde un PAIEMENT, et les deux pointent en sens
     * inverse. Refuser un checkout parce qu'une lecture a échoué transforme un
     * hoquet de base en cliente perdue, alors que ce contre quoi elle protège
     * — une seconde facturation — est visible, remboursable à la main, et
     * inscrit dans `purchases`.
     */
    const fn = CHECKOUT.slice(
      CHECKOUT.indexOf("async function alreadyPaidFor("),
      CHECKOUT.indexOf("export async function createCheckoutSession(")
    );
    expect(fn).toMatch(/if \(error\)[\s\S]{0,200}return null;/);
  });

  it("elle ne regarde que les achats PAYÉS", () => {
    // Un `pending` (paiement différé) ou un `failed` n'a rien acheté ; refuser
    // sur eux enfermerait quelqu'un dehors après un virement refusé.
    const fn = CHECKOUT.slice(
      CHECKOUT.indexOf("async function alreadyPaidFor("),
      CHECKOUT.indexOf("export async function createCheckoutSession(")
    );
    expect(fn).toContain('.eq("status", "paid")');
  });

  it("elle est SAUTÉE quand il n'y a pas de projet", () => {
    // Un checkout parti de `/pricing` n'a pas encore de projet : il n'y a rien
    // à comparer, et refuser serait refuser la première vente.
    expect(CHECKOUT).toMatch(/if \(projectId\) \{[\s\S]{0,200}alreadyPaidFor/);
  });

  it("elle donne une phrase, pas une panne", () => {
    expect(ACTION).toContain("AlreadyPurchasedError");
    const branch = ACTION.slice(ACTION.indexOf("AlreadyPurchasedError)"));
    expect(branch).toMatch(/already paid/i);
    // Et elle dit qu'on ne lui a rien pris de plus, ce qui est la question
    // qu'elle se pose à cette seconde précise.
    expect(branch).toMatch(/nothing new was charged/i);
  });
});
