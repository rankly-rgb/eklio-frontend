import { createElement } from "react";
import satori from "satori";
import { getCachedFontBuffer } from "@/lib/kit/render/font-cache";
import { svgToPng } from "@/lib/kit/render/rasterize";

/*
 * email_signature_html / email_signature_png (Lot 4.4, "Document").
 *
 * Content source: `practice_details` (lib/site/types.ts) when the backend
 * exposes it — practitioner_name, license_label, license_number, city,
 * state, email, phone are all optional-by-presence there (see that type's
 * own comment: a control is offered only once the key is actually present,
 * never assumed). Falls back to `practitioner_line` (name + credential,
 * already composed) and the practice name alone when the richer fields
 * aren't there — never fabricated, only what the kit actually has.
 * `bookingUrl` comes from the site spec's own hero CTA target
 * (`spec.hero.cta_target_url`) — the same link the site's own "Book a
 * consult" button already points to, not a new field.
 */

export type EmailSignatureInput = {
  practiceName: string;
  /** Precomposed "Name, CREDENTIAL" — used whenever the richer PracticeDetails fields aren't present. */
  practitionerLine: string | null;
  practitionerName: string | null;
  licenseLabel: string | null;
  licenseNumber: string | null;
  city: string | null;
  state: string | null;
  bookingUrl: string | null;
  primaryColor: string;
  darkColor: string;
};

function nameAndCredentialLine(input: EmailSignatureInput): string | null {
  if (input.practitionerName) {
    const credential = [input.licenseLabel, input.licenseNumber].filter(Boolean).join(" ");
    return credential ? `${input.practitionerName}, ${credential}` : input.practitionerName;
  }
  return input.practitionerLine;
}

function cityState(input: EmailSignatureInput): string | null {
  if (input.city && input.state) return `${input.city}, ${input.state}`;
  return input.city ?? input.state ?? null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/*
 * Table-based, every style inline — the two things that actually survive
 * Gmail's and Outlook's stripped-down HTML rendering. No flexbox/grid (both
 * silently collapse in Outlook's Word-based renderer), no external
 * stylesheet or `<style>` block (Gmail strips `<head>`), no webfont `@import`
 * (neither client reliably loads one) — the heading font name is offered
 * ONLY alongside a real web-safe fallback stack, so a client that can't load
 * it still renders serif text, never a tofu/system-default surprise.
 */
export function renderEmailSignatureHtml(input: EmailSignatureInput): Buffer {
  const nameLine = nameAndCredentialLine(input);
  const location = cityState(input);
  const rows: string[] = [];

  rows.push(
    `<tr><td style="font-family:Georgia,'Times New Roman',serif;font-size:16px;font-weight:bold;color:${input.darkColor};padding-bottom:2px;">${escapeHtml(input.practiceName)}</td></tr>`
  );
  if (nameLine) {
    rows.push(
      `<tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${input.darkColor};padding-bottom:2px;">${escapeHtml(nameLine)}</td></tr>`
    );
  }
  if (location) {
    rows.push(
      `<tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${input.darkColor};opacity:0.75;padding-bottom:8px;">${escapeHtml(location)}</td></tr>`
    );
  }
  rows.push(
    `<tr><td style="padding:8px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:2px solid ${input.primaryColor};font-size:1px;line-height:1px;width:120px;">&nbsp;</td></tr></table></td></tr>`
  );
  if (input.bookingUrl) {
    rows.push(
      `<tr><td style="padding-top:6px;"><a href="${escapeHtml(input.bookingUrl)}" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${input.primaryColor};text-decoration:none;">Book a consult</a></td></tr>`
    );
  }

  const html =
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">` +
    rows.join("") +
    `</table>`;

  return Buffer.from(html, "utf8");
}

export const SIGNATURE_WIDTH = 640;
export const SIGNATURE_HEIGHT = 220;

export async function renderEmailSignaturePng(
  input: EmailSignatureInput & { headingFont: string; bodyFont: string; googleFontsUrl: string }
): Promise<Buffer> {
  const nameLine = nameAndCredentialLine(input);
  const location = cityState(input);
  const [headingFontData, bodyFontData] = await Promise.all([
    getCachedFontBuffer(input.headingFont, input.googleFontsUrl),
    getCachedFontBuffer(input.bodyFont, input.googleFontsUrl),
  ]);

  const children: ReturnType<typeof createElement>[] = [
    createElement(
      "div",
      {
        key: "practice",
        style: {
          display: "flex",
          fontFamily: input.headingFont,
          fontWeight: 600,
          fontSize: 26,
          color: input.darkColor,
        },
      },
      input.practiceName
    ),
  ];
  if (nameLine) {
    children.push(
      createElement(
        "div",
        {
          key: "name",
          style: { display: "flex", marginTop: 6, fontFamily: input.bodyFont, fontSize: 18, color: input.darkColor },
        },
        nameLine
      )
    );
  }
  if (location) {
    children.push(
      createElement(
        "div",
        {
          key: "location",
          style: {
            display: "flex",
            marginTop: 2,
            fontFamily: input.bodyFont,
            fontSize: 16,
            color: input.darkColor,
            opacity: 0.7,
          },
        },
        location
      )
    );
  }
  children.push(
    createElement("div", {
      key: "rule",
      style: { display: "flex", marginTop: 14, width: 120, height: 3, backgroundColor: input.primaryColor },
    })
  );
  if (input.bookingUrl) {
    children.push(
      createElement(
        "div",
        {
          key: "booking",
          style: { display: "flex", marginTop: 10, fontFamily: input.bodyFont, fontSize: 16, color: input.primaryColor },
        },
        "Book a consult"
      )
    );
  }

  const tree = createElement(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: 24,
        justifyContent: "center",
      },
    },
    ...children
  );

  const svg = await satori(tree, {
    width: SIGNATURE_WIDTH,
    height: SIGNATURE_HEIGHT,
    fonts: [
      { name: input.headingFont, data: headingFontData, weight: 600, style: "normal" },
      { name: input.bodyFont, data: bodyFontData, weight: 400, style: "normal" },
    ],
  });
  return svgToPng(svg);
}
