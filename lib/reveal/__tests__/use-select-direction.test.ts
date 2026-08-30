import { describe, expect, it } from "vitest";
import { resolveDirectionSelection } from "@/lib/reveal/use-select-direction";

/*
 * `resolveDirectionSelection` — le SEUL endroit qui décide ce qu'une réponse
 * de `POST /api/brand-kits/[id]/direction` signifie, que l'appelant soit
 * l'Acte 2 de la cérémonie ou (plus tard) la vue Compare. Un même comportement
 * ici garantit qu'ils restent le même chemin de code, pas deux copies qui
 * dérivent.
 */

describe("resolveDirectionSelection", () => {
  it("reads a 402 as a redirect to the offered checkout", async () => {
    const response = new Response(
      JSON.stringify({ checkoutUrl: "/app/checkout?project=p1" }),
      { status: 402 }
    );
    const result = await resolveDirectionSelection(response);
    expect(result).toEqual({ kind: "redirect", url: "/app/checkout?project=p1" });
  });

  it("falls back to /pricing when a 402 body has no checkoutUrl", async () => {
    const response = new Response("not json", { status: 402 });
    const result = await resolveDirectionSelection(response);
    expect(result).toEqual({ kind: "redirect", url: "/pricing" });
  });

  it("reads a non-402 failure as an error carrying the server's message", async () => {
    const response = new Response(
      JSON.stringify({ error: "This brand kit has no directions yet." }),
      { status: 400 }
    );
    const result = await resolveDirectionSelection(response);
    expect(result).toEqual({
      kind: "error",
      message: "This brand kit has no directions yet.",
    });
  });

  it("falls back to a generic message when a failure body is unreadable", async () => {
    const response = new Response("", { status: 500 });
    const result = await resolveDirectionSelection(response);
    expect(result).toEqual({
      kind: "error",
      message: "That didn't go through. Try again.",
    });
  });

  it("reads a 2xx as success", async () => {
    const response = new Response(JSON.stringify({ ok: true }), { status: 200 });
    const result = await resolveDirectionSelection(response);
    expect(result).toEqual({ kind: "success" });
  });
});
