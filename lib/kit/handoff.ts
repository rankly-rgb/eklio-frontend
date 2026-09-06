import type { Direction, VoiceGuide } from "@/lib/brand/shapes";

/*
 * ── LOT 10 — THE HANDOFF ────────────────────────────────────────────────
 *
 * What she gives to whoever builds the thing: a web designer, a VA, the
 * person at the group practice who runs the website. One page she can read
 * and one block of text she can paste into an email, plus the files she
 * already owns.
 *
 * ⚠ THE CONSTRAINT THAT SHAPES ALL OF IT: Eklio never hosts, publishes,
 * deploys or shares. There is no share URL here, no "copy link", no invite,
 * no per-recipient page. A handoff is something she DOWNLOADS and forwards
 * herself, which also means the recipient needs nothing from us and no
 * account. A test asserts the absence, because "we did not build sharing" is
 * a decision that would otherwise erode one convenience at a time.
 *
 * Everything below is DERIVED from what the kit already holds. No model call,
 * no generation, no credit: the brief is a rendering of stored fields, and
 * running it twice on the same kit produces the same bytes.
 */

export type HandoffAssets = {
  /** Files rendered and current under the kit's fingerprint. Measured, never estimated. */
  currentCount: number;
  /** ISO timestamp of the most recent current asset, or null when none exist yet. */
  lastUpdated: string | null;
  /** Keys rendered before that no longer match the kit — named so she can say so. */
  staleKeys: string[];
};

export type HandoffRule = { label: string; description: string };

export type HandoffModel = {
  practiceName: string;
  practitionerLine: string | null;
  direction: Direction | null;
  voice: VoiceGuide | null;
  rules: HandoffRule[];
  assets: HandoffAssets;
  bookingUrl: string | null;
};

const PALETTE_ROWS: Array<[keyof Direction["palette"], string]> = [
  ["primary", "Primary"],
  ["secondary", "Secondary"],
  ["light", "Light"],
  ["dark", "Dark"],
  ["paper", "Paper"],
];

function pad(label: string, width = 11): string {
  return label.length >= width ? `${label} ` : label.padEnd(width, " ");
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(iso)
  );
}

/**
 * The handoff brief, as plain text she can paste into an email.
 *
 * Plain text on purpose: it survives every mail client, it needs no
 * attachment to be readable, and the person receiving it can copy a hex out
 * of it without opening anything. Deterministic for a given kit and date, so
 * two people reading it are reading the same document.
 */
export function handoffBrief(model: HandoffModel, now: Date): string {
  const lines: string[] = [];

  lines.push(`BRAND HANDOFF — ${model.practiceName}`);
  lines.push(`Prepared ${formatDate(now.toISOString())} with Eklio.`);
  if (model.practitionerLine) lines.push(model.practitionerLine);
  lines.push("");

  lines.push("WHAT THIS IS");
  lines.push(
    "Everything you need to build or update something for this practice: the colors, the"
  );
  lines.push(
    "type, how the writing should sound, and what must never appear. The files are attached"
  );
  lines.push("or sent separately; nothing here needs an account or a login.");
  lines.push("");

  if (model.direction) {
    lines.push("COLOR");
    for (const [role, label] of PALETTE_ROWS) {
      lines.push(`${pad(label)}${model.direction.palette[role].toUpperCase()}`);
    }
    lines.push("");

    lines.push("TYPE");
    lines.push(`${pad("Headings")}${model.direction.typography.heading_font}`);
    lines.push(`${pad("Body")}${model.direction.typography.body_font}`);
    lines.push(`${pad("Web fonts")}${model.direction.typography.google_fonts_url}`);
    lines.push("");

    lines.push("TONE");
    lines.push(model.direction.tone_keywords.join(", "));
    lines.push("");
  }

  if (model.voice) {
    lines.push("VOICE");
    lines.push("It sounds like:");
    for (const entry of model.voice.sounds_like) lines.push(`  - ${entry}`);
    lines.push("Never write:");
    for (const entry of model.voice.never_write) lines.push(`  - ${entry}`);
    lines.push("");
  }

  if (model.rules.length > 0) {
    /*
     * The real ethics rules, not a paraphrase. This is the part a designer is
     * most likely to break without knowing it — a testimonial, a guarantee, a
     * before-and-after — and it is the part with a licensing board behind it.
     */
    lines.push("WHAT MUST NEVER APPEAR");
    lines.push("These are advertising rules for licensed therapists in the United States.");
    for (const rule of model.rules) lines.push(`  - ${rule.label}: ${rule.description}`);
    lines.push("");
  }

  if (model.bookingUrl) {
    lines.push("BOOKING LINK");
    lines.push(model.bookingUrl);
    lines.push("");
  }

  lines.push("FILES");
  if (model.assets.currentCount > 0) {
    lines.push(
      `${model.assets.currentCount} files are current${
        model.assets.lastUpdated ? ` as of ${formatDate(model.assets.lastUpdated)}` : ""
      }.`
    );
  } else {
    lines.push("No files have been generated yet.");
  }
  if (model.assets.staleKeys.length > 0) {
    lines.push(
      `${model.assets.staleKeys.length} were made before the brand last changed and are being rebuilt.`
    );
  }
  lines.push("");

  lines.push("ONE THING TO KNOW");
  lines.push(
    "Eklio does not host, publish or deploy anything. This brand lives wherever this"
  );
  lines.push(
    "practice decides to put it, and these files are hers to use without asking anyone."
  );

  return lines.join("\n");
}
