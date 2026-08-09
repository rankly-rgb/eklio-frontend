import { Inter, IBM_Plex_Mono } from "next/font/google";

/*
 * Trois rôles typographiques, pas plus :
 * - display : Recoleta Bold, déclarée en @font-face dans app/globals.css
 *   (fichier attendu en public/fonts/Recoleta-Bold.woff2 ; repli Georgia si
 *   absent — voir NOTES.md). Titres de page et de question uniquement.
 * - sans : Inter 400/500, corps de texte et interface.
 * - mono : IBM Plex Mono 400/500, numéros d'étape, libellés, méta, fiche
 *   de marque.
 */
export const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-inter",
  display: "swap",
});

export const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});
