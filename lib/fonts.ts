import { Inter, IBM_Plex_Mono, Fraunces } from "next/font/google";

/**
 * All three families are loaded at build time by `next/font`. Nothing in this
 * app ever loads a font at runtime — Next.js needs typefaces known at build
 * time, so generated font names elsewhere are shown as text with a sample only
 * when the family is in this preloaded set.
 *
 * TODO(design): Recoleta Bold is a commercial typeface (not on Google Fonts).
 * Until the license is bought, Fraunces (editorial serif, open license) stands
 * in for the same role (`--font-display`, headings). To swap in the real face
 * once the .woff2 files exist:
 *   1. Put the files in `app/fonts/recoleta/`.
 *   2. Replace the Fraunces import below with `next/font/local`, e.g.:
 *        import localFont from "next/font/local";
 *        export const display = localFont({
 *          src: "../app/fonts/recoleta/Recoleta-Bold.woff2",
 *          variable: "--font-recoleta",
 *          weight: "700",
 *        });
 *   3. Nothing changes on the Tailwind side: the --font-display token already
 *      points at --font-recoleta in app/globals.css.
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
