import type { ReactNode } from "react";
import { MonoLabel } from "@/components/ui/mono-label";

/*
 * Cadre de navigateur — barre de chrome sur `--card` avec filet bas, trois
 * points `--line`, et une pastille d'URL arrondie sur `--bg` portant le
 * domaine en mono (§2).
 *
 * Trois hauteurs, relevées sur les références :
 *   thumbnail 24px — carte « Your brand » de l'accueil (Écran 7), sans texte
 *   panel     34px — rail du brief (Écrans 1 et 2)
 *   full      38px — kit de marque (Écran 5)
 */

type FrameSize = "thumbnail" | "panel" | "full";

const GEOMETRY: Record<
  FrameSize,
  { bar: number; dot: number; dotGap: number; pad: number; gap: number; pill: number }
> = {
  thumbnail: { bar: 24, dot: 6, dotGap: 4, pad: 10, gap: 8, pill: 12 },
  panel: { bar: 34, dot: 8, dotGap: 5, pad: 12, gap: 12, pill: 18 },
  full: { bar: 38, dot: 9, dotGap: 6, pad: 14, gap: 14, pill: 20 },
};

export function BrowserFrame({
  size = "panel",
  domain,
  children,
  shadow = false,
  className = "",
}: {
  size?: FrameSize;
  /** Absent sur la vignette de l'accueil : la pastille y reste vide. */
  domain?: string;
  children: ReactNode;
  /** L'unique ombre de l'app, réservée à la carte de prévisualisation du brief. */
  shadow?: boolean;
  className?: string;
}) {
  const g = GEOMETRY[size];

  return (
    <div
      className={`overflow-hidden rounded-card border border-line bg-surface ${
        shadow ? "shadow-preview" : ""
      } ${className}`}
    >
      <div
        className="flex items-center border-b border-line bg-card"
        style={{ height: g.bar, gap: g.gap, paddingInline: g.pad }}
      >
        <div className="flex" style={{ gap: g.dotGap }}>
          {[0, 1, 2].map((dot) => (
            <div
              key={dot}
              className="rounded-pill bg-line"
              style={{ width: g.dot, height: g.dot }}
            />
          ))}
        </div>
        <div
          className="flex flex-1 items-center rounded-pill border border-line bg-bg"
          style={{ height: g.pill, paddingInline: domain ? g.pad - 2 : 0 }}
        >
          {domain ? (
            <MonoLabel tracking="url" tone="ink-3" size="10" uppercase={false}>
              {domain}
            </MonoLabel>
          ) : null}
        </div>
      </div>
      {children}
    </div>
  );
}
