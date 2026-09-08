/*
 * Les glyphes de l'application — la coche, le chevron, le cadenas, et les
 * sept marques du rail de sections. Aucune bibliothèque d'icônes, aucun
 * fichier SVG : chacun est dessiné en divs bordées, exactement comme dans
 * `design/reference/`.
 *
 * Une implémentation par glyphe, et une seule. Si un écran a besoin d'une
 * autre taille, elle s'ajoute ici en variante nommée.
 */

import type { KitSectionId } from "@/lib/kit/sections";

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
 * Chevron : carré de 6px bordé à droite et en bas, tourné de 45°. Le seul
 * chevron de l'application.
 *
 * Il portait le menu de « Copy site prompt », retiré au lot 11 avec le reste
 * de cet ancien chemin. Il reste au catalogue (`/dev/ui`) : c'est le seul
 * chevron dessiné du système, et le redessiner le jour où un menu revient
 * serait un doublon.
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
 * Les sept marques du rail de sections — 14×14, trait 1.25px, `currentColor`.
 *
 * Elles ne remplacent pas le libellé : chacune est `aria-hidden`, posée à
 * gauche d'un mot qui dit la même chose. C'est de la reconnaissance de
 * forme dans une liste de sept, pas une icône à déchiffrer.
 *
 * Dessinées en divs comme les trois autres. Pas de SVG, pas de dépendance :
 * sept marques géométriques (grille, disque, trois pastilles, un T, une
 * fenêtre, trois lignes, un cadre) tiennent très bien en bordures.
 */
export function SectionGlyph({ section }: { section: KitSectionId }) {
  const stroke = "1.25px solid currentColor";
  const box = { display: "block", boxSizing: "border-box" } as const;

  const marks: Record<KitSectionId, React.ReactNode> = {
    // Grille 2×2 — la vue d'ensemble.
    overview: (
      <span className="grid grid-cols-2 gap-[2px]">
        {[0, 1, 2, 3].map((cell) => (
          <span key={cell} style={{ ...box, width: 5, height: 5, border: stroke }} />
        ))}
      </span>
    ),
    // Disque évidé portant un point — une marque dans son cadre.
    identity: (
      <span
        style={{ ...box, width: 12, height: 12, border: stroke, borderRadius: 999 }}
        className="flex items-center justify-center"
      >
        <span style={{ ...box, width: 4, height: 4, background: "currentColor", borderRadius: 999 }} />
      </span>
    ),
    // Trois pastilles qui se chevauchent — une palette.
    colors: (
      <span className="flex items-center">
        {[0, 1, 2].map((disc) => (
          <span
            key={disc}
            style={{
              ...box,
              width: 7,
              height: 7,
              border: stroke,
              borderRadius: 999,
              marginLeft: disc === 0 ? 0 : -2.5,
              background: "var(--bg)",
            }}
          />
        ))}
      </span>
    ),
    // Un T — la lettre, pas le mot.
    type: (
      <span className="flex flex-col items-center">
        <span style={{ ...box, width: 12, height: 0, borderTop: stroke }} />
        <span style={{ ...box, width: 0, height: 11, borderLeft: stroke }} />
      </span>
    ),
    // Une fenêtre de navigateur — barre de titre pleine, corps évidé.
    site: (
      <span style={{ ...box, width: 13, height: 11, border: stroke, borderRadius: 2 }}>
        <span style={{ ...box, width: "100%", height: 3, borderBottom: stroke }} />
      </span>
    ),
    // Trois lignes de longueurs inégales — un paragraphe.
    words: (
      <span className="flex flex-col gap-[3px]">
        {[13, 9, 11].map((width, index) => (
          <span key={index} style={{ ...box, width, height: 0, borderTop: stroke }} />
        ))}
      </span>
    ),
    // Un cadre portant un disque — un fichier image.
    assets: (
      <span
        style={{ ...box, width: 13, height: 11, border: stroke, borderRadius: 2 }}
        className="flex items-end justify-end p-[2px]"
      >
        <span style={{ ...box, width: 4, height: 4, background: "currentColor", borderRadius: 999 }} />
      </span>
    ),
  };

  return (
    <span
      aria-hidden="true"
      className="flex size-[14px] flex-none items-center justify-center"
    >
      {marks[section]}
    </span>
  );
}

/**
 * Flèche de téléchargement — un trait vertical sous une pointe. Elle
 * n'apparaît qu'à côté du mot « Download », jamais seule : c'est un
 * renfort, pas une étiquette.
 */
export function DownloadGlyph({ color = "currentColor" }: { color?: string }) {
  return (
    <span aria-hidden="true" className="flex size-[13px] flex-col items-center justify-center gap-[2px]">
      <span
        style={{
          display: "block",
          width: 0,
          height: 6,
          borderLeft: `1.5px solid ${color}`,
        }}
      />
      <span
        style={{
          display: "block",
          width: 5,
          height: 5,
          borderRight: `1.5px solid ${color}`,
          borderBottom: `1.5px solid ${color}`,
          transform: "rotate(45deg) translate(-3px, -3px)",
        }}
      />
      <span
        style={{
          display: "block",
          width: 11,
          height: 0,
          borderTop: `1.5px solid ${color}`,
          marginTop: -2,
        }}
      />
    </span>
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
