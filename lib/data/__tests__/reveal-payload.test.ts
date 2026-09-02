import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { loadRevealPayload } from "@/lib/data/reveal";
import {
  SAMPLE_DIRECTIONS,
  SAMPLE_PRACTICE_NAME,
  SAMPLE_PRACTITIONER_LINE,
} from "@/lib/brand/sample";
import { SAMPLE_VOICE_GUIDE, SAMPLE_SOCIAL_TEMPLATES } from "@/lib/brand/sample";

/*
 * `loadRevealPayload` — la lecture, et les trois formes que la RPC peut
 * renvoyer : l'enveloppe, `{error:{code:"unauthenticated"}}`,
 * `{error:{code:"not_found"}}`. Une quatrième forme — une réponse qui ne
 * correspond à aucune des deux — doit se rendre en `invalid_response`, pas en
 * exception : un kit écrit avant une évolution du schéma ne doit pas planter
 * l'écran de révélation.
 */

const CONTRAST_STUB = {
  pairs: [
    {
      pair_id: "dark_neutral_on_paper",
      label: "Body text on the page",
      fg: "#2B2A27",
      bg: "#FAF6EE",
      ratio: 13.31,
      level: "AAA" as const,
    },
  ],
  worst_ratio: 13.31,
  passes_aa: true,
};

function samplePayload() {
  return {
    brand_kit_id: "kit-1",
    practice: {
      name: SAMPLE_PRACTICE_NAME,
      city: "Portland",
      state: "OR",
      specialties: ["Anxiety", "Burnout", "Life transitions"],
    },
    practitioner_line: SAMPLE_PRACTITIONER_LINE,
    voice_guide: SAMPLE_VOICE_GUIDE,
    social_templates: SAMPLE_SOCIAL_TEMPLATES,
    directions: SAMPLE_DIRECTIONS.map((direction) => ({
      ...direction,
      contrast: CONTRAST_STUB,
      ambiance_url: null,
    })),
  };
}

function clientReturning(data: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return { supabase: { rpc } as unknown as SupabaseClient<Database>, rpc };
}

describe("loadRevealPayload", () => {
  it("parses a well-formed envelope", async () => {
    const { supabase, rpc } = clientReturning(samplePayload());
    const outcome = await loadRevealPayload(supabase, "kit-1");
    expect(rpc).toHaveBeenCalledWith("brand_kit_reveal_get", {
      p_brand_kit_id: "kit-1",
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.payload.directions).toHaveLength(3);
      expect(outcome.payload.practice.name).toBe(SAMPLE_PRACTICE_NAME);
    }
  });

  it("passes through unauthenticated", async () => {
    const { supabase } = clientReturning({
      error: { code: "unauthenticated", message: "Sign in." },
    });
    const outcome = await loadRevealPayload(supabase, "kit-1");
    expect(outcome).toEqual({ ok: false, reason: "unauthenticated" });
  });

  it("passes through not_found", async () => {
    const { supabase } = clientReturning({
      error: { code: "not_found", message: "No brand kit here." },
    });
    const outcome = await loadRevealPayload(supabase, "kit-1");
    expect(outcome).toEqual({ ok: false, reason: "not_found" });
  });

  it("never returns payment_required: an unrecognised code falls back to invalid_response", async () => {
    const { supabase } = clientReturning({
      error: { code: "payment_required", message: "should never happen" },
    });
    const outcome = await loadRevealPayload(supabase, "kit-1");
    expect(outcome).toEqual({ ok: false, reason: "invalid_response" });
  });

  it("treats a transport error as invalid_response, not a throw", async () => {
    const { supabase } = clientReturning(null, { message: "network blip" });
    const outcome = await loadRevealPayload(supabase, "kit-1");
    expect(outcome).toEqual({ ok: false, reason: "invalid_response" });
  });

  it("rejects a shape that does not match the schema instead of crashing the screen", async () => {
    const { supabase } = clientReturning({ directions: [] });
    const outcome = await loadRevealPayload(supabase, "kit-1");
    expect(outcome).toEqual({ ok: false, reason: "invalid_response" });
  });
});
