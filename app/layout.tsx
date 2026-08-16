import type { Metadata } from "next";
import { display, sans, mono } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Eklio — a brand that sounds like your practice",
  description:
    "A guided brief turns into a complete brand identity for your private practice: positioning, palette, typography, and finished website copy built to respect ACA and APA advertising principles.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream text-noir">
        {children}
      </body>
    </html>
  );
}
