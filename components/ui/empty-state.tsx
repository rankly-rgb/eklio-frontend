import type { ReactNode } from "react";

export function EmptyState({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-4 border-t border-b border-rule py-16">
      <h2 className="font-display text-3xl">{title}</h2>
      <p className="max-w-md text-base text-ink-soft">{text}</p>
      {children}
    </div>
  );
}
