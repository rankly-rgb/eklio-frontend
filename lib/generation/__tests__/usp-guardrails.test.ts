import { describe, expect, it, vi } from "vitest";
import {
  fetchUspGuardrails,
  fetchUspSimilarityThreshold,
  fetchUspStopwords,
} from "@/lib/generation/usp-guardrails";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/*
 * Ces deux réglages viennent DE LA BASE (§ correction post-rapport) : gates
 * 2 et 3 doivent lire `usp_stopwords` et `app_settings.usp_similarity_threshold`
 * eux-mêmes, pas une copie tenue à jour côté frontend. Ces tests vérifient la
 * lecture PostgREST, pas les gates elles-mêmes (couvertes ailleurs).
 */

function fakeAdmin(stopwords: string[], thresholdValue: number) {
  const from = vi.fn((table: string) => {
    if (table === "usp_stopwords") {
      return {
        select: () => Promise.resolve({ data: stopwords.map((word) => ({ word })), error: null }),
      };
    }
    if (table === "app_settings") {
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: { value: thresholdValue }, error: null }),
          }),
        }),
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });
  return { from } as unknown as SupabaseClient<Database>;
}

describe("fetchUspStopwords", () => {
  it("renvoie l'ensemble des mots de la table, tels quels", async () => {
    const admin = fakeAdmin(["a", "the", "practice"], 0.55);
    const stopwords = await fetchUspStopwords(admin);
    expect(stopwords).toEqual(new Set(["a", "the", "practice"]));
  });
});

describe("fetchUspSimilarityThreshold", () => {
  it("lit le scalaire jsonb comme un nombre JS direct", async () => {
    const admin = fakeAdmin([], 0.55);
    const threshold = await fetchUspSimilarityThreshold(admin);
    expect(threshold).toBe(0.55);
  });
});

describe("fetchUspGuardrails", () => {
  it("récupère les deux ensemble", async () => {
    const admin = fakeAdmin(["a", "an"], 0.6);
    const guardrails = await fetchUspGuardrails(admin);
    expect(guardrails.stopwords).toEqual(new Set(["a", "an"]));
    expect(guardrails.similarityThreshold).toBe(0.6);
  });
});
