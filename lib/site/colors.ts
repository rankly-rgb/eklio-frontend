import type { SiteSpec } from "@/lib/site/types";

/*
 * Les six rôles de couleur, dans l'ordre du §3 du FRONTEND_CONTRACT — marque,
 * puis surfaces, puis encre. Les libellés sont ceux du contrat, mot pour mot :
 * ce sont eux que la praticienne lit à côté du sélecteur, et ce sont eux que la
 * sortie réimprime à côté du hex.
 *
 * ⚠ `paper` ET `light_neutral`. Deux couleurs proches en valeur, deux métiers
 * différents : `paper` est LA PAGE (cinq des sept paires de contraste sont
 * mesurées dessus), `light_neutral` est une BANDE posée par-dessus (une seule
 * paire). Les fondre en un seul contrôle « la couleur claire » retire à la
 * praticienne le réglage de son fond de page et fait peindre à la maquette la
 * mauvaise surface. Elles ne se fondent pas.
 */

export type ColorRoleKey =
  | "primary"
  | "secondary"
  | "accent"
  | "paper"
  | "light_neutral"
  | "dark_neutral";

export type ColorRole = {
  key: ColorRoleKey;
  /** Le libellé du contrat, tel quel. */
  label: string;
  /** Ce que la couleur peint, dans les mots du contrat. */
  paints: string;
  /**
   * Un correctif de contraste peut-il déplacer ce rôle ?
   *
   * Non pour les deux surfaces, et jamais : `paper` porte cinq paires,
   * `light_neutral` une. Assombrir l'une pour réparer UNE paire changerait en
   * silence toutes les autres dessinées dessus.
   */
  fixable: boolean;
};

export const COLOR_ROLES: readonly ColorRole[] = [
  {
    key: "primary",
    label: "Primary",
    paints: "Buttons, links, active states.",
    fixable: true,
  },
  {
    key: "secondary",
    label: "Secondary",
    paints: "Supporting headings and surfaces.",
    fixable: true,
  },
  {
    key: "accent",
    label: "Accent",
    paints:
      "Small marks only — a check, a selected state, a rule under a heading. Never a large fill.",
    fixable: true,
  },
  {
    key: "paper",
    label: "Page background",
    paints: "The whole page. The largest surface on the site.",
    fixable: false,
  },
  {
    key: "light_neutral",
    label: "Section background",
    paints: "Tinted bands and cards sitting on top of the page.",
    fixable: false,
  },
  {
    key: "dark_neutral",
    label: "Body text",
    paints: "Body copy, and the fill of a dark section.",
    fixable: true,
  },
] as const;

export const COLOR_ROLE_KEYS = COLOR_ROLES.map((role) => role.key);

export function isColorRole(key: string): key is ColorRoleKey {
  return (COLOR_ROLE_KEYS as string[]).includes(key);
}

/*
 * Les QUATRE variantes dérivées. Elles arrivent dans `preview.tokens`, sont
 * recalculées par un trigger à chaque écriture, et n'ont AUCUN contrôle en
 * face d'elles : elles ne sont ni dans `spec`, ni patchables, ni des pastilles
 * à rendre. Elles se voient dans la maquette, dans le rapport de contraste et
 * dans la sortie — nulle part ailleurs.
 *
 * La règle, partout où une couleur de marque est peinte : si c'est du TEXTE,
 * la variante ; si c'est un APLAT — fond, bouton, bande, filet, bordure,
 * pastille — la couleur de marque.
 */
export const DERIVED_TOKEN_KEYS = [
  "primary_text",
  "secondary_text",
  "accent_text",
  "cta_ink",
] as const;
export type DerivedTokenKey = (typeof DERIVED_TOKEN_KEYS)[number];

export function isDerivedToken(key: string): key is DerivedTokenKey {
  return (DERIVED_TOKEN_KEYS as readonly string[]).includes(key);
}

const HEX = /^#[0-9A-Fa-f]{6}$/;

export function isHex(value: string): boolean {
  return HEX.test(value.trim());
}

/** Le patch d'un rôle. Une clé, une valeur, jamais une variante. */
export function colorPatch(
  role: ColorRoleKey,
  hex: string
): Record<ColorRoleKey, string> {
  return { [role]: hex.trim().toUpperCase() } as Record<ColorRoleKey, string>;
}

/**
 * Échange deux rôles — la pastille qu'on fait glisser sur une autre.
 *
 * Les deux clés partent dans le MÊME patch : deux écritures successives
 * feraient passer le spec par un état où les deux rôles portent le même hex,
 * et le trigger recalculerait les variantes sur cet état intermédiaire.
 */
export function swapRolesPatch(
  spec: Pick<SiteSpec, ColorRoleKey>,
  a: ColorRoleKey,
  b: ColorRoleKey
): Partial<Record<ColorRoleKey, string>> {
  if (a === b) return {};
  return { [a]: spec[b], [b]: spec[a] };
}

/** « Use as primary » — le même échange, avec le primaire comme destination. */
export function useAsPrimaryPatch(
  spec: Pick<SiteSpec, ColorRoleKey>,
  role: ColorRoleKey
): Partial<Record<ColorRoleKey, string>> {
  return swapRolesPatch(spec, role, "primary");
}
