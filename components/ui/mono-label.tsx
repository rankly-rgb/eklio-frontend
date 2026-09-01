import type { ElementType, ReactNode } from "react";

/*
 * Libellé mono — 11px IBM Plex Mono, capitales.
 *
 * La monospace n'apparaît QUE dans les contextes listés au §1 : bandeaux,
 * codes hex, noms de polices, compteurs d'étape, prix, libellés d'état
 * (SAVED, READY, 11 MORE LOCKED) et barre d'URL. Jamais sur un libellé de
 * formulaire, un bouton ou la navigation.
 */

export type MonoTracking =
  | "08"
  | "10"
  | "12"
  | "14"
  | "16"
  | "18"
  | "hex"
  | "url";
export type MonoTone = "ink" | "ink-2" | "ink-3" | "accent";

const TRACKING: Record<MonoTracking, string> = {
  "08": "tracking-mono-08",
  "10": "tracking-mono-10",
  "12": "tracking-mono-12",
  "14": "tracking-mono-14",
  "16": "tracking-mono-16",
  "18": "tracking-mono-18",
  hex: "tracking-mono-hex",
  url: "tracking-mono-url",
};

/*
 * `accent` mesure 4.20:1 sur `--bg` : sous le seuil AA du texte courant, mais
 * au-dessus de celui du GRAND texte. Il n'est donc légitime que sur les
 * libellés mono que les références y posent — « LEADING » et « READY » — qui
 * sont des états, jamais la seule façon de lire une information. Pour un
 * message que l'utilisateur DOIT lire, voir `InlineError`.
 */
const TONE: Record<MonoTone, string> = {
  ink: "text-ink",
  "ink-2": "text-ink-2",
  "ink-3": "text-ink-3",
  accent: "text-accent",
};

export function MonoLabel({
  children,
  tracking = "16",
  tone = "ink-2",
  size = "11",
  uppercase = true,
  as: Tag = "span",
  className = "",
  id,
}: {
  children: ReactNode;
  tracking?: MonoTracking;
  tone?: MonoTone;
  size?: "11" | "10";
  /** Les codes hex sont déjà écrits en capitales : la transformation est inutile. */
  uppercase?: boolean;
  as?: ElementType;
  className?: string;
  /** Utile quand le libellé sert de titre à une section (`aria-labelledby`). */
  id?: string;
}) {
  return (
    <Tag
      id={id}
      className={`font-mono ${size === "11" ? "text-mono" : "text-mono-sm"} ${
        TRACKING[tracking]
      } ${TONE[tone]} ${uppercase ? "uppercase" : ""} ${className}`}
    >
      {children}
    </Tag>
  );
}
