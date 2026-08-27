import { Fraunces, Karla, IBM_Plex_Mono } from "next/font/google";

/*
 * Trois familles, pas une de plus (§1) :
 *   display — Fraunces, axe optique 9..144, graisses 400/500/600. Wordmark,
 *             titres de page, questions du brief, titres de section et de
 *             carte, et la légende « Your site, taking shape. ».
 *   sans    — Karla 400/500/600. Corps de texte et interface.
 *   mono    — IBM Plex Mono 400/500. Bandeaux, hex, noms de polices, compteurs
 *             d'étape, prix, libellés d'état et barre d'URL. Rien d'autre.
 *
 * Les huit références chargent ces familles via un <link> Google Fonts. On
 * passe ici par `next/font/google`, qui les auto-héberge : zéro requête vers
 * Google au runtime, aucun décalage de mise en page, `display: swap` conservé.
 * L'écart est délibéré et va dans le sens de l'intention (« une seule requête
 * Google Fonts » devient « aucune »).
 *
 * Les polices de MARQUE, elles, restent chargées dynamiquement depuis Google
 * au changement de modèle de prévisualisation (§4) : elles ne sont pas connues
 * au build. Le `<link rel="preconnect">` du layout racine existe pour elles.
 */

export const display = Fraunces({
  subsets: ["latin"],
  // L'axe optique fait partie du dessin de Fraunces : sans lui, les grands
  // titres reçoivent le dessin des petits corps.
  axes: ["opsz"],
  variable: "--font-fraunces",
  display: "swap",
});

export const sans = Karla({
  subsets: ["latin"],
  variable: "--font-karla",
  display: "swap",
});

export const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

/** Classes de variables à poser sur <html>. */
export const fontVariables = `${display.variable} ${sans.variable} ${mono.variable}`;
