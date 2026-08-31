import { describe, expect, it, vi } from "vitest";
import {
  generateUspOptions,
  partialMessageFor,
} from "@/lib/generation/usp-options";
import type { UspGuardrails } from "@/lib/generation/usp-guardrails";
import type { Catalog } from "@/lib/catalog/types";
import type { BriefBundle } from "@/lib/data/brief";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

/*
 * L'orchestration du pipeline à quatre portes (§2.5, §2.7) :
 *   - l'ordre des portes : un candidat banni ne doit JAMAIS atteindre le RPC
 *     de collision (gate 4) ;
 *   - la reprise transmet les formulations refusées, et il n'y a jamais de
 *     troisième appel modèle ;
 *   - `partial: true` quand moins de trois survivent après la reprise.
 */

const catalog = {
  licenseTypes: [{ id: "lcsw", label: "LCSW" }],
  specialties: [{ id: "trauma", label: "Trauma", sort_order: 1 }],
  problemCards: [],
  gainCards: [],
  personaCards: [],
  notAFitCards: [],
  modalityCards: [{ id: "emdr", label: "EMDR" }],
  sessionStyleCards: [
    { id: "reflective", label: "Reflective", voice_hints: ["curious"] },
  ],
  modalityProminenceOptions: [{ id: "mention_it", label: "Mention it" }],
} as unknown as Catalog;

function bundle(): BriefBundle {
  return {
    project: { id: "brief-1" } as BriefBundle["project"],
    data: {},
    brief: {
      practice_name: "Elm & Ember",
      license_type_id: "lcsw",
      specialty_ids: ["trauma"],
      city: "Portland",
      state: "OR",
      problem_card_ids: [],
      gain_card_ids: [],
      client_persona_ids: [],
      session_style_ids: ["reflective"],
      not_a_fit_ids: [],
      not_a_fit_text: null,
      modality_ids: ["emdr"],
      modality_prominence: "mention_it",
      referral_quote:
        "She works with first responders carrying trauma from the job.",
      prior_career: null,
      prior_career_public: false,
    } as unknown as BriefBundle["brief"],
  };
}

function candidate(
  id: string,
  angle: "population" | "method" | "lived_experience",
  statement: string,
) {
  return {
    id,
    angle,
    statement,
    rationale: "Because it reuses what she wrote, in her own words, honestly.",
    evidence: ["referral_quote"],
  };
}

/** Un admin Supabase minimal : seul `.rpc("usp_check_distinct", …)` est utilisé ici. */
function fakeAdmin(distinct: boolean): SupabaseClient<Database> {
  return {
    rpc: vi.fn(async () => ({
      data: {
        distinct,
        best_similarity: distinct ? 0.1 : 0.9,
        conflicting_statement: null,
      },
      error: null,
    })),
  } as unknown as SupabaseClient<Database>;
}

/*
 * `usp_stopwords`/`app_settings.usp_similarity_threshold` vivent en base
 * (`lib/generation/usp-guardrails.ts`) ; ces tests n'y touchent pas et
 * injectent donc `fetchGuardrails` plutôt que de faire semblant que `admin`
 * sait répondre à `.from(...)`. La liste et le seuil ci-dessous sont un
 * ÉCHANTILLON pour ces candidats de test, pas une copie qui ferait autorité.
 */
const TEST_STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "she",
  "he",
  "they",
  "who",
  "is",
  "with",
  "from",
  "for",
  "her",
  "him",
  "own",
  "in",
  "at",
  "of",
  "and",
  "to",
]);
const TEST_GUARDRAILS: UspGuardrails = {
  stopwords: TEST_STOPWORDS,
  similarityThreshold: 0.55,
};
const fetchGuardrails = async () => TEST_GUARDRAILS;

describe("generateUspOptions — ordre des portes", () => {
  it("un candidat banni est refusé à la gate 1 et n'atteint jamais la RPC de collision", async () => {
    const rpc = vi.fn<
      (
        fn: string,
        args: { p_statement: string },
      ) => Promise<{ data: unknown; error: null }>
    >(async () => ({
      data: {
        distinct: true,
        best_similarity: 0.1,
        conflicting_statement: null,
      },
      error: null,
    }));
    const admin = { rpc } as unknown as SupabaseClient<Database>;

    const raw = [
      candidate(
        "u1",
        "population",
        "First responders carrying trauma from the job find her here.",
      ),
      candidate(
        "u2",
        "method",
        "EMDR sits at the center of how she works with trauma.",
      ),
      candidate(
        "u3",
        "lived_experience",
        "She trained in EMDR after her own work with trauma.",
      ),
    ];

    const modelCall = vi.fn(async () => raw);
    const bannedPhrasesCheck = vi.fn(async (text: string) =>
      text === raw[0].statement ? ["a banned phrase"] : [],
    );

    await generateUspOptions(
      bundle(),
      catalog,
      admin,
      "trauma:or",
      modelCall,
      bannedPhrasesCheck,
      fetchGuardrails,
    );

    // u1 était banni : son texte n'a jamais dû être passé au RPC de collision.
    const collisionStatements = rpc.mock.calls.map(
      (call) => call[1]?.p_statement,
    );
    expect(collisionStatements).not.toContain(raw[0].statement);
  });

  it("ne laisse jamais conflicting_statement fuiter dans les motifs de refus (§9.10)", async () => {
    const rpc = vi.fn(async () => ({
      data: {
        distinct: false,
        best_similarity: 0.95,
        conflicting_statement:
          "Another practice's real, confirmed positioning text.",
      },
      error: null,
    }));
    const admin = { rpc } as unknown as SupabaseClient<Database>;

    const modelCall = vi.fn(async () => [
      candidate(
        "u1",
        "population",
        "Built for first responders who carry the job home with them.",
      ),
      candidate(
        "u2",
        "method",
        "EMDR anchors every session, steady and unhurried.",
      ),
      candidate(
        "u3",
        "lived_experience",
        "A reflective, grounded practice shaped by years in the field.",
      ),
    ]);
    const bannedPhrasesCheck = vi.fn(async () => []);

    const result = await generateUspOptions(
      bundle(),
      catalog,
      admin,
      "trauma:or",
      modelCall,
      bannedPhrasesCheck,
      fetchGuardrails,
    );

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("Another practice's real");
  });
});

describe("generateUspOptions — reprise", () => {
  it("transmet les formulations refusées à la reprise, et n'appelle jamais un troisième coup", async () => {
    let calls = 0;
    const seenAvoid: { statement: string; reason: string }[][] = [];
    const modelCall = vi.fn(
      async (
        _prompt: string,
        avoid: { statement: string; reason: string }[],
      ) => {
        calls += 1;
        seenAvoid.push(avoid);
        // Chaque appel ne produit qu'UN candidat exploitable (angle population) :
        // il faut donc une reprise pour tenter d'en avoir trois, mais jamais un
        // troisième appel.
        return [
          candidate(
            `u-${calls}`,
            "population",
            "First responders carrying trauma from the job find her here.",
          ),
        ];
      },
    );
    const bannedPhrasesCheck = vi.fn(async () => []);
    const admin = fakeAdmin(true);

    const result = await generateUspOptions(
      bundle(),
      catalog,
      admin,
      "trauma:or",
      modelCall,
      bannedPhrasesCheck,
      fetchGuardrails,
    );

    expect(calls).toBe(2);
    expect(seenAvoid[0]).toEqual([]);
    // La deuxième tentative ne peut rien ajouter (même angle déjà rempli) :
    // le lot reste incomplet, `partial: true`, jamais complété par un
    // candidat qui a échoué une porte.
    expect(result.partial).toBe(true);
    expect(result.options).toHaveLength(1);
    expect(result.modelCalls).toBe(2);
  });

  it("ne reprend pas quand les trois angles survivent du premier coup", async () => {
    // Trois formulations lexicalement distinctes l'une de l'autre, chacune
    // n'ancrant qu'UN token du brief différent : la gate 3 ne doit en
    // écarter aucune pour ressemblance mutuelle.
    const modelCall = vi.fn(async () => [
      candidate(
        "u1",
        "population",
        "Built for first responders who carry the job home with them.",
      ),
      candidate(
        "u2",
        "method",
        "EMDR anchors every session, steady and unhurried.",
      ),
      candidate(
        "u3",
        "lived_experience",
        "A reflective, grounded practice shaped by years in the field.",
      ),
    ]);
    const bannedPhrasesCheck = vi.fn(async () => []);
    const admin = fakeAdmin(true);

    const result = await generateUspOptions(
      bundle(),
      catalog,
      admin,
      "trauma:or",
      modelCall,
      bannedPhrasesCheck,
      fetchGuardrails,
    );

    expect(modelCall).toHaveBeenCalledTimes(1);
    expect(result.partial).toBe(false);
    expect(result.options).toHaveLength(3);
  });

  it("s'arrête à deux survivants plutôt que de compléter avec un candidat refusé", async () => {
    // Deux angles atteignent la gate 4 ; le troisième collide à chaque
    // tentative — jamais de "padding" avec un candidat qui a échoué une
    // porte (§2.5).
    const modelCall = vi.fn(async () => [
      candidate(
        "u1",
        "population",
        "Built for first responders who carry the job home with them.",
      ),
      candidate(
        "u2",
        "method",
        "EMDR anchors every session, steady and unhurried.",
      ),
      candidate(
        "u3",
        "lived_experience",
        "A reflective, grounded practice shaped by years in the field.",
      ),
    ]);
    const bannedPhrasesCheck = vi.fn(async () => []);
    const rpc = vi.fn(async (_fn: string, args: { p_statement: string }) => ({
      data: {
        distinct: args.p_statement.includes("reflective") ? false : true,
        best_similarity: args.p_statement.includes("reflective") ? 0.95 : 0.1,
        conflicting_statement: null,
      },
      error: null,
    }));
    const admin = { rpc } as unknown as SupabaseClient<Database>;

    const result = await generateUspOptions(
      bundle(),
      catalog,
      admin,
      "trauma:or",
      modelCall,
      bannedPhrasesCheck,
      fetchGuardrails,
    );

    expect(modelCall).toHaveBeenCalledTimes(2); // la reprise tente, mais le
    // 3e angle collide encore.
    expect(result.partial).toBe(true);
    expect(result.options).toHaveLength(2);
    expect(result.options.some((o) => o.angle === "lived_experience")).toBe(
      false,
    );
  });
});

describe("partialMessageFor", () => {
  it("nomme le compte exact pour deux survivants (§2.5, texte au mot près)", () => {
    expect(partialMessageFor(2)).toBe(
      'We only found two that were truly yours. Try adding a line to "How you work" for a third.',
    );
  });

  it("reste générique pour un ou zéro survivant", () => {
    expect(partialMessageFor(1)).not.toMatch(/two/);
    expect(partialMessageFor(0)).not.toMatch(/two/);
  });
});
