import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type Client = SupabaseClient<Database>;

export type PracticeSeatsPlan = {
  label: string;
  seatFloor: number;
  seatAllowance: number;
  pricePerSeatCents: number;
};

/**
 * The practice_seats plans row (lot H) — read with the admin client since
 * plans' SELECT policy is `to authenticated` only, and lot I's landing
 * page is public/unauthenticated. Same pattern as
 * lib/tenancy/flags.ts's isPracticeUiEnabled(): a narrow, server-only,
 * service-role read of a table the calling page has no session for.
 */
export async function loadPracticeSeatsPlan(admin: Client): Promise<PracticeSeatsPlan | null> {
  const { data, error } = await admin
    .from("plans")
    .select("label, seat_floor, seat_allowance, price_per_seat_cents")
    .eq("tier", "practice_seats")
    .maybeSingle();

  if (
    error ||
    !data ||
    data.seat_floor === null ||
    data.seat_allowance === null ||
    data.price_per_seat_cents === null
  ) {
    return null;
  }

  return {
    label: data.label,
    seatFloor: data.seat_floor,
    seatAllowance: data.seat_allowance,
    pricePerSeatCents: data.price_per_seat_cents,
  };
}
