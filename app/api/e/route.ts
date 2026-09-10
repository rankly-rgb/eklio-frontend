import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { track } from "@/lib/analytics";
import { rateLimit } from "@/lib/api/rate-limit";
import { clientIp, ipBucket } from "@/lib/anon/token";

/*
 * POST /api/e — the only place in this product where an event starts in the
 * browser, and it exists for exactly one reason.
 *
 * ── WHY IT HAD TO EXIST ─────────────────────────────────────────────────
 *
 * The funnel needs both ends. Its first two steps are "landed on the site"
 * and "looked at pricing", and both of those pages are STATIC (`○` in the
 * build output). Emitting from the server component would make them dynamic,
 * which means rendering the landing page of a cold-email campaign on every
 * hit instead of serving it from the edge — paying for measurement with the
 * thing being measured.
 *
 * The alternative considered and rejected: emit from the proxy. It runs on
 * every request including ones that render nothing, and it would put a
 * database write on the latency path of the page people are arriving at.
 *
 * ── WHAT THIS IS NOT ────────────────────────────────────────────────────
 *
 * Not a tracker. It is same-origin, sets no cookie, reads no cookie, and
 * carries no identifier at all: the body is one word out of a closed list of
 * two. Everything the row knows about who sent it — the daily-salted IP hash
 * — is derived HERE, on the server, from the connection, exactly as the spend
 * ceilings derive it. A caller cannot claim to be anyone.
 *
 * ── WHY THE VOCABULARY IS CLOSED ────────────────────────────────────────
 *
 * ⚠ THIS IS AN UNAUTHENTICATED WRITE PATH INTO A TABLE. Two event names are
 * accepted and nothing else — no properties, no ids, no free text, no way to
 * name an event of your own. The worst a script can do with it is inflate two
 * counters that are already labelled an estimate, at a rate the limiter
 * bounds. Anything wider than this would need a different design.
 */

/** The closed list. Two names, and adding a third is a deliberate act. */
const PUBLIC_EVENTS = ["landing_viewed", "pricing_viewed"] as const;
type PublicEvent = (typeof PUBLIC_EVENTS)[number];

function isPublicEvent(value: unknown): value is PublicEvent {
  return (
    typeof value === "string" &&
    (PUBLIC_EVENTS as readonly string[]).includes(value)
  );
}

/*
 * Generous, because a real person reloading a landing page is normal and
 * losing their event costs more than a duplicate does. It is here to stop a
 * loop, not to ration a visitor.
 */
const BEACON_LIMIT = { limit: 60, windowMs: 60 * 60 * 1000 };

export async function POST(request: NextRequest) {
  /*
   * `sendBeacon` posts as text/plain; a JSON content type would make this a
   * preflighted cross-origin request and the browser would drop it on unload.
   * So the body is parsed leniently and its SHAPE is what is trusted, never
   * its content.
   */
  let event: unknown = null;
  try {
    const body = await request.text();
    event = body.length <= 200 ? (JSON.parse(body) as { e?: unknown }).e : null;
  } catch {
    event = null;
  }

  if (!isPublicEvent(event)) {
    // No detail. A closed list that explains itself is a list being explored.
    return new NextResponse(null, { status: 204 });
  }

  const verdict = rateLimit(
    `beacon:${ipBucket(clientIp(request))}`,
    BEACON_LIMIT
  );
  if (!verdict.allowed) return new NextResponse(null, { status: 204 });

  track(event);

  /*
   * 204 whatever happened, including when nothing was recorded. The browser
   * is not owed an answer about our measurement, and a body would only invite
   * someone to write a client that reads it.
   */
  return new NextResponse(null, { status: 204 });
}
