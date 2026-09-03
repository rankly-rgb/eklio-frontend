import { describe, expect, it } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { generationErrorResponse } from "@/lib/api/handler";
import { AnthropicNotConfiguredError } from "@/lib/ai/client";

/*
 * The bug this locks in: `POST /api/briefs/{id}/usp-options` returned a
 * generic 500 whose message the frontend then overrode with a fixed
 * "these weren't truly yours" string, regardless of whether the real cause
 * was a guardrail rejection, a model failure, or (what actually happened,
 * confirmed from a real request) a missing ANTHROPIC_API_KEY. Three
 * different events; the fix is that they read as three different things,
 * including the status code — not just the message.
 */

function rateLimitError(): InstanceType<typeof Anthropic.RateLimitError> {
  // Anthropic.APIError's constructor shape isn't meant for hand-construction
  // in tests, but `instanceof` is all generationErrorResponse checks — a
  // real subclass instance is the honest way to prove that check, not a
  // duck-typed object pretending to be one.
  return new Anthropic.RateLimitError(429, {}, "rate limited", new Headers());
}

describe("generationErrorResponse", () => {
  it("gives AnthropicNotConfiguredError its own status and an honest, non-content-shaped message", async () => {
    const res = generationErrorResponse("test", new AnthropicNotConfiguredError());
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.code).toBe("generation_unavailable");
    // Must not resemble a judgment about the content she wrote.
    expect(body.error.toLowerCase()).not.toContain("yours");
    expect(body.error.toLowerCase()).toContain("on us");
  });

  it("gives a real Anthropic.APIError its own status and message, distinct from the config case", async () => {
    const res = generationErrorResponse("test", rateLimitError());
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.code).toBe("model_call_failed");
    expect(body.code).not.toBe("generation_unavailable");
  });

  it("falls back to the generic serverError shape for anything else, unchanged", async () => {
    const res = generationErrorResponse("test", new Error("some unrelated bug"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Something didn't go through on our side. Your answers are saved.");
    expect(body.code).toBeUndefined();
  });

  it("treats a plain thrown string the same as any other unclassified error", async () => {
    const res = generationErrorResponse("test", "not even an Error instance");
    expect(res.status).toBe(500);
  });
});
