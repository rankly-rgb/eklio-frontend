import { MonoLabel } from "@/components/ui/mono-label";

/*
 * Jauge en 7 segments — grille de 7 colonnes, écart 8px au bureau / 6px en
 * mobile, segments de 3px, rayon plein (§2).
 *
 * Étapes franchies en argile ; l'étape courante est une piste `--line` portant
 * un div argile à son pourcentage d'avancement ; les suivantes restent nues.
 */
export function Progress7({
  step,
  fraction = 0.5,
  dense = false,
  className = "",
}: {
  /** Étape courante, de 1 à 7. */
  step: number;
  /** Avancement DANS l'étape courante, de 0 à 1. */
  fraction?: number;
  /** Écart de 6px au lieu de 8px — gabarit mobile. */
  dense?: boolean;
  className?: string;
}) {
  const current = Math.min(7, Math.max(1, Math.round(step)));
  const clamped = Math.min(1, Math.max(0, fraction));

  return (
    <div
      className={`grid grid-cols-7 ${dense ? "gap-1.5" : "gap-2"} ${className}`}
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={7}
      aria-valuenow={current}
      aria-label={`Step ${current} of 7`}
    >
      {Array.from({ length: 7 }, (_, index) => {
        const position = index + 1;
        if (position < current) {
          return (
            <div key={position} className="h-[3px] rounded-pill bg-accent" />
          );
        }
        if (position === current) {
          return (
            <div
              key={position}
              className="h-[3px] overflow-hidden rounded-pill bg-line"
            >
              <div
                className="h-[3px] bg-accent transition-[width] duration-[var(--dur-question)]"
                style={{ width: `${clamped * 100}%` }}
              />
            </div>
          );
        }
        return <div key={position} className="h-[3px] rounded-pill bg-line" />;
      })}
    </div>
  );
}

/**
 * Compteur d'étape mono. Aligné à droite au-dessus de la jauge au bureau
 * (Écrans 1 et 2), aligné à gauche EN DESSOUS en mobile (Écran 8).
 */
export function StepCounter({ step }: { step: number }) {
  return <MonoLabel tracking="16">{`Step ${step} of 7`}</MonoLabel>;
}
