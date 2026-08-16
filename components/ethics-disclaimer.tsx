/**
 * Shown under every generated deliverable: the brand kit, Monthly Presence
 * output, and the Terms.
 *
 * The wording is deliberately conservative. We claim the copy is *built to
 * respect* ACA/APA advertising principles — never that it is "guaranteed
 * compliant". Final responsibility sits with the practitioner and their board,
 * and saying so plainly is both honest and the safer legal position.
 */

export const ETHICS_DISCLAIMER_TEXT = {
  heading: "Before you publish",
  body: [
    "Everything Eklio generates is a suggestion for you to review and adapt in your own voice. You know your practice, your clients, and your board; we do not.",
    "This copy is built to respect ACA and APA advertising principles — psychoeducation over promises, no client testimonials, credentials stated exactly. It is not a compliance certification.",
    "Eklio is not legal, clinical, or licensing-board advice. Final responsibility for meeting your state board's advertising rules rests with you.",
  ],
} as const;

export function EthicsDisclaimer({
  className = "",
}: {
  className?: string;
}) {
  return (
    <aside
      className={`rounded-lg border border-noir/15 bg-cream-light p-5 ${className}`}
    >
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-gris-fonce">
        {ETHICS_DISCLAIMER_TEXT.heading}
      </p>
      <div className="mt-3 flex flex-col gap-2 text-sm text-gris-fonce">
        {ETHICS_DISCLAIMER_TEXT.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </aside>
  );
}
