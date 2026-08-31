"use client";

import { useState, useTransition } from "react";

import { loadOutput, markCopied } from "@/lib/actions/kit";
import type { Direction } from "@/components/directions/direction-card";

export type BuilderTarget = { id: string; label: string; accepts_prompt: boolean | null };

const ROLE_ORDER = ["primary", "secondary", "light", "dark", "paper", "accent"] as const;
const ROLE_LABEL: Record<string, string> = {
  primary: "Primary",
  secondary: "Secondary",
  light: "Light neutral",
  dark: "Dark neutral",
  paper: "Paper",
  accent: "Accent",
};

export function KitView({
  brandKitId,
  direction,
  voiceGuide,
  practitionerLine,
  targets,
  initialTarget,
  initialText,
}: {
  brandKitId: string;
  direction: Direction;
  voiceGuide: { sounds_like: string[]; never_write: string[] } | null;
  practitionerLine: string | null;
  targets: BuilderTarget[];
  initialTarget: string;
  initialText: string;
}) {
  const [target, setTarget] = useState(initialTarget);
  const [text, setText] = useState(initialText);
  const [copied, setCopied] = useState(false);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const switchTarget = (next: string) => {
    setError(null);
    setTarget(next);
    setCopied(false);
    startTransition(async () => {
      const result = await loadOutput(brandKitId, next);
      if (result.ok) setText(result.text);
      else setError(result.message);
    });
  };

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    void markCopied(brandKitId);
  };

  const p = direction.palette;
  const t = direction.typography;

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-14">
      <link href={t.google_fonts_url} rel="stylesheet" />

      <div className="overline text-muted">Your brand kit</div>
      <h1 className="mt-4 font-display text-[40px] leading-[1.12] tracking-[-0.015em]">
        {direction.name}
      </h1>
      <p className="mt-3 max-w-[560px] text-[15px] leading-[1.6] text-muted">
        {direction.rationale}
      </p>

      <section className="mt-12">
        <div className="overline text-muted">Colour</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {ROLE_ORDER.filter((role) => p[role]).map((role) => (
            <div key={role} className="flex flex-col gap-2">
              <div
                className="h-20 rounded-[10px] border border-line"
                style={{ background: p[role] }}
              />
              <div className="text-[13px] font-semibold">{ROLE_LABEL[role]}</div>
              <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
                {p[role]}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-10 md:grid-cols-2">
        <div>
          <div className="overline text-muted">Type</div>
          <div
            className="mt-4 text-[32px] leading-tight"
            style={{ fontFamily: `${t.heading_font}, Georgia, serif` }}
          >
            {t.heading_font}
          </div>
          <div
            className="mt-2 text-[15px] leading-relaxed text-muted"
            style={{ fontFamily: `${t.body_font}, system-ui, sans-serif` }}
          >
            {t.body_font} — the body face, set here in the size it will be read at.
          </div>
        </div>

        {voiceGuide ? (
          <div>
            <div className="overline text-muted">Voice</div>
            <ul className="mt-4 flex flex-col gap-2 text-[14px] leading-snug">
              {voiceGuide.sounds_like.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="text-accent">+</span>
                  {line}
                </li>
              ))}
              {voiceGuide.never_write.map((line) => (
                <li key={line} className="flex gap-2 text-muted">
                  <span>–</span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {practitionerLine ? (
        <p className="mt-12 border-l-2 border-accent pl-4 font-display text-[19px]">
          {practitionerLine}
        </p>
      ) : null}

      <section className="mt-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="overline text-muted">Your site, as a prompt</div>
            <p className="mt-3 max-w-[520px] text-[15px] leading-[1.6] text-muted">
              Paste this into your builder. It carries your colours, your type, your words and the
              rules that keep them intact.
            </p>
          </div>
          <button
            type="button"
            onClick={copy}
            disabled={busy}
            className="flex h-10 items-center rounded-full bg-ink px-[30px] text-sm font-semibold text-paper transition hover:opacity-90 disabled:opacity-40"
          >
            {copied ? "Copied" : "Copy the prompt"}
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {targets.map((builder) => (
            <button
              key={builder.id}
              type="button"
              onClick={() => switchTarget(builder.id)}
              disabled={busy}
              className={`rounded-full border px-4 py-2 text-sm transition disabled:opacity-50 ${
                target === builder.id
                  ? "border-accent bg-accent/10 text-ink"
                  : "border-line bg-white text-muted hover:border-faint"
              }`}
            >
              {builder.label}
            </button>
          ))}
        </div>

        {error ? <p className="mt-4 text-sm text-accent">{error}</p> : null}

        <pre className="mt-6 max-h-[560px] overflow-auto rounded-[14px] border border-line bg-white p-6 font-mono text-[12px] leading-relaxed whitespace-pre-wrap">
          {busy ? "…" : text}
        </pre>
      </section>
    </div>
  );
}
