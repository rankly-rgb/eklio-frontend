"use client";

import type { BriefPreview } from "@/lib/eklio/brief";
import { MAX_PREVIEW_SPECIALTIES } from "@/lib/eklio/brief";

/**
 * Le panneau de droite des maquettes : un site complet, rendu depuis
 * `brief_preview()`.
 *
 * Les valeurs par défaut ne sont pas de la gestion d'erreur, c'est l'état du
 * PREMIER rendu — l'écran 1 affiche déjà un site avant le moindre choix. Elles
 * viennent de la base (CLAY & SAND, Fraunces / Nunito Sans, « A calmer place
 * to start. »), on ne les réécrit pas ici.
 */
export function PreviewPanel({ preview }: { preview: BriefPreview | null }) {
  if (!preview) return <div className="h-full" />;

  const t = preview.tokens;
  const chips = preview.specialties.slice(0, MAX_PREVIEW_SPECIALTIES);

  return (
    <div className="sticky top-8">
      <link href={t.google_fonts_url} rel="stylesheet" />

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-[0_24px_60px_rgba(38,33,28,0.05)]">
        <div className="flex h-[34px] items-center gap-3 border-b border-line bg-surface px-3">
          <div className="flex gap-1.5">
            <span className="size-2 rounded-full bg-line" />
            <span className="size-2 rounded-full bg-line" />
            <span className="size-2 rounded-full bg-line" />
          </div>
          <div className="flex h-[18px] flex-1 items-center truncate rounded-full border border-line bg-paper px-2.5 font-mono text-[10px] tracking-[0.06em] text-faint">
            {slugify(preview.practice_name)}.com
          </div>
        </div>

        <div style={{ background: t.paper, fontFamily: `${t.body_font}, system-ui, sans-serif` }}>
          <div className="flex items-center gap-2.5 px-4 py-4">
            <span
              className="size-5 rounded-full"
              style={{ background: t.primary }}
              aria-hidden
            />
            <span
              className="truncate text-[13px] font-semibold"
              style={{ color: t.dark, fontFamily: `${t.heading_font}, Georgia, serif` }}
            >
              {preview.practice_name ?? "Your practice"}
            </span>
          </div>

          <div className="px-4 pb-6">
            {preview.hero.overline ? (
              <div
                className="font-mono text-[10px] uppercase tracking-[0.16em]"
                style={{ color: t.secondary }}
              >
                {preview.hero.overline}
              </div>
            ) : null}

            <h2
              className="mt-2 text-[26px] leading-[1.14] tracking-[-0.015em]"
              style={{ color: t.dark, fontFamily: `${t.heading_font}, Georgia, serif` }}
            >
              {preview.hero.headline}
            </h2>

            <p className="mt-2.5 text-[13px] leading-[1.6]" style={{ color: t.dark, opacity: 0.72 }}>
              {preview.hero.subhead}
            </p>

            <div
              className="mt-5 inline-flex h-9 items-center rounded-full px-5 text-[13px] font-semibold"
              style={{ background: t.primary, color: t.paper }}
            >
              {preview.hero.cta_label}
            </div>

            {chips.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full px-3 py-1 text-[11px]"
                    style={{ background: t.light, color: t.dark }}
                  >
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="px-4 pb-6" style={{ background: t.light }}>
            <p className="pt-5 text-[12px] leading-[1.65]" style={{ color: t.dark, opacity: 0.8 }}>
              {preview.about_excerpt}
            </p>
          </div>
        </div>
      </div>

      <p className="overline mt-4 text-faint">Live preview</p>
    </div>
  );
}

function slugify(name: string | null): string {
  if (!name) return "yourpractice";
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
  return slug || "yourpractice";
}
