/*
 * Où renvoyer le praticien après une connexion réussie.
 *
 * Le proxy pose `?next=` quand il intercepte une page protégée
 * (`lib/supabase/middleware.ts`), et l'espace connecté fait de même
 * (`app/app/layout.tsx`). Ce paramètre traverse donc l'URL, ce qui en fait une
 * ENTRÉE UTILISATEUR : n'importe qui peut envoyer un lien
 * `…/login?next=https://evil.example` et se servir de notre page de connexion
 * comme d'un tremplin. C'est la faille d'open redirect, et elle est d'autant
 * plus payante ici que la victime vient de taper son mot de passe : elle est en
 * confiance, et l'URL de départ était bien la nôtre.
 *
 * D'où ce module, PUR et sans dépendance : il ne fait qu'une chose, décider si
 * une destination est interne. Tout ce qui n'est pas manifestement un chemin de
 * notre propre application est refusé — la liste blanche est plus courte à
 * tenir que la liste des façons d'écrire « ailleurs ».
 */

/** Repli quand aucune destination sûre n'est demandée. */
export const DEFAULT_SIGNED_IN_PATH = "/app";

/*
 * Borne haute. Un chemin d'application légitime est court ; au-delà, c'est du
 * bourrage destiné à noyer un contrôle ou à faire déborder un log.
 */
const MAX_LENGTH = 512;

/*
 * Caractères que les navigateurs RETIRENT d'une URL avant de la résoudre :
 * tabulation, saut de ligne, retour chariot. `"/\tsomething"` et
 * `"/\t/evil.example"` ne se lisent donc pas comme ce que le contrôle voit —
 * `/\t/evil.example` devient `//evil.example`, c'est-à-dire un autre domaine.
 * On refuse tout caractère de contrôle plutôt que d'essayer de reproduire la
 * normalisation de chaque navigateur.
 */
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * Une destination interne sûre, ou `null`.
 *
 * Est accepté UNIQUEMENT un chemin absolu de notre application : il commence
 * par un seul `/`, et rien dans ce qui suit ne peut le faire sortir de
 * l'origine.
 *
 * Sont refusés, entre autres :
 * - `https://evil.example` et `//evil.example` — un `//` en tête est une URL
 *   protocol-relative, donc un autre domaine, malgré son air de chemin ;
 * - `/\evil.example` — le navigateur traite `\` comme `/`, ce qui reconstruit
 *   un `//` ;
 * - `javascript:…`, `data:…` — refusés par l'exigence du `/` initial ;
 * - `/%2f%2fevil.example` et ses variantes encodées, refusées après décodage ;
 * - tout ce qui porte un caractère de contrôle.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;

  const candidate = value.trim();

  if (candidate === "" || candidate.length > MAX_LENGTH) return null;
  if (CONTROL_CHARS.test(candidate)) return null;

  // Un chemin de notre application commence par `/`, et par un seul.
  if (!candidate.startsWith("/")) return null;

  /*
   * On contrôle la forme BRUTE et la forme DÉCODÉE. `/%2F%2Fevil.example` est
   * inoffensif tel quel, mais il ne coûte rien de le refuser : aucune
   * destination légitime de cette application n'a besoin d'un `//` encodé, et
   * la prochaine couche qui décodera avant de rediriger ne sera pas forcément
   * celle-ci.
   */
  for (const form of [candidate, decodeSafely(candidate)]) {
    if (form === null) return null;
    if (form.startsWith("//") || form.startsWith("/\\")) return null;
  }

  return candidate;
}

/** Décode une fois, ou rend `null` si l'encodage est malformé (`%zz`, `%`). */
function decodeSafely(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    // Un encodage invalide n'a aucune raison d'être dans une destination
    // légitime : on refuse plutôt que de deviner ce qu'il voulait dire.
    return null;
  }
}

/**
 * La destination de redirection après connexion : `next` s'il est sûr, le
 * tableau de bord sinon.
 *
 * Un `next` refusé ne fait jamais échouer la connexion — l'utilisateur est
 * authentifié, il atterrit simplement chez lui. Bloquer la connexion pour une
 * destination douteuse punirait la victime de l'attaque.
 */
export function signedInRedirectPath(
  value: string | null | undefined
): string {
  return safeNextPath(value) ?? DEFAULT_SIGNED_IN_PATH;
}
