import type { Metadata } from "next";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Eklio — a brand identity that sounds like you",
  description:
    "A guided 7-step brief becomes a complete brand identity: positioning, palette, typography, voice and a site prompt you can paste into your website builder.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // suppressHydrationWarning : les extensions de navigateur (assistants IA,
  // correcteurs…) injectent des attributs sur <html>/<body> avant React, ce
  // qui déclenche de faux avertissements d'hydratation en dev. La suppression
  // ne porte que sur les attributs de ces deux balises.
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontVariables} h-full`}
    >
      <head>
        {/*
          Les trois polices de l'app sont auto-hébergées par next/font. Ces
          preconnect servent les polices de MARQUE, chargées dynamiquement
          depuis Google au changement de modèle de prévisualisation (§4).
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
      </head>
      <body suppressHydrationWarning className="flex min-h-full flex-col">
        {children}
      </body>
    </html>
  );
}
