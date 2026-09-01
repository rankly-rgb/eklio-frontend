"use client";

import { useState } from "react";
import { MonoLabel } from "@/components/ui/mono-label";
import { InlineError } from "@/components/ui/text-field";
import { RailSection } from "@/components/site/rail-section";
import {
  COLOR_ROLES,
  colorPatch,
  isHex,
  swapRolesPatch,
  promoteToPrimaryPatch,
  type ColorRoleKey,
} from "@/lib/site/colors";
import type { SiteEditorState } from "@/components/site/use-site-editor";

/*
 * Les six rôles de couleur.
 *
 * ⚠ SIX CONTRÔLES, PAS CINQ. `paper` (« Page background ») et `light_neutral`
 * (« Section background ») sont proches en valeur et complètement différents
 * de métier : l'une est la page entière, l'autre une bande posée dessus. Les
 * fondre retirerait à la praticienne le réglage de son fond de page.
 *
 * ⚠ LES QUATRE VARIANTES DÉRIVÉES NE SONT PAS ICI, et ne doivent pas y être.
 * `primary_text`, `secondary_text`, `accent_text` et `cta_ink` sont calculées
 * par un trigger à chaque écriture. Elles n'ont pas de contrôle parce qu'elle
 * n'a rien à y décider : elles se voient dans la maquette, dans le rapport de
 * contraste et dans les instructions. Elles sont montrées ici en LECTURE, pour
 * que la ligne « Primary as text » des instructions ne sorte pas de nulle part.
 *
 * LE GLISSER-DÉPOSER a un équivalent clavier, obligatoirement : chaque
 * pastille porte un menu « Use as primary / Swap with … ». Un réglage
 * accessible seulement à la souris n'est pas un réglage.
 */
export function ColorSection({ editor }: { editor: SiteEditorState }) {
  const { spec, preview } = editor.envelope;
  const [dragging, setDragging] = useState<ColorRoleKey | null>(null);
  const [over, setOver] = useState<ColorRoleKey | null>(null);

  const fieldError =
    editor.error && COLOR_ROLES.some((role) => role.key === editor.error?.field)
      ? editor.error
      : null;

  function swap(from: ColorRoleKey, to: ColorRoleKey) {
    const patch = swapRolesPatch(spec, from, to);
    if (Object.keys(patch).length > 0) editor.commit(patch);
  }

  return (
    <RailSection
      id="site-colors"
      title="Colors"
      hint="Six roles. Drag a swatch onto another to swap them."
    >
      <div className="flex flex-col gap-2.5">
        {COLOR_ROLES.map((role) => {
          const value = spec[role.key];
          const isOver = over === role.key && dragging !== null && dragging !== role.key;

          return (
            <div
              key={role.key}
              draggable
              onDragStart={(event) => {
                setDragging(role.key);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", role.key);
              }}
              onDragEnd={() => {
                setDragging(null);
                setOver(null);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setOver(role.key);
              }}
              onDragLeave={() => setOver((current) => (current === role.key ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                const from = event.dataTransfer.getData("text/plain") as ColorRoleKey;
                setDragging(null);
                setOver(null);
                if (from && from !== role.key) swap(from, role.key);
              }}
              className={`flex items-start gap-3 rounded-card border p-3 transition-colors duration-[var(--dur-select)] ${
                isOver ? "border-accent bg-card" : "border-line"
              } ${dragging === role.key ? "opacity-50" : ""}`}
            >
              <Swatch
                role={role.key}
                label={role.label}
                value={value}
                onChange={(hex) => editor.commit(colorPatch(role.key, hex))}
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-ui font-medium text-ink">{role.label}</span>
                  <MonoLabel tracking="hex" tone="ink-2" uppercase={false}>
                    {value.toUpperCase()}
                  </MonoLabel>
                </div>
                <p className="mt-1 text-meta leading-body text-ink-2">{role.paints}</p>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  {role.key === "primary" ? null : (
                    <button
                      type="button"
                      onClick={() => editor.commit(promoteToPrimaryPatch(spec, role.key))}
                      className="text-meta text-ink-2 hover:text-ink hover:underline hover:decoration-[var(--accent)] hover:underline-offset-4"
                    >
                      Use as primary
                    </button>
                  )}

                  {/* L'équivalent clavier du glisser-déposer. */}
                  <label className="flex items-center gap-1.5 text-meta text-ink-2">
                    <span className="sr-only">{`Swap ${role.label} with another role`}</span>
                    <select
                      value=""
                      onChange={(event) => {
                        const target = event.target.value as ColorRoleKey;
                        if (target) swap(role.key, target);
                      }}
                      className="rounded-check border border-line bg-bg px-1.5 py-0.5 text-meta text-ink-2"
                    >
                      <option value="">Swap with…</option>
                      {COLOR_ROLES.filter((other) => other.key !== role.key).map(
                        (other) => (
                          <option key={other.key} value={other.key}>
                            {other.label}
                          </option>
                        )
                      )}
                    </select>
                  </label>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {fieldError ? <div className="mt-3"><InlineError>{fieldError.message}</InlineError></div> : null}

      {/* ── Les quatre variantes, en lecture seule ────────────────────── */}
      <div className="mt-5 rounded-card border border-line bg-bg p-4">
        <MonoLabel tracking="16" as="h3">
          Text versions
        </MonoLabel>
        <p className="mt-2 text-meta leading-body text-ink-2">
          Your three brand colors, darkened only as far as legibility on your
          page background requires. We work these out for you and keep them in
          step &mdash; they aren&rsquo;t settings. Use them wherever the color
          is text; keep the brighter originals for fills, bands and buttons.
        </p>
        <dl className="mt-3 flex flex-col gap-2">
          <Derived label="Primary as text" value={preview.tokens.primary_text} />
          <Derived label="Secondary as text" value={preview.tokens.secondary_text} />
          <Derived label="Accent as text" value={preview.tokens.accent_text} />
          <Derived label="Button label" value={preview.tokens.cta_ink} />
        </dl>
      </div>
    </RailSection>
  );
}

/**
 * La pastille. C'est un `<input type="color">` : le sélecteur natif est celui
 * que le système d'exploitation sait rendre accessible, et il accepte le
 * clavier. Le hex reste éditable à côté, pour celle qui a la valeur écrite
 * quelque part.
 */
function Swatch({
  role,
  label,
  value,
  onChange,
}: {
  role: ColorRoleKey;
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <div className="flex flex-none flex-col items-center gap-1.5">
      <input
        type="color"
        id={`color-${role}`}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="size-11 cursor-pointer rounded-preview border border-line bg-bg p-0.5"
      />
      <input
        type="text"
        aria-label={`${label} hex value`}
        value={draft ?? value.toUpperCase()}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => {
          const next = event.target.value.trim();
          setDraft(null);
          if (isHex(next) && next.toUpperCase() !== value.toUpperCase()) {
            onChange(next);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") setDraft(null);
        }}
        spellCheck={false}
        className="w-[68px] rounded-check border border-line bg-bg px-1 py-0.5 text-center font-mono text-mono tracking-mono-hex text-ink-2"
      />
    </div>
  );
}

function Derived({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="size-4 flex-none rounded-check border border-line"
        style={{ background: value }}
      />
      <dt className="flex-1 text-meta text-ink-2">{label}</dt>
      <dd>
        <MonoLabel tracking="hex" tone="ink-3" uppercase={false}>
          {value.toUpperCase()}
        </MonoLabel>
      </dd>
    </div>
  );
}
