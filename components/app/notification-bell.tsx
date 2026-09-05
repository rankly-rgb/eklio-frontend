"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Notification } from "@/lib/data/notifications";
import { notificationLine } from "@/lib/data/notifications";

/*
 * The bell. Syncs on mount (arms/advances sync_notifications' own
 * baseline), shows an unread dot, opens a list built from the same rows,
 * marks read on open.
 */
export function NotificationBell({ brandKitId }: { brandKitId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ brandKitId }),
    })
      .then((response) => response.json())
      .then((data: { notifications?: Notification[] }) => {
        if (!cancelled) setNotifications(data.notifications ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [brandKitId]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleOpen = useCallback(() => {
    setOpen((value) => {
      const next = !value;
      if (next && notifications.length > 0) {
        fetch("/api/notifications/read", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ brandKitId }),
        }).catch(() => {});
        setNotifications([]);
      }
      return next;
    });
  }, [brandKitId, notifications.length]);

  const unread = notifications.length > 0;

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${notifications.length} unread` : "Notifications"}
        onClick={handleOpen}
        className="relative flex size-8 items-center justify-center rounded-pill hover:bg-card"
      >
        <BellGlyph />
        {unread ? (
          <span
            aria-hidden="true"
            className="absolute right-1.5 top-1.5 size-1.5 rounded-pill bg-accent"
          />
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="route-enter absolute right-0 top-11 z-40 w-[300px] rounded-card border border-line bg-bg p-2"
        >
          {notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-ui text-ink-3">Nothing new.</p>
          ) : (
            notifications.map((notification) => (
              <p key={notification.id} className="px-3 py-2 text-ui text-ink-2">
                {notificationLine(notification)}
              </p>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Hand-drawn, matching `components/ui/glyphs.tsx`'s bordered-div convention. */
function BellGlyph() {
  return (
    <span aria-hidden="true" className="relative block" style={{ width: 14, height: 14 }}>
      <span
        style={{
          position: "absolute",
          top: 0,
          left: 1,
          width: 12,
          height: 10,
          border: "1.5px solid var(--ink-2)",
          borderBottom: "none",
          borderRadius: "7px 7px 0 0",
        }}
      />
      <span
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: 14,
          height: 1.5,
          background: "var(--ink-2)",
          borderRadius: 1,
        }}
      />
    </span>
  );
}
