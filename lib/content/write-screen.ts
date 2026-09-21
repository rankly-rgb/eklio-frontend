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
