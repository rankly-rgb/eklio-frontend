import type { Metadata } from "next";
import { sans, mono } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Eklio — L'identité de marque qui vous ressemble",
  description:
    "Transformez un brief guidé en identité de marque complète : stratégie, palette, typographies, direction artistique, et un prompt prêt à coller dans votre constructeur de site préféré.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        {children}
      </body>
    </html>
  );
}
