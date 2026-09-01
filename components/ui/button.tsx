import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

/*
 * Bouton — hauteur 40px, rayon plein, 14px (§2).
 *
 * Quatre variantes, et une règle qui les gouverne : au plus UN bouton
 * `primary` ou `accent` par écran. `accent` est réservé à l'argile — la
 * direction recommandée, « Add Monthly Presence ». Il n'existe nulle part de
 * rectangle noir pleine largeur dans cette application.
 */

export type ButtonVariant = "primary" | "secondary" | "accent" | "tertiary";

const BASE =
  "inline-flex items-center justify-center gap-2.5 whitespace-nowrap text-ui transition-colors disabled:cursor-not-allowed disabled:opacity-40";

const SHAPED = `${BASE} h-10 rounded-pill box-border`;

const VARIANTS: Record<ButtonVariant, string> = {
  primary: `${SHAPED} bg-ink px-[30px] font-semibold text-bg hover:bg-ink-2`,
  secondary: `${SHAPED} border border-line px-[26px] text-ink hover:bg-card`,
  accent: `${SHAPED} bg-accent px-[26px] font-semibold text-bg hover:opacity-90`,
  // Texte nu, souligné argile au survol. Pas de hauteur, pas de rayon.
  tertiary: `${BASE} text-ink-2 hover:text-ink hover:underline hover:decoration-[var(--accent)] hover:underline-offset-4`,
};

export function buttonClasses(variant: ButtonVariant = "primary"): string {
  return VARIANTS[variant];
}

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type={type}
      className={`${buttonClasses(variant)} ${className}`}
      {...props}
    />
  );
}

/** Même dessin, rendu en lien — « Open brand kit », « Continue », la nav. */
export function ButtonLink({
  variant = "primary",
  className = "",
  href,
  children,
  ...props
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  variant?: ButtonVariant;
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`${buttonClasses(variant)} ${className}`}
      {...props}
    >
      {children}
    </Link>
  );
}
