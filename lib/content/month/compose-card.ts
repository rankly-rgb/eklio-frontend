import { composeWithFallback } from "@/lib/compose/fallback";
import type { RenderInput } from "@/lib/compose/types";

/*
 * ══════════════════════════════════════════════════════════════════════════
 *  LA COMPOSITION D'UNE CARTE — ÉTAGE C4 DE F45
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ⚠ CE MODULE EXISTE POUR LA MENTION DE LICENCE, AVANT TOUT LE RESTE.
 *
 * `composeWithFallback` était appelé par le harnais et par la planche de
 * contrôle, jamais par le chemin produit. Son exemption au recensement disait
 * « la composition vectorielle des onze archétypes » — vrai, et incomplet : c'est
 * aussi la SEULE bande partagée par les onze archétypes, donc le seul endroit où
 * le numéro de licence se pose. Un mois composé sans elle ne porterait aucune
 * mention, ce que la Californie exige dans toute publicité d'un praticien
 * licencié (B&P §651).
 *
 * ── ⚠ ET LE PIED SANS MENTION EST REFUSÉ, PAS COMPOSÉ ───────────────────
 *
 * Le harnais passait `${practiceName} · ${mention}` sans jamais vérifier que
 * `mention` porte quelque chose. Une mention vide composait « Cabinet · » — une
 * carte d'apparence normale, sans numéro, que personne ne remarquerait à la
 * relecture. C'est la forme exacte de F46 : `licenceMention` retombe sur
 * `LICENCE_ABBREVIATION`, donc une abréviation manquante ne refusait même pas.
 *
 * Ce refus est un contrôle AJOUTÉ, pas un contrôle relâché, et il ne devrait
 * jamais parler : `month/preflight.ts` refuse déjà un mois sans licence avant
 * toute dépense. Un préalable qui protège et une composition qui vérifie disent
 * la même chose à deux moments — le premier évite de dépenser, la seconde empêche
 * de publier.
 */

/** Ce qu'une carte composée rend, et que l'assemblage écrit. */
export type ComposedCard = {
  /**
   * L'archétype qui a VRAIMENT tenu, pas celui qui a été demandé.
   *
   * ⚠ ÉCRIRE L'ARCHÉTYPE DEMANDÉ SUR UN POST QUE LE MOTEUR A REPLIÉ donnerait
   * une carte que l'écran de relecture ne saurait pas redessiner.
   */
  archetype: string;
  /** Le payload tel qu'il a été composé, replis compris. */
  payload: unknown;
  /** Le SVG de la carte, ou de la première diapositive d'un carrousel. */
  svg: string;
  /** Les replis qu'il a fallu, dits plutôt que tus. */
  steps: string[];
  /** Ce vers quoi il a replié, pour le rapport : un archétype, ou `carousel×N`. */
  landedOn: string;
};

/** Ce qu'un refus de composition dit. */
export class ComposeRefused extends Error {}

export type ComposeCardInput = {
  archetype: string;
  payload: unknown;
  palette: RenderInput["palette"];
  eyebrow: string;
  headline: string;
  /** `Cabinet · LMFT #12345`, et la mention n'est pas facultative. */
  footer: string;
  /**
   * La mention attendue dans le pied, vérifiée et non supposée.
   *
   * ⚠ ELLE EST PASSÉE À PART, PAS EXTRAITE DU PIED. Un contrôle qui découperait
   * `footer` sur son séparateur tirerait sa référence de la source qu'il
   * surveille — la règle de F16. La mention vient de `licenceMention`, le pied est
   * construit par l'appelant, et ce module vérifie que le second contient la
   * première.
   */
  licenceMention: string;
};

/**
 * Compose une carte, ou refuse en disant pourquoi.
 *
 * Lève `ComposeRefused` quand le pied ne porte pas la mention ; relaie l'erreur
 * du moteur telle quelle quand c'est le moteur qui n'a pas pu.
 */
export function composeCard(input: ComposeCardInput): ComposedCard {
  /*
   * ⚠ LE PIED EST VÉRIFIÉ AVANT DE COMPOSER. Après, on aurait un SVG qu'il
   * faudrait jeter — et l'expérience de ce dépôt est qu'un livrable produit finit
   * par être publié.
   */
  const mention = input.licenceMention.trim();
  if (mention.length === 0) {
    throw new ComposeRefused(
      "refusing to compose a card without a licence mention: California B&P §651 requires it in every advertisement, and this footer is the only band the eleven archetypes share"
    );
  }
  if (!input.footer.includes(mention)) {
    throw new ComposeRefused(
      `the footer does not carry the licence mention (${mention}): a card composed now would advertise without it`
    );
  }

  const composed = composeWithFallback(
    {
      archetype: input.archetype,
      payload: input.payload,
      palette: input.palette,
      eyebrow: input.eyebrow,
      headline: input.headline,
      footer: input.footer,
    } as RenderInput,
    input.headline
  );

  return {
    archetype: composed.archetype,
    payload: composed.payload,
    svg: composed.kind === "carousel" ? composed.slides[0].svg : composed.result.svg,
    steps: composed.steps,
    landedOn:
      composed.kind === "carousel" ? `carousel×${composed.slides.length}` : composed.archetype,
  };
}
