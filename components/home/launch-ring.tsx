"use client";

import { MonoLabel } from "@/components/ui/mono-label";
import { useLaunchState } from "@/components/home/launch-state";

const RADIUS = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/*
 * The rail's head: a thin ring, `4 of 7`, `YOUR FIRST WEEK`, and the
 * percentage.
 *
 * Both numbers come from `get_launch_progress` — the same RPC and the same
 * seven rows `/app/launch` walks. The percentage is that fraction and nothing
 * else: it is a count of resolved steps over a total, not a score of anything.
 *
 * ⚠ IT READS THE SHARED STATE, NOT A SERVER PROP. Before this it took
 * `progress` as a prop off the server render, so a tick in the rail below moved
 * the rows and left the ring behind until a refresh landed. It now moves on the
 * same optimistic update as everything else on this screen.
 */
export function LaunchRing() {
  const { resolved, total } = useLaunchState();
  const fraction = total > 0 ? resolved / total : 0;

  return (
    <div className="flex items-center gap-3">
      <svg
        width="46"
        height="46"
        viewBox="0 0 46 46"
        role="img"
        aria-label={`${resolved} of ${total} steps done`}
        className="flex-none -rotate-90"
      >
        <circle cx="23" cy="23" r={RADIUS} fill="none" stroke="var(--line)" strokeWidth="3" />
        <circle
          cx="23"
          cy="23"
          r={RADIUS}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
        />
      </svg>

      <div aria-hidden="true" className="flex min-w-0 flex-col gap-0.5">
        <span className="font-display text-card-title font-medium leading-tight tracking-h1 text-ink">
          {`${resolved} of ${total}`}
        </span>
        <MonoLabel tracking="16" tone="ink-3">
          Your first week
        </MonoLabel>
      </div>

      <span
        aria-hidden="true"
        className="ml-auto flex-none rounded-pill bg-card px-2.5 py-1"
      >
        <MonoLabel tracking="10" tone="ink-2">
          {`${Math.round(fraction * 100)}%`}
        </MonoLabel>
      </span>
    </div>
  );
}
