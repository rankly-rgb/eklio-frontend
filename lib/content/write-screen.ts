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
