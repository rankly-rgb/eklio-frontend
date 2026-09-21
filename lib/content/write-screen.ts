/*
 * ── QUEL ÉCRAN POUR QUEL POST ───────────────────────────────────────────
 *
 * La décision sortie du JSX, pour la même raison que `month-screen.ts` : ce
 * dépôt n'a pas d'infrastructure de rendu React, donc une décision qui vit
 * dans des ternaires ne peut être éprouvée qu'en déployant et en regardant.
 * C'est comme ça qu'un écran vide atteint une preview.
 */

export type PostKind =
  /** Écrit par Eklio : il a une légende, ou une carte composable. */
  | "generated"
  /** À elle, et rien dedans. C'est ce que « New item » produit. */
  | "manual_empty"
  /** À elle, avec un titre ou un début de légende déjà écrits. */
  | "manual_partial";

export type WriteState = "armed" | "not_switched_on" | "quota_exhausted";

export type WriteScreen = {
  /** Le panneau d'écriture est-il montré ? */
  panel: boolean;
  /** « Write it » peut-il partir ? */
  writeEnabled: boolean;
  /** Ce que le panneau explique, quand il ne peut pas écrire. */
  notice: "not_switched_on" | "quota_exhausted" | null;
  /** Faut-il la prévenir avant d'écrire par-dessus ses mots ? */
  warnsOverwrite: boolean;
};

export function writeScreen(input: { kind: PostKind; state: WriteState }): WriteScreen {
  /*
   * ⚠ UN POST DÉJÀ ÉCRIT N'A PAS DE PANNEAU. Elle vient le relire, pas le
   * refaire. Poser un « Write it » en tête d'un post terminé invite à dépenser
   * un crédit pour remplacer quelque chose qui allait bien.
   */
  if (input.kind === "generated") {
    return { panel: false, writeEnabled: false, notice: null, warnsOverwrite: false };
  }

  const warnsOverwrite = input.kind === "manual_partial";

  /*
   * ⚠ LE PANNEAU RESTE VISIBLE DANS LES TROIS ÉTATS. Désarmé il explique ;
   * caché il renverrait au formulaire vide, et elle n'apprendrait jamais que
   * la fonction existe.
   */
  if (input.state === "armed") {
    return { panel: true, writeEnabled: true, notice: null, warnsOverwrite };
  }
  return { panel: true, writeEnabled: false, notice: input.state, warnsOverwrite };
}


/*
 * ── CE QUI DÉSARME L'ÉCRITURE, ÉNUMÉRÉ ──────────────────────────────────
 *
 * ⚠ LA PAGE NE TESTAIT QUE LE DRAPEAU, et le type du panneau disait déjà
 * autre chose : « Le drapeau est éteint, OU LA CLEF ABSENTE ». Les deux ne se
 * sont jamais rencontrés. Avec `CONTENT_GENERATION_ARMED="true"` et pas de
 * `ANTHROPIC_API_KEY`, « Write it » s'allumait, annonçait « Uses 1 of your 7
 * left this month », et rendait un 503 « that's on us » au clic. Aucun crédit
 * n'était perdu — la clef est vérifiée avant la réservation — mais on
 * invitait à dépenser sur quelque chose qui ne pouvait pas tourner.
 *
 * Vérifié le 2026-09-21 en cliquant, clef retirée de l'environnement.
 *
 * ⚠ ET LA CAUSE EST RENDUE, pas seulement l'état. « Writing isn't switched on
 * for your account » nommait la mauvaise chose : ce n'est pas une propriété
 * du compte, aucun plan, aucun achat et aucun `comp_grant` ne l'ouvrent.
 * C'est une variable d'environnement du serveur, et la phrase envoyait
 * chercher du côté de la facturation. C'est la même famille de confusion que
 * `content_pipeline_enabled`, qui a coûté trois briefs (F7, F11).
 */
export type WriteOffReason = "flag" | "key" | "both";

export function writeOffReason(input: {
  armedFlag: boolean;
  keyPresent: boolean;
}): WriteOffReason | null {
  if (!input.armedFlag && !input.keyPresent) return "both";
  if (!input.armedFlag) return "flag";
  if (!input.keyPresent) return "key";
  return null;
}

/**
 * L'état de l'écriture, décidé en un seul endroit.
 *
 * ⚠ L'ORDRE COMPTE. Un quota épuisé sur un déploiement non armé n'est pas la
 * chose à dire : elle lirait « revenez le 1er » alors que rien ne reviendra.
 * Le désarmement passe donc devant.
 */
export function writeStateFor(input: {
  armedFlag: boolean;
  keyPresent: boolean;
  creditsLeft: number | null;
}): WriteState {
  if (writeOffReason(input) !== null) return "not_switched_on";
  if (input.creditsLeft !== null && input.creditsLeft <= 0) return "quota_exhausted";
  return "armed";
}

/**
 * La ligne de diagnostic, pour un écran qui a le droit de la montrer.
 *
 * ⚠ JAMAIS À UNE PRATICIENNE. L'appelant décide, avec `showsTechnicalDetail()`
 * — un nom de variable d'environnement sur l'écran d'une thérapeute est une
 * fuite, et `lib/env/deploy.ts` porte déjà cet arbitrage pour l'écran du mois.
 */
export function writeOffDetail(reason: WriteOffReason): string {
  const FLAG = 'CONTENT_GENERATION_ARMED is not exactly "true"';
  const KEY = "ANTHROPIC_API_KEY is not set";
  if (reason === "both") return `${FLAG}, and ${KEY}`;
  return reason === "flag" ? FLAG : KEY;
}

/*
 * ── QUI A ÉCRIT CE POST ─────────────────────────────────────────────────
 *
 * ⚠ CE N'EST PAS `PostKind`, ET LES CONFONDRE COÛTE DEUX RÉGLAGES. `PostKind`
 * répond « y a-t-il quelque chose dedans » — un post où ELLE a tapé une
 * légende compte comme rempli. Cette fonction-ci répond « est-ce Eklio qui
 * l'a écrit », et c'est la question que pose « What kind of post » et « Where
 * it is » : ces deux réglages restent sur ses posts à elle, et disparaissent
 * d'un post généré, où ils décrivent un choix qu'elle n'a pas fait.
 *
 * Les trois marques sont celles qu'une écriture machine laisse et qu'une
 * frappe au clavier ne laisse jamais : le sujet de banque dont le post vient,
 * le payload du diagramme, et la ligne « Why this one ». `update_content_item`
 * n'accepte aucune des trois — une garde de migration l'affirme pour
 * `payload` — donc rien de ce qu'elle tape ne peut les poser par accident.
 */
export type WrittenMarks = {
  topicId: string | null;
  payload: unknown;
  rationale: string | null;
};

export function eklioWroteThis(marks: WrittenMarks): boolean {
  return (
    marks.topicId !== null ||
    (marks.payload !== null && marks.payload !== undefined) ||
    marks.rationale !== null
  );
}

/*
 * ── QUEL TYPE DE POST, ET LE PIÈGE DE LA CARTE ──────────────────────────
 *
 * ⚠ UNE CARTE QUI COMPOSE N'EST PAS UNE PREUVE QU'EKLIO A ÉCRIT. La page
 * répondait `hasCaption || card !== null ? "generated" : …`, et
 * `reviewCardFor` a une exception littérale : pour `single_statement`, la
 * ligne affichée EST le titre. `statement` est l'archétype par défaut d'un
 * post créé par « New post ».
 *
 * Donc : elle crée un post, le panneau lui propose d'écrire ; elle tape un
 * titre — la première chose que le formulaire demande — et au rendu suivant
 * **le panneau a disparu**, remplacé par « Download image » et une carte
 * faite de ses quatre mots. Elle a perdu l'offre d'écrire en faisant ce
 * qu'on lui demandait.
 *
 * Et `manual_partial` devenait INATTEIGNABLE pour l'archétype par défaut : la
 * colonne la plus soigneusement décrite de la matrice, celle qui porte
 * `warnsOverwrite`, ne pouvait pas se produire. La matrice était verte parce
 * qu'elle teste la fonction, pas la façon dont la page y entre.
 *
 * Trouvé le 2026-09-21, en rechargeant la page après avoir tapé un titre.
 *
 * Le bon prédicat existait déjà dix lignes plus bas dans la même page :
 * `eklioWroteThis`, les trois marques qu'une écriture machine laisse et
 * qu'une frappe au clavier ne laisse jamais.
 */
export function postKindFor(input: {
  hasCaption: boolean;
  hasTitle: boolean;
  marks: WrittenMarks;
}): PostKind {
  if (input.hasCaption || eklioWroteThis(input.marks)) return "generated";
  return input.hasTitle ? "manual_partial" : "manual_empty";
}
