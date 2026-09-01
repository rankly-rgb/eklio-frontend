"use client";

import { MonoLabel } from "@/components/ui/mono-label";
import { PlaceholderLines } from "@/components/ui/placeholder-lines";
import { contrastRatio, meetsAA } from "@/lib/brand/color";
import { PALETTE_ROLES, type Direction } from "@/lib/brand/shapes";

/*
 * La section Palette du kit (Écran 5).
 *
 * Cinq aplats de 96px à ras bord, leurs libellés `RÔLE #HEX` en mono, et à
 * droite la palette APPLIQUÉE : le bouton, le lien souligné, une carte de
 * lignes, et le badge AA.
 *
 * LE BADGE DIT LA VÉRITÉ. Il mesure le contraste réel entre le texte du bouton
 * et son fond, dans la palette DU PRATICIEN, et il annonce l'échec quand il y
 * en a un. Cacher un échec ferait publier un site illisible à quelqu'un qui
 * croirait le contraire — le calcul est fait ici, pas promis.
 */
export function PaletteSection({ direction }: { direction: Direction }) {
  const { palette } = direction;

  // La paire qui compte : le libellé du CTA sur son aplat. C'est le seul
  // endroit du site où du texte est posé sur le primaire saturé.
  const ratio = contrastRatio(palette.light, palette.primary);
  const passes = meetsAA(palette.light, palette.primary, "large");
  const rounded = Math.round(ratio * 10) / 10;

  return (
    <div className="flex items-start gap-12 max-xl:flex-col max-xl:gap-8">
      <div className="w-site-mock max-w-full flex-none">
        <div className="grid grid-cols-5">
          {PALETTE_ROLES.map((role) => (
            <div
              key={role}
              className="h-24"
              style={{
                background: palette[role],
                // Un clair ou un papier sans filet disparaît sur le fond de page.
                boxShadow:
                  role === "light" || role === "paper"
                    ? "inset 0 0 0 1px rgba(38,33,28,0.10)"
                    : undefined,
              }}
            />
          ))}
        </div>
        <div className="mt-2.5 grid grid-cols-5">
          {PALETTE_ROLES.map((role) => (
            <MonoLabel key={role} tracking="url">
              {`${role} ${palette[role]}`}
            </MonoLabel>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-5">
        <span
          className="flex h-10 flex-none items-center whitespace-nowrap rounded-pill px-5"
          style={{
            background: palette.primary,
            color: palette.light,
            fontFamily: `"${direction.typography.body_font}", system-ui, sans-serif`,
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {direction.hero.cta_label}
        </span>

        <span
          className="flex-none pb-0.5"
          style={{
            borderBottom: `1px solid ${palette.primary}`,
            color: palette.primary,
            fontFamily: `"${direction.typography.body_font}", system-ui, sans-serif`,
            fontSize: 13,
          }}
        >
          About
        </span>

        <div
          className="min-w-0 flex-1 rounded-[12px] p-[16px_18px]"
          style={{ background: palette.light }}
        >
          <PlaceholderLines widths={[86, 70]} count={2} height={5} gap={7} opacity={0.5} />
        </div>

        <span
          title={`Contrast ratio ${rounded}:1 between the button label and its fill.`}
          className={`flex-none rounded-pill border px-2.5 py-1 font-mono text-mono tracking-mono-10 ${
            passes ? "border-line text-ink-2" : "border-accent text-accent"
          }`}
        >
          {passes ? "AA" : `AA fails · ${rounded}:1`}
          <span className="sr-only">
            {passes
              ? ` — the button label passes WCAG AA at ${rounded} to 1.`
              : ` — the button label does not reach WCAG AA. It measures ${rounded} to 1.`}
          </span>
        </span>
      </div>
    </div>
  );
}
