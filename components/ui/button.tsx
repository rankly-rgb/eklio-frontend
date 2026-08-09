import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

const styles: Record<Variant, string> = {
  primary:
    "bg-ink text-paper hover:bg-ink-soft disabled:opacity-40 disabled:hover:bg-ink",
  secondary:
    "border border-rule bg-transparent text-ink hover:bg-paper-raised disabled:opacity-40",
  danger:
    "border border-rule bg-transparent text-danger hover:bg-paper-raised disabled:opacity-40",
};

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={`rounded px-5 py-2.5 font-mono text-sm transition-colors disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
