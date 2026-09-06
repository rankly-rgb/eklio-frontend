import { NextResponse } from "next/server";
import type { ContentResult } from "@/lib/data/content";

/*
 * The one place a content refusal becomes an HTTP status.
 *
 * `not_found` is 404 and never 403, because a 403 confirms that someone
 * else's item exists. `payment_required` is 402 rather than a silent empty
 * list: a refusal that renders as "nothing here" reads like a bug, and this
 * one is an offer.
 */
export function contentResponse<T>(result: ContentResult<T>): NextResponse {
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }
  return NextResponse.json(result.data);
}
