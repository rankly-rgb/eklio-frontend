import { describe, expect, it } from "vitest";
import { readOffer } from "@/lib/api/offer";

/*
 * Un 402 dit comment CONTINUER, pas ce qui a échoué.
 */

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("readOffer", () => {
  it("lit l'adresse du checkout que la route a jointe", async () => {
    const offer = await readOffer(
      response(402, {
        error: "This one's ready when you are.",
        checkoutUrl: "/app/checkout?project=p1",
      })
    );

    expect(offer).toEqual({
      checkoutUrl: "/app/checkout?project=p1",
      message: "This one's ready when you are.",
    });
  });

  it("ne prend pas un autre refus pour une offre", async () => {
    // Un 400 ou un 404 reste une erreur à afficher : les confondre enverrait
    // quelqu'un au paiement pour une faute de frappe.
    expect(await readOffer(response(400, { error: "nope" }))).toBeNull();
    expect(await readOffer(response(404, {}))).toBeNull();
    expect(await readOffer(response(200, { jobId: "k1" }))).toBeNull();
  });

  it("retombe sur les tarifs plutôt que sur un cul-de-sac", async () => {
    const offer = await readOffer(new Response("not json", { status: 402 }));
    expect(offer?.checkoutUrl).toBe("/pricing");
    expect(offer?.message).toBeNull();
  });
});
