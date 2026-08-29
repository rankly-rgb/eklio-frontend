import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { selectDirection } from "@/lib/data/brand-kit";
import { SAMPLE_DIRECTIONS, SAMPLE_PRACTICE_NAME } from "@/lib/brand/sample";

/*
 * Le choix d'une direction — et le refus de la base quand le kit n'est pas payé.
 *
 * ── Ce que ce test tient ─────────────────────────────────────────────────
 *
 * `paid` était un `if` dans un composant client AU-DESSUS d'une route ouverte :
 * un `fetch` passait à côté, et le kit, le PDF et l'éditeur de site s'ouvraient
 * derrière. La barrière est désormais en base ; ce code ne la reproduit pas, il
 * RECONNAÎT son refus. Et il doit le reconnaître sous ses deux formes, parce
 * qu'un 500 selon la façon dont la policy est écrite serait une régression
 * silencieuse.
 */

const KIT = "kit-1";
const USER = "user-1";

/** Un client Supabase minimal : une lecture de kit, puis un `update`. */
function client(update: { data: unknown; error: unknown }): {
  supabase: SupabaseClient<Database>;
  rpc: ReturnType<typeof vi.fn>;
} {
  const rpc = vi.fn().mockResolvedValue({ error: null });

  const kitRow = {
    id: KIT,
    project_id: "project-1",
    directions: SAMPLE_DIRECTIONS,
    selected_direction_id: null,
    content: {},
    social_templates: null,
    voice_guide: null,
    ethics_check: null,
    projects: { user_id: USER, name: SAMPLE_PRACTICE_NAME },
  };

  const from = (table: string) => {
    if (table === "project_briefs") {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: { practice_name: SAMPLE_PRACTICE_NAME } }) }),
        }),
      };
    }
    return {
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: kitRow, error: null }) }),
        }),
      }),
      update: () => ({
        eq: () => ({ select: () => ({ single: async () => update }) }),
      }),
    };
  };

  return { supabase: { from, rpc } as unknown as SupabaseClient<Database>, rpc };
}

describe("le refus de paiement, sous ses deux formes", () => {
  it("une EXCEPTION nommée par un trigger", async () => {
    const { supabase } = client({
      data: null,
      error: { code: "P0001", message: "payment_required" },
    });

    const outcome = await selectDirection(
      supabase,
      KIT,
      USER,
      SAMPLE_DIRECTIONS[0].id
    );

    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.reason).toBe("payment-required");
  });

  it("porte le message mesuré du backend", async () => {
    const { supabase } = client({
      data: null,
      error: {
        code: "42501",
        message:
          "payment_required: choosing a direction is part of the paid kit.",
      },
    });

    const outcome = await selectDirection(
      supabase,
      KIT,
      USER,
      SAMPLE_DIRECTIONS[0].id
    );

    expect(!outcome.ok && outcome.reason).toBe("payment-required");
  });

  it("reconnaît aussi le nom de la garde en base", async () => {
    const { supabase } = client({
      data: null,
      error: { code: "42501", message: 'new row violates "brand_kit_entitled"' },
    });

    const outcome = await selectDirection(
      supabase,
      KIT,
      USER,
      SAMPLE_DIRECTIONS[0].id
    );

    expect(!outcome.ok && outcome.reason).toBe("payment-required");
  });
});

describe("⚠ zéro ligne n'est PAS un refus de paiement", () => {
  it("aucune exception, zéro ligne → 404, pas un checkout", async () => {
    /*
     * La RLS filtre la ligne AVANT que le trigger ne s'exécute : c'est un
     * NON-PROPRIÉTAIRE. Lui proposer un paiement, c'était le mauvais écran —
     * et surtout une confirmation que ce kit existe.
     */
    const { supabase } = client({ data: null, error: null });

    const outcome = await selectDirection(
      supabase,
      KIT,
      USER,
      SAMPLE_DIRECTIONS[0].id
    );

    expect(!outcome.ok && outcome.reason).toBe("not-found");
    expect(!outcome.ok && outcome.reason).not.toBe("payment-required");
  });

  it("le SQLSTATE seul ne suffit pas à conclure au paiement", async () => {
    // 42501 est `insufficient_privilege`, que la RLS emploie aussi. C'est le
    // MESSAGE qui nomme la cause.
    const { supabase } = client({
      data: null,
      error: { code: "42501", message: "permission denied for table brand_kits" },
    });

    const outcome = await selectDirection(
      supabase,
      KIT,
      USER,
      SAMPLE_DIRECTIONS[0].id
    );

    expect(!outcome.ok && outcome.reason).toBe("write-failed");
  });
});

describe("ce qui n'est PAS un refus de paiement", () => {
  it("une vraie panne d'écriture reste une panne", async () => {
    const { supabase } = client({
      data: null,
      error: { code: "57014", message: "statement timeout" },
    });

    const outcome = await selectDirection(
      supabase,
      KIT,
      USER,
      SAMPLE_DIRECTIONS[0].id
    );

    expect(!outcome.ok && outcome.reason).toBe("write-failed");
  });

  it("un id de direction inventé se voit avant l'écriture", async () => {
    const { supabase } = client({ data: { id: KIT }, error: null });

    const outcome = await selectDirection(supabase, KIT, USER, "not-a-direction");

    expect(!outcome.ok && outcome.reason).toBe("unknown-direction");
  });
});

describe("le chemin nominal", () => {
  it("écrit et coche la checklist", async () => {
    const { supabase, rpc } = client({
      data: {
        id: KIT,
        project_id: "project-1",
        directions: SAMPLE_DIRECTIONS,
        selected_direction_id: SAMPLE_DIRECTIONS[0].id,
        content: {},
        social_templates: null,
        voice_guide: null,
        ethics_check: null,
      },
      error: null,
    });

    const outcome = await selectDirection(
      supabase,
      KIT,
      USER,
      SAMPLE_DIRECTIONS[0].id
    );

    expect(outcome.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("complete_choose_direction", {
      p_brand_kit_id: KIT,
    });
  });
});
