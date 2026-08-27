/*
 * Squelette — jamais un spinner plein écran (§2). Chaque squelette épouse le
 * gabarit qu'il remplace : on lui donne ses dimensions, il ne les invente pas.
 */
export function Skeleton({
  className = "",
  radius = "var(--radius-preview)",
  style,
}: {
  className?: string;
  radius?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-card ${className}`}
      style={{ borderRadius: radius, ...style }}
    />
  );
}
