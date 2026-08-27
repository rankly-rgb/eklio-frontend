/*
 * Les trois seuls glyphes de l'application — la coche, le chevron et le
 * cadenas. Aucune bibliothèque d'icônes, aucun fichier SVG : chacun est
 * dessiné en divs bordées, exactement comme dans `design/reference/`.
 *
 * Une implémentation par glyphe, et une seule. Si un écran a besoin d'une
 * autre taille, elle s'ajoute ici en variante nommée.
 */

/**
 * Coche : boîte tournée à −45°, bordures gauche et basse.
 *
 * Trois tailles relevées sur les références :
 *   sm — 7×4, trait 1.5px  · case à cocher 14px (Écran 7)
 *   md — 8×4, trait 1.5px  · pastille de sélection et case 16px (Écrans 1, 2, 8)
 *   lg — 9×5, trait 1px    · étape franchie de la génération (Écran 3)
 */
export function CheckGlyph({
  size = "md",
  color = "var(--bg)",
}: {
  size?: "sm" | "md" | "lg";
  color?: string;
}) {
  const geometry = {
    sm: { width: 7, height: 3, stroke: 1.5 },
    md: { width: 8, height: 4, stroke: 1.5 },
    lg: { width: 9, height: 5, stroke: 1 },
  }[size];

  return (
    <span
      aria-hidden="true"
      style={{
        display: "block",
        width: geometry.width,
        height: geometry.height,
        borderLeft: `${geometry.stroke}px solid ${color}`,
        borderBottom: `${geometry.stroke}px solid ${color}`,
        transform: "rotate(-45deg) translateY(-1px)",
      }}
    />
  );
}

/**
 * Pastille de sélection : disque argile de 18px portant une coche blanche,
 * posé en haut à droite de la carte sélectionnée. Entre en grandissant depuis
 * 0.6 en 150 ms (`check-pop`), instantané en mouvement réduit.
 */
export function SelectionDisc({ offset = "8px" }: { offset?: string }) {
  return (
    <span
      aria-hidden="true"
      style={{ top: offset, right: offset }}
      className="check-pop absolute flex size-[18px] items-center justify-center rounded-pill bg-accent"
    >
      <CheckGlyph size="md" />
    </span>
  );
}

/**
 * Chevron du bouton « Copy site prompt » : carré de 6px bordé à droite et en
 * bas, tourné de 45°. Le seul chevron de l'application.
 */
export function ChevronGlyph({ color = "var(--bg)" }: { color?: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "block",
        width: 6,
        height: 6,
        borderRight: `1.5px solid ${color}`,
        borderBottom: `1.5px solid ${color}`,
        transform: "rotate(45deg) translateY(-1px)",
      }}
    />
  );
}

/**
 * Cadenas des tuiles verrouillées : deux divs — l'anse (bords haut arrondis
 * seulement, pas de bord bas) au-dessus du corps. Trait 1px argile.
 *
 *   sm — 11×7 / 17×13 · grille de contenu du bureau (Écran 7)
 *   md — 12×8 / 18×14 · tuile mobile (Écran 8)
 */
export function PadlockGlyph({ size = "sm" }: { size?: "sm" | "md" }) {
  const geometry = {
    sm: { shackle: [11, 7], body: [17, 13] },
    md: { shackle: [12, 8], body: [18, 14] },
  }[size];

  return (
    <span aria-hidden="true" className="flex flex-col items-center">
      <span
        style={{
          display: "block",
          width: geometry.shackle[0],
          height: geometry.shackle[1],
          border: "1px solid var(--accent)",
          borderBottom: "none",
          borderRadius: "6px 6px 0 0",
        }}
      />
      <span
        style={{
          display: "block",
          width: geometry.body[0],
          height: geometry.body[1],
          border: "1px solid var(--accent)",
          borderRadius: "2px",
        }}
      />
    </span>
  );
}
