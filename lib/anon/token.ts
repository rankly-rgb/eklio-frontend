import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/*
 * ── THE ANONYMOUS SESSION, IN ONE COOKIE ────────────────────────────────
 *
 * A brief belongs either to a user or to a token. The token is 32 bytes of
 * CSPRNG randomness, base64url, and the database stores only its SHA-256 — so
 * a stolen dump hands nobody a working session, and no policy ever handles the
 * plaintext.
 *
 * ── WHY IT IS ALSO SIGNED, AND WHY THE SIGNATURE IS ADVISORY ────────────
 *
 * 256 random bits are already unguessable; a signature adds nothing to the
 * secrecy. What it adds is REFUSAL WITHOUT A DATABASE ROUND TRIP: this cookie
 * sits in front of the anonymous generation path, and an attacker spamming
 * random tokens would otherwise cost one indexed lookup per request. With an
 * HMAC the server rejects them in microseconds.
 *
 * ⚠ AND IT IS ADVISORY ON PURPOSE. If `ANON_TOKEN_SECRET` is absent — a
 * preview deploy, a local run, a variable someone forgot — verification is
 * SKIPPED and the token still works. The alternative is worse in both
 * directions: as a hard startup requirement it would take the landing page
 * down (see ACQUISITION_WALK.md §4.5), and as a hard verification it would
 * invalidate every outstanding cookie the moment the secret rotated, losing
 * every brief in flight. The database is the authority either way; the
 * signature is a cheap doorman, not the lock.
 */

export const ANON_COOKIE = "eklio_brief";

/**
 * Thirty days, matching `projects.anon_expires_at` and the purge window.
 *
 * The cookie is the ONLY way back to an unclaimed brief, so it must not
 * outlive the row — and the row must not outlive it by much either, or the
 * table fills with things nobody can reach. Same number in both places.
 */
export const ANON_TOKEN_DAYS = 30;

const SECRET_ENV = "ANON_TOKEN_SECRET";

export function anonCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ANON_TOKEN_DAYS * 24 * 60 * 60,
  };
}

/** The hash the database stores. Never the token. */
export function hashAnonToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function sign(random: string, secret: string): string {
  return createHmac("sha256", secret).update(random).digest("base64url").slice(0, 22);
}

/**
 * A fresh token: 32 random bytes, plus a short HMAC when a secret is set.
 *
 * The random half alone is what makes it unguessable; the suffix is only there
 * so a forged one can be thrown away before it costs a query.
 */
export function mintAnonToken(): string {
  const random = randomBytes(32).toString("base64url");
  const secret = process.env[SECRET_ENV];
  return secret ? `${random}.${sign(random, secret)}` : random;
}

/**
 * Whether a token is one we plausibly issued.
 *
 * ⚠ `true` WHEN NO SECRET IS CONFIGURED, and that is the design: the database
 * still refuses anything that does not match a stored hash. Returning false
 * here without a secret would lock every visitor out of their own brief
 * because of a missing environment variable.
 */
export function isPlausibleAnonToken(
  token: string | undefined | null
): token is string {
  if (!token) return false;

  // Mirrors `public.anon_token_hash()`'s own bound, so the two agree about
  // what is worth hashing.
  if (token.length < 20 || token.length > 200) return false;

  const secret = process.env[SECRET_ENV];
  const [random, signature] = token.split(".");

  if (!secret) return true;
  if (!signature) {
    /*
     * Issued before a secret existed, or by a deploy that had none. Accepted:
     * the row it points at is hers, and refusing it would delete a brief from
     * her point of view. New tokens get signed from now on.
     */
    return true;
  }

  const expected = Buffer.from(sign(random, secret));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** When an anonymous brief minted now should stop existing. */
export function anonExpiryFrom(now: Date = new Date()): string {
  return new Date(
    now.getTime() + ANON_TOKEN_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
}

/*
 * ── COUNTING A VISITOR WITHOUT KEEPING THEIR ADDRESS ────────────────────
 *
 * The per-IP cap needs to recognise a repeat visitor within a day and must not
 * be able to recognise them the day after. A raw IP is personal data, and this
 * audience is reached from France.
 *
 * The date is the salt. Tomorrow the same address produces a different bucket,
 * which is exactly the retention the cap needs and no more.
 */
export function ipBucket(ip: string | null, now: Date = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  /*
   * A missing address shares one bucket rather than getting a free pass. It is
   * the more restrictive reading, and an unattributable request is exactly the
   * kind the cap exists for.
   */
  return createHash("sha256")
    .update(`${day}:${ip ?? "unknown"}`)
    .digest("hex")
    .slice(0, 32);
}

/** The client address, as the platform reports it behind a proxy. */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip");
}
