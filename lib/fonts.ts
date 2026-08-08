import { Inter, IBM_Plex_Mono, Fraunces } from "next/font/google";

/**
 * TODO(design): Recoleta Bold est une police commerciale (non disponible sur
 * Google Fonts). En attendant l'achat de la licence, on utilise Fraunces
 * (serif éditorial, licence libre) comme placeholder visuel sur le même rôle
 * (`--font-display`, titres). Pour brancher la vraie police une fois les
 * fichiers .woff2 obtenus :
 *   1. Placer les fichiers dans `app/fonts/recoleta/`.
 *   2. Remplacer l'import Fraunces ci-dessous par `next/font/local`, ex:
 *        import localFont from "next/font/local";
 *        export const display = localFont({
 *          src: "../app/fonts/recoleta/Recoleta-Bold.woff2",
 *          variable: "--font-recoleta",
 *          weight: "700",
 *        });
 *   3. Ne rien changer côté Tailwind : le token --font-display pointe déjà
 *      sur --font-recoleta dans app/globals.css.
 */
export const display = Fraunces({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-recoleta",
  display: "swap",
});

export const sans = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});
