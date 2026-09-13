"use client";

import type { ReactNode } from "react";
import { LaunchRing } from "@/components/home/launch-ring";
import { RailChecklist } from "@/components/home/rail";
import { useLaunchState } from "@/components/home/launch-state";

/*
 * The top of the rail, and the one place that decides which of its two faces
 * shows.
 *
 * ⚠ THE SWAP IS CLIENT-SIDE NOW, WHICH IS THE POINT. It used to be decided on
 * the server from `home.checklist`, so ticking the seventh box left the ring
 * sitting at 7 of 7 until a full render replaced it. The completion line now
 * fires from the toggle itself.
 *
 * `completion` arrives as children rather than being built here: it carries
 * the Monthly Presence card, which is a server component with its own reads.
 * Passing it through keeps that server-rendered while this stays a client
 * component.
 */
export function LaunchRail({ completion }: { completion: ReactNode }) {
  const { resolved, total } = useLaunchState();

  if (total === 0) return null;
  if (resolved === total) return <>{completion}</>;

  return (
    <>
      <LaunchRing />
      <RailChecklist />
    </>
  );
}
