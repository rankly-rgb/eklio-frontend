import type { ReactNode } from "react";

/*
 * Une section du rail — un titre, un sous-titre facultatif, le contenu.
 *
 * Le rail en porte huit ; sans un gabarit unique elles dériveraient les unes
 * des autres. Le titre est un vrai `<h2>` : le rail est long, et c'est ce qui
 * permet d'y naviguer au lecteur d'écran.
 */
export function RailSection({
  title,
  hint,
  trailing,
  children,
  id,
}: {
  title: string;
  hint?: string;
  /** Posé à droite du titre — une pastille d'état, un bouton discret. */
  trailing?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className="border-b border-line px-6 py-6 last:border-b-0"
    >
      <div className="flex items-start gap-3">
        <h2
          id={id}
          className="flex-1 font-display text-subsection font-medium text-ink"
        >
          {title}
        </h2>
        {trailing}
      </div>
      {hint ? (
        <p className="mt-1.5 text-helper leading-prose text-ink-2">{hint}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}
