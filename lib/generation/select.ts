import type { Catalog, PaletteFamily, TypePairing } from "@/lib/catalog/types";
import type { Palette, Typography } from "@/lib/brand/shapes";

/*
 * Le choix des palettes et des typographies des trois directions.
 *
 * IL EST DÉTERMINISTE, ET C'EST DÉLIBÉRÉ. Deux contraintes de la base sont
 * impossibles à garantir en demandant à un modèle :
 *   - `brand_kit_palette_valid` veut cinq hex valides par direction ;
 *   - `brand_kit_directions_contrasted` veut TROIS polices de titre
 *     DISTINCTES entre les trois directions ;
 *   - `type_pairings.google_fonts_url` doit être une URL Google Fonts réelle,
 *     ce qu'un modèle invente volontiers.
 *
 * Les tirer du CATALOGUE règle les trois d'un coup : les valeurs existent, sont
 * contrôlées en base, et les polices sont réellement chargeables. Le modèle
 * garde ce qu'il fait bien — écrire.
 *
 * L'ordre suit les choix du praticien : sa palette « LEADING » et sa paire
 * typographique arment la PREMIÈRE direction ; les deux autres complètent
 * depuis ses autres choix, puis depuis le catalogue.
 */

export type DirectionBasis = {
  palette: Palette;
  paletteFamilyId: string;
  typography: Typography;
  typePairingId: string;
};

function toPalette(family: PaletteFamily): Palette {
  return {
    primary: family.primary_hex,
    secondary: family.secondary_hex,
    light: family.light_hex,
    dark: family.dark_hex,
    paper: family.paper_hex,
  };
}

function toTypography(pairing: TypePairing): Typography {
  return {
    heading_font: pairing.heading_font,
    body_font: pairing.body_font,
    google_fonts_url: pairing.google_fonts_url,
  };
}

/** Trois familles distinctes : les choisies d'abord, le catalogue ensuite. */
export function pickPaletteFamilies(
  chosenIds: string[],
  catalog: Catalog
): PaletteFamily[] {
  const byId = new Map(catalog.paletteFamilies.map((f) => [f.id, f]));
  const picked: PaletteFamily[] = [];

  for (const id of chosenIds) {
    const family = byId.get(id);
    if (family && !picked.some((entry) => entry.id === family.id)) {
      picked.push(family);
    }
  }

  for (const family of catalog.paletteFamilies) {
    if (picked.length >= 3) break;
    if (!picked.some((entry) => entry.id === family.id)) picked.push(family);
  }

  return picked.slice(0, 3);
}

/**
 * Trois paires aux polices de TITRE distinctes.
 *
 * Deux paires du catalogue peuvent partager une police de corps sans gêne ;
 * partager une police de titre ferait échouer
 * `brand_kit_directions_contrasted` à l'écriture, après la génération.
 */
export function pickTypePairings(
  chosenId: string | null,
  catalog: Catalog
): TypePairing[] {
  const picked: TypePairing[] = [];
  const headings = new Set<string>();

  const take = (pairing: TypePairing | undefined) => {
    if (!pairing) return;
    if (headings.has(pairing.heading_font)) return;
    headings.add(pairing.heading_font);
    picked.push(pairing);
  };

  take(catalog.typePairings.find((entry) => entry.id === chosenId));
  for (const pairing of catalog.typePairings) {
    if (picked.length >= 3) break;
    take(pairing);
  }

  return picked.slice(0, 3);
}

/** La matière de chaque direction, avant que le modèle n'écrive un mot. */
export function directionBases(
  paletteFamilyIds: string[],
  typePairingId: string | null,
  catalog: Catalog
): DirectionBasis[] {
  const families = pickPaletteFamilies(paletteFamilyIds, catalog);
  const pairings = pickTypePairings(typePairingId, catalog);

  return families.map((family, index) => {
    const pairing = pairings[index] ?? pairings[pairings.length - 1];
    return {
      palette: toPalette(family),
      paletteFamilyId: family.id,
      typography: toTypography(pairing),
      typePairingId: pairing.id,
    };
  });
}

/**
 * L'overline du hero — `LCSW · PORTLAND, OR`.
 *
 * Même règle que `brief_preview()` : les deux parties sont jointes par « · »
 * SEULEMENT quand elles existent toutes les deux, sinon un brief avec une
 * ville mais pas de licence rendrait « · PORTLAND, OR ».
 */
export function heroOverline(
  licenseLabel: string | null,
  city: string | null,
  state: string | null
): string {
  const place =
    city?.trim() && state?.trim()
      ? `${city.trim().toUpperCase()}, ${state.trim().toUpperCase()}`
      : null;
  return [licenseLabel, place].filter(Boolean).join(" · ");
}
