import { after } from "next/server";
import { headers, cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";
import { ANON_COOKIE, ipBucket } from "@/lib/anon/token";

/*
 * ── WHERE THE EVENTS ACTUALLY GO ────────────────────────────────────────
 *
 * `track()` has always been right about everything except this. It is
 * server-side, first-party, single-writer, no vendor, no cookie, no consent
 * banner — and then it wrote a log line. On Vercel, function logs live hours
 * to days without a Log Drain, so a week after the cold emails land the
 * evidence is gone.
 *
 * This is the sink. `public.funnel_events` (eklio-backend,
 * 20260910212308_funnel_events.sql) is the table; `record_funnel_events` is
 * the only way in. The console line stays: it is free, it is what you read
 * while developing, and it is the fallback when a write fails.
 *
 * ── IT NEVER BLOCKS A RESPONSE, AND IT NEVER THROWS ─────────────────────
 *
 * The write happens in `after()`, so the practitioner's request is already
 * finished. If the write fails, one log line says so and nothing else
 * changes: measurement must never be able to break the thing it measures.
 *
 * ── ONE `after()` PER EVENT, NOT ONE BUFFER ─────────────────────────────
 *
 * ⚠ A MODULE-LEVEL BUFFER WOULD BE A CORRECTNESS BUG, NOT AN OPTIMISATION.
 * One warm serverless instance serves many requests; a shared array drained
 * on a timer would stamp every event in it with whichever request happened to
 * flush, so one visitor's IP hash would end up on a stranger's event. Each
 * `after()` callback runs inside its OWN request, which is exactly why
 * `headers()` can be read in there and be right.
 */

/** Values that may appear in an event payload. Never a sentence. */
export type SinkProperties = Record<string, string | number | boolean | null>;

/*
 * Keys the table has real columns for. A call site that already passes one of
 * these in its properties gets it lifted into its column — nobody has to
 * rewrite thirty-nine call sites to make the funnel joinable, and the value
 * stays in `props` too so the log line is unchanged.
 */
const PROJECT_KEYS = ["projectId", "project_id", "brief_id"] as const;
const KIT_KEYS = ["brandKitId", "brand_kit_id"] as const;
const USER_KEYS = ["userId", "user_id"] as const;

function firstUuid(props: SinkProperties, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = props[key];
    if (typeof value === "string" && UUID.test(value)) return value;
  }
  return null;
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ⚠ THE LAST GATE BEFORE A SENTENCE REACHES THE DATABASE.
 *
 * The column has a CHECK (`funnel_props_are_safe`) and it is the real
 * defence; this exists so that a payload which would violate it is trimmed
 * here rather than losing the whole event to a constraint error. Anything
 * longer than 64 characters is dropped and replaced by a marker naming the
 * key — the fact that something was too long is worth knowing; its content
 * never is.
 */
export function safeProps(props: SinkProperties): SinkProperties {
  const out: SinkProperties = {};
  let dropped = 0;
  for (const [key, value] of Object.entries(props)) {
    if (Object.keys(out).length >= 11) {
      dropped += 1;
      continue;
    }
    if (key.length > 40) {
      dropped += 1;
      continue;
    }
    if (typeof value === "string" && value.length > 64) {
      dropped += 1;
      continue;
    }
    out[key] = value;
  }
  if (dropped > 0) out.dropped_props = dropped;
  return out;
}

type FunnelRow = {
  event: string;
  occurred_at: string;
  visitor_day: string | null;
  project_id: string | null;
  brand_kit_id: string | null;
  user_id: string | null;
  anonymous: boolean;
  props: SinkProperties;
};

/**
 * What the request knows about who is asking, read at CALL time.
 *
 * ⚠ NOT INSIDE `after()`, AND THE DOCS ARE EXPLICIT ABOUT WHY. From
 * `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`:
 * a Route Handler or Server Function may call `cookies()` and `headers()`
 * inside the callback, but a SERVER COMPONENT may not — "calling `cookies()`
 * or `headers()` inside the `after` callback in a Server Component will throw
 * a runtime error", because Next has to know at render time which part of the
 * tree touched request data.
 *
 * `track("checkout_opened", …)` is called from `app/app/checkout/page.tsx`,
 * which is exactly that case. Read inside `after()`, it would have thrown,
 * been swallowed by the catch below, and left step 10 of the funnel reading
 * zero forever — a measurement bug that looks like a product finding.
 *
 * So the promise is created HERE, in the caller's own scope, and awaited in
 * the callback. That is the shape the docs prescribe: read it beforehand,
 * pass the value in.
 */
type RequestContext = { ip: string | null; anonymous: boolean };

async function readRequestContext(): Promise<RequestContext | null> {
  try {
    const requestHeaders = await headers();
    const forwarded = requestHeaders.get("x-forwarded-for");
    const jar = await cookies();
    return {
      ip: forwarded
        ? forwarded.split(",")[0]!.trim()
        : requestHeaders.get("x-real-ip"),
      anonymous: Boolean(jar.get(ANON_COOKIE)?.value),
    };
  } catch {
    // Outside a request, or a surface that may not read request data. The
    // event still gets written; it simply has no visitor attached to it.
    return null;
  }
}

/**
 * Schedule one event for the store. Returns immediately, always.
 *
 * Outside a request — a unit test, a script, a module loaded at build time —
 * `after()` throws, and that is the correct place to stop: there is no
 * visitor to attribute the event to.
 */
export function record(event: string, properties: SinkProperties): void {
  const occurredAt = new Date().toISOString();

  let context: Promise<RequestContext | null>;
  try {
    context = readRequestContext();
  } catch {
    return;
  }

  try {
    after(async () => {
      await write(event, properties, occurredAt, await context);
    });
  } catch {
    /*
     * No request scope. Not an error and not worth a log line — the console
     * line in `track()` has already happened, and that is what a test or a
     * script is reading anyway. `readRequestContext` never rejects, so the
     * abandoned promise cannot become an unhandled rejection.
     */
  }
}

async function write(
  event: string,
  properties: SinkProperties,
  occurredAt: string,
  context: RequestContext | null
): Promise<void> {
  try {
    const props = safeProps(properties);

    /*
     * The visitor key is the SAME daily-salted IP hash the spend ceilings
     * use. No cookie was added for this, nothing follows anyone across a site
     * boundary, and the value is meaningless tomorrow. It is what joins
     * "landed" to "started the brief"; from there `project_id` takes over.
     *
     * ⚠ NULL WHEN THERE IS NO ADDRESS, not a shared "unknown" bucket.
     * `ipBucket` folds a missing IP into one hash; every such request would
     * then look like ONE returning visitor, and `count(distinct visitor_day)`
     * would quietly under-count by however many of them there were.
     */
    const row: FunnelRow = {
      event,
      occurred_at: occurredAt,
      visitor_day: context?.ip ? ipBucket(context.ip) : null,
      project_id: firstUuid(props, PROJECT_KEYS),
      brand_kit_id: firstUuid(props, KIT_KEYS),
      user_id: firstUuid(props, USER_KEYS),
      anonymous: props.anonymous === true || context?.anonymous === true,
      props,
    };

    const { error } = await createAdminClient().rpc("record_funnel_events", {
      p_events: [row] as never,
    });
    if (error) console.error(`[analytics] sink: ${error.message}`);
  } catch (error) {
    // Measurement must never be able to break the thing it measures.
    console.error("[analytics] sink", error);
  }
}
