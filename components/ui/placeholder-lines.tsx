/*
 * Lignes de placeholder — le motif qui tient lieu de texte dans chaque
 * maquette. Il apparaît sur six écrans sur huit : UNE implémentation, ici, et
 * nulle part ailleurs.
 *
 * Largeurs canoniques 92 % / 84 % / 64 %, hauteur 4 à 6px, rayon 2px, encre
 * `--ink-3` à 50–55 % d'opacité (§2).
 */

export const CANONICAL_WIDTHS = [92, 84, 64] as const;

export function PlaceholderLines({
  count = 3,
  widths = CANONICAL_WIDTHS,
  height = 4,
  gap = 5,
  /* Sur une tuile de marque saturée, les lignes reprennent la couleur claire
     de la palette plutôt que l'encre de l'app. */
  color = "var(--ink-3)",
  opacity = 0.55,
  className = "",
}: {
  count?: number;
  widths?: readonly number[];
  height?: number;
  gap?: number;
  color?: string;
  opacity?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`flex flex-col ${className}`}
      style={{ gap }}
    >
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          style={{
            height,
            width: `${widths[index % widths.length]}%`,
            borderRadius: 2,
            background: color,
            opacity,
          }}
        />
      ))}
    </div>
  );
}
