import { ETHICS_DISCLAIMER_TEXT } from "@/lib/ethics/disclaimer";

/*
 * Rappel affiché partout où du contenu généré est présenté au praticien
 * (directions, kit, Monthly Presence). Le texte canonique vit dans
 * lib/ethics/disclaimer.ts ; il est réexporté ici par commodité.
 */
export { ETHICS_DISCLAIMER_TEXT };

export function EthicsDisclaimer({ className }: { className?: string }) {
  return (
    <p
      className={`text-xs leading-relaxed text-ink-muted${className ? ` ${className}` : ""}`}
    >
      {ETHICS_DISCLAIMER_TEXT}
    </p>
  );
}
