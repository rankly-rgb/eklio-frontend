/*
 * ── WHAT SHE READS WHEN SIGNING UP FAILS ────────────────────────────────
 *
 * Measured on the acquisition walk, on a phone: after sixty seconds of "One
 * moment…", a therapist was shown
 *
 *   We couldn't create the account: Unexpected token 'H', "Host not i"... is
 *   not valid JSON
 *
 * because `lib/actions/auth.ts` interpolated the upstream `error.message`
 * straight into the sentence. The upstream cause that day was a sandbox proxy;
 * a rate limit, an outage or anything returning HTML would read the same.
 *
 * One sentence per case, each ending in something she can do. The machine
 * detail is what an engineer needs, so it goes to the server log instead —
 * useful there, and never in front of her.
 *
 * ⚠ ITS OWN MODULE, NOT `lib/actions/auth.ts`. That file is `"use server"`,
 * where every export must be an async function; a pure mapping cannot live
 * there. `tsc` and the suite both accepted it — `next build` is what refused
 * it, which is the third time this repo has been reminded that the three
 * checks catch different things.
 */
export function signUpMessage(code: string | undefined): string {
  switch (code) {
    case "user_already_exists":
    case "email_exists":
      return "There's already an account with that email. Sign in instead, or reset your password.";
    case "weak_password":
      return "That password is too easy to guess. Use at least 8 characters, and something you don't use elsewhere.";
    case "email_address_invalid":
    case "validation_failed":
      return "That email address doesn't look right. Check it and try again.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "That's a few too many tries in a row. Wait a minute and try again.";
    case "signup_disabled":
      return "New accounts are paused right now. Email us and we'll sort it out.";
    default:
      /*
       * The catch-all, and the one that matters: it must never carry a code, a
       * stack, or a parser error. It says the truth — this is our side — and
       * it says the next thing to do.
       */
      return "Something went wrong on our side, not yours. Try again in a moment.";
  }
}
