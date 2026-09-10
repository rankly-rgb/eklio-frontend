"use client";

import { useEffect, useRef } from "react";

/*
 * ── ONE PING, FROM A PAGE THAT MUST STAY STATIC ─────────────────────────
 *
 * The landing page and the pricing page are the first two steps of the
 * funnel and they are also the two pages a cold-email campaign hits hardest.
 * They are served static; measuring them from the server would make them
 * dynamic. So the page stays static and says one word to `POST /api/e`,
 * which is where the event actually becomes an event. See that file for why
 * this is not a tracker.
 *
 * ⚠ IT SENDS A WORD, NOT AN IDENTITY. No cookie is read or written, no id is
 * generated, nothing is stored in the browser, and the payload is one name
 * out of a list of two. Everything the server records about who sent it is
 * derived on the server from the connection.
 *
 * ⚠ ONCE PER MOUNT, ENFORCED WITH A REF. React runs effects twice in
 * development Strict Mode; without the ref every local page view would count
 * twice, and a number that is wrong by exactly 2× is the hardest kind to
 * notice.
 */

export function PageBeacon({ event }: { event: "landing_viewed" | "pricing_viewed" }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    const body = JSON.stringify({ e: event });

    /*
     * `sendBeacon` first: it survives the navigation away, which is exactly
     * the case that matters on a landing page. `keepalive` fetch is the
     * fallback for browsers without it. Both are fire-and-forget — a failed
     * beacon must never surface anything to the person reading the page.
     */
    try {
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/e", body);
        return;
      }
      void fetch("/api/e", { method: "POST", body, keepalive: true }).catch(
        () => {}
      );
    } catch {
      /* Measurement never breaks the page it measures. */
    }
  }, [event]);

  return null;
}
