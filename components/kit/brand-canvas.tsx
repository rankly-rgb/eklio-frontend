import type { CSSProperties, ElementType, ReactNode } from "react";
import { brandCanvasVariables } from "@/lib/kit/canvas-tokens";
import type { SitePreviewTokens } from "@/lib/site/types";

/*
 * <BrandCanvas> — the one place, everywhere in the paid space, her palette
 * and fonts are allowed to take over completely.
 *
 * A framed surface: a visible 1px hairline, a radius, a subtle inner shadow
 * (`.brand-canvas`, `styles/canvas.css`). Inside it, her six color roles and
 * four derived variants are `--brand-*` custom properties, SCOPED to this
 * node and its subtree — never set on `:root`, `body`, or any app-level
 * element. Outside a canvas, the app stays Eklio: off-white ground, near-black
 * ink, the existing serif/mono pairing.
 *
 * The one deliberate exception — her primary color on the page's single
 * primary-action button — is styled inline where that button lives, not
 * through this component: it is one specific element per screen, not a
 * reusable surface.
 */
export function BrandCanvas({
  tokens,
  as: Tag = "div",
  className = "",
  style,
  children,
}: {
  tokens: SitePreviewTokens;
  /** Rendered element. A `<section>` or `<figure>` reads better in places. */
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <Tag
      className={`brand-canvas ${className}`}
      style={{ ...brandCanvasVariables(tokens), ...style }}
    >
      {children}
    </Tag>
  );
}
