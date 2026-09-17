import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { BrandKit } from "@/lib/data/brand-kit";
import { loadImageContext } from "@/lib/images/context";
import { computeImageFingerprint } from "@/lib/images/fingerprint";
import { getBrandImages } from "@/lib/images/rpc";
import type { AssetManifestEntry } from "@/lib/kit/asset-rpc";
import { SITE_IMAGE_SLOTS } from "@/lib/site/imagery";

/*
 * What the Lovable prompt needs that the launch flow does not already carry:
 * her tone words, her wordmark, which photographs exist — and the brief answers
 * the site spec was never taught to read.
 *
 * Read ONLY for `site_setup`. Every other step screen would be paying for a
 * fingerprint computation, an image read and a catalogue join it never renders.
 */

type Client = SupabaseClient<Database>;

/** The wordmark keys the catalogue offers, best first. */
const WORDMARK_KEYS = ["wordmark_svg_dark", "wordmark_png_dark", "wordmark_svg_light"];

export type SiteSetupMaterial = {
  toneWords: string[];
  /**
   * ⚠ CARRIES ITS CATALOGUE KEY. The prompt names this file and tells her to
   * use it as the logo; without the key the step screen had no way to OFFER
   * it, so the instruction pointed at a download that was not on the page.
   */
  wordmark: { key: string; label: string; format: string } | null;
  /**
   * Slot keys with a current, stored photograph, restricted to the four a
   * WEBSITE uses. The three `post_bg_*` slots are social-post backgrounds and
   * were being listed here — see `lib/site/imagery.ts`.
   */
  imageSlots: string[];
  /**
   * ── HER BRIEF ANSWERS THE SITE SPEC NEVER RECEIVED ─────────────────────
   *
   * `project_briefs` holds what she chose in step 4; `site_specs` is seeded by
   * SQL that does not read those columns. So "How I work", "Services" and
   * "Training and licensure" arrive as headings over nothing, while the answers
   * that belong under them sit one table away.
   *
   * ⚠ CATALOGUE LABELS ONLY, like `lib/launch/directory.ts`. An id whose row is
   * retired yields nothing rather than a raw id, and no sentence is composed.
   */
  brief: BriefLabels;
};

export type BriefLabels = {
  /** "I ask a lot of questions", "We work from a plan you can see". */
  sessionStyles: string[];
  /** Full names — "EMDR — Eye Movement Desensitization and Reprocessing". */
  modalities: ModalityLabel[];
  /** "Self-esteem". */
  specialties: string[];
  /**
   * Present and non-blank, or null. ⚠ NEVER ITS TEXT: the quote is a
   * GENERATION INPUT, third person, with no attribution field and no consent
   * flag. See FINDINGS.md finding C. Carried as a boolean so the prompt can
   * state why there is no testimonials section, and nothing more.
   */
  referralQuotePresent: boolean;
};

export type ModalityLabel = {
  /** The brief card's short label — "CBT". Used for a page title and a slug. */
  label: string;
  /** The catalogue's full name, for the page's own heading. */
  fullName: string;
};

export async function loadSiteSetupMaterial(
  supabase: Client,
  kit: BrandKit,
  manifest: AssetManifestEntry[]
): Promise<SiteSetupMaterial> {
  const wordmarkEntry =
    WORDMARK_KEYS.map((key) => manifest.find((entry) => entry.key === key && entry.current)).find(
      (entry): entry is AssetManifestEntry => Boolean(entry)
    ) ?? null;

  /*
   * The same read the home canvas uses for its photograph — context,
   * fingerprint, rows — kept to the slot names here because the prompt names
   * slots and does not display them.
   */
  let imageSlots: string[] = [];
  const context = await loadImageContext(supabase, kit);
  if (context.ok) {
    const rows = await getBrandImages(supabase, kit.row.id, computeImageFingerprint(context.input));
    const site = new Set<string>(SITE_IMAGE_SLOTS);
    imageSlots = rows
      .filter((row) => row.current && row.storage_path && site.has(row.slot))
      .map((row) => row.slot)
      .sort();
  }

  return {
    toneWords: kit.selectedDirection?.tone_keywords ?? [],
    wordmark: wordmarkEntry
      ? { key: wordmarkEntry.key, label: wordmarkEntry.label, format: wordmarkEntry.kind }
      : null,
    imageSlots,
    brief: await loadBriefLabels(supabase, kit.projectId),
  };
}

/** The join: her chosen ids → the catalogue's own display labels. */
export async function loadBriefLabels(
  supabase: Client,
  projectId: string
): Promise<BriefLabels> {
  const empty: BriefLabels = {
    sessionStyles: [],
    modalities: [],
    specialties: [],
    referralQuotePresent: false,
  };

  const { data: brief } = await supabase
    .from("project_briefs")
    .select("session_style_ids, modality_ids, specialty_ids, referral_quote")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!brief) return empty;

  const styleIds = brief.session_style_ids ?? [];
  const modalityIds = brief.modality_ids ?? [];
  const specialtyIds = brief.specialty_ids ?? [];

  const [styles, modalities, specialties] = await Promise.all([
    styleIds.length
      ? supabase.from("session_style_cards").select("label").in("id", styleIds).order("sort_order")
      : Promise.resolve({ data: [] as { label: string }[] }),
    modalityIds.length
      ? supabase
          .from("modality_cards")
          .select("label, full_name")
          .in("id", modalityIds)
          .order("sort_order")
      : Promise.resolve({ data: [] as { label: string; full_name: string }[] }),
    specialtyIds.length
      ? supabase.from("specialties").select("label").in("id", specialtyIds).order("sort_order")
      : Promise.resolve({ data: [] as { label: string }[] }),
  ]);

  const clean = (values: (string | null | undefined)[]) =>
    values.map((value) => value?.trim()).filter((value): value is string => Boolean(value));

  return {
    sessionStyles: clean((styles.data ?? []).map((row) => row.label)),
    modalities: (modalities.data ?? [])
      .map((row) => ({
        label: (row.label ?? "").trim(),
        fullName: (row.full_name ?? "").trim() || (row.label ?? "").trim(),
      }))
      .filter((entry) => entry.label),
    specialties: clean((specialties.data ?? []).map((row) => row.label)),
    referralQuotePresent: Boolean(brief.referral_quote?.trim()),
  };
}
