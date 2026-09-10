import type { ContentModel } from "./model";

/*
 * ── THE CEILING IS CHECKED BEFORE THE CALL, NEVER AFTER ─────────────────
 *
 * A ceiling read after the fact is not a ceiling; it is a receipt. By the time
 * an over-budget run is noticed, the money is spent — and this product has no
 * post-purchase refund primitive anywhere, which is the same reason the image
 * allowance reserves before it draws.
 *
 * Calls rather than tokens, deliberately. Token spend is only known once a
 * response comes back, so a token ceiling can only ever be checked afterwards.
 * A call ceiling is knowable in advance, which is the property that matters:
 * the run stops at the boundary instead of reporting that it crossed one.
 *
 * ⚠ IT WRAPS THE SEAM RATHER THAN LIVING INSIDE IT. `ContentModel` is four
 * methods and every model call in a month goes through them, so wrapping it is
 * exhaustive by construction — a fifth method added later cannot slip past,
 * because it would not typecheck here until it is counted too.
 */

export class CeilingReachedError extends Error {
  constructor(
    readonly limit: number,
    readonly attempted: string
  ) {
    super(
      `Ceiling reached: ${limit} model calls already made, and "${attempted}" would be ` +
        `one more. Nothing further was called and nothing further was spent.`
    );
    this.name = "CeilingReachedError";
  }
}

export type CallLedger = {
  /** Every call made, in order, by kind. */
  readonly calls: string[];
  readonly limit: number;
  remaining(): number;
};

/**
 * The same model, with a hard stop in front of it.
 *
 * The label is carried through unchanged: what wrote the month is the wrapped
 * model, and a wrapper that renamed it would break the one thing that tells a
 * stubbed month from a real one.
 */
export function withCallCeiling(
  model: ContentModel,
  limit: number
): { model: ContentModel; ledger: CallLedger } {
  const calls: string[] = [];

  function admit(kind: string): void {
    if (calls.length >= limit) throw new CeilingReachedError(limit, kind);
    calls.push(kind);
  }

  const ledger: CallLedger = {
    calls,
    limit,
    remaining: () => Math.max(0, limit - calls.length),
  };

  /*
   * ⚠ EVERY WRAPPER IS `async`, and that is not a formality. A method typed as
   * returning a promise but throwing SYNCHRONOUSLY escapes `.catch()` at any
   * call site that does not also wrap the call itself in a try — the refusal
   * would surface as an uncaught exception rather than a rejected promise.
   * `async` makes the ceiling reject, which is what its shape already promises.
   */
  return {
    ledger,
    model: {
      label: model.label,
      async writeThemes(request) {
        admit(`themes:${request.sessionsTheme ? "check_in" : "brief"}`);
        return model.writeThemes(request);
      },
      async writeOnImageLine(request) {
        admit(`on_image_line:${request.register}`);
        return model.writeOnImageLine(request);
      },
      async writeCaption(request) {
        admit(`caption:${request.register}`);
        return model.writeCaption(request);
      },
      async writeAltText(request) {
        admit(`alt_text:${request.archetype}`);
        return model.writeAltText(request);
      },
      async rewrite(request) {
        admit("ethics_rewrite");
        return model.rewrite(request);
      },
    },
  };
}
