import { ARCHETYPES, ARCHETYPE_KEYS } from "@/lib/compose/archetypes/index";
import { render } from "@/lib/compose/engine";
import { contentHash } from "@/lib/compose/hash";
import type { Palette } from "@/lib/compose/types";

/*
 * ── DEUX OU TROIS MISES EN PAGE DU MÊME CONTENU ─────────────────────────
 *
 * ⚠ GRATUITES, ET LE MOT EST LITTÉRAL. Aucune n'appelle de modèle : le
 * contenu est déjà écrit (c'est le payload du sujet), et les faire tenir
 * autrement est de l'arithmétique. `lib/compose/` ne touche aucun paquet
 * natif, donc ceci tourne dans le rendu de la page comme dans un test.
 *
 * ⚠ ET ELLES SONT DÉDUITES DU CACHE DE HASH. Chaque variante porte son
 * `contentHash` — le même que `rendered_assets.content_hash`. Choisir une
 * variante déjà rendue ne rend donc rien : le pipeline trouve le hash et sert
 * le chemin. Le hash est calculé ICI pour que ce soit vrai dès l'écran, et pas
 * seulement plus tard dans le pipeline.
 *
 * ── COMMENT LES ARCHÉTYPES COMPATIBLES SONT TROUVÉS ─────────────────────
 *
 * En essayant. `parse` de chaque module accepte ou refuse le payload, et
 * `render` accepte ou refuse de le composer aux planchers typographiques. Une
 * table « quel archétype accepte quelle forme » serait une troisième source,
 * après les onze modules et le validateur SQL — et c'est celle qui se
 * périmerait.
 */

export type LayoutAlternative = {
  archetypeKey: string;
  svg: string;
  contentHash: string;
  /** Ce que le résolveur a dû faire pour que ça tienne. Vide quand rien. */
  resolution: string[];
};

export type AlternativesInput = {
  archetypeKey: string;
  payload: unknown;
  palette: Palette;
  eyebrow: string;
  headline: string;
  footer: string;
};

/** Au plus trois : la variante servie, et deux autres. Au-delà c'est un catalogue. */
export const MAX_ALTERNATIVES = 3;

export function layoutAlternatives(input: AlternativesInput): LayoutAlternative[] {
  const out: LayoutAlternative[] = [];

  /*
   * ⚠ L'ARCHÉTYPE SERVI EST ESSAYÉ EN PREMIER, et il est donc premier dans la
   * liste quand il compose. Une liste où la carte qu'elle regarde n'est pas la
   * première demanderait de la retrouver avant de comparer.
   */
  const order = [
    input.archetypeKey,
    ...ARCHETYPE_KEYS.filter((key) => key !== input.archetypeKey),
  ];

  for (const key of order) {
    if (out.length >= MAX_ALTERNATIVES) break;

    const entry = ARCHETYPES[key];
    // `carousel` n'est pas une mise en page de rechange : c'est plus de cartes.
    if (!entry || key === "carousel") continue;
    if (entry.parse(input.payload) === null) continue;

    try {
      const result = render({
        archetype: key,
        payload: input.payload,
        palette: input.palette,
        eyebrow: input.eyebrow,
        headline: input.headline,
        footer: input.footer,
      });
      out.push({
        archetypeKey: key,
        svg: result.svg,
        contentHash: contentHash(key, input.payload, input.palette),
        resolution: result.composition.resolution,
      });
    } catch {
      /*
       * ⚠ UN REFUS N'EST PAS UNE ERREUR ICI. Le moteur refuse une composition
       * qui ne tient pas aux planchers typographiques ; c'est la bonne
       * réponse, et pour cet écran elle veut simplement dire « pas celle-là ».
       * Les variantes proposées sont donc, par construction, uniquement
       * celles qui tiennent.
       */
    }
  }

  return out;
}
