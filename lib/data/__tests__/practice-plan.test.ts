import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { loadPracticeSeatsPlan } from "@/lib/data/practice-plan";

function fakeAdmin(response: unknown, error: unknown = null) {
  const from = vi.fn().mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: response, error }),
      }),
    }),
  });
  return { from } as unknown as SupabaseClient<Database>;
}

describe("loadPracticeSeatsPlan", () => {
  it("maps the row's snake_case fields to camelCase", async () => {
    const admin = fakeAdmin({
      label: "Practice",
      seat_floor: 3,
      seat_allowance: 10,
      price_per_seat_cents: 4900,
    });

    expect(await loadPracticeSeatsPlan(admin)).toEqual({
      label: "Practice",
      seatFloor: 3,
      seatAllowance: 10,
      pricePerSeatCents: 4900,
    });
  });

  it("returns null when the row is missing", async () => {
    expect(await loadPracticeSeatsPlan(fakeAdmin(null))).toBeNull();
  });

  it("returns null on a query error", async () => {
    expect(await loadPracticeSeatsPlan(fakeAdmin(null, { message: "boom" }))).toBeNull();
  });

  it("returns null when a seat field is unexpectedly NULL", async () => {
    const admin = fakeAdmin({
      label: "Practice",
      seat_floor: null,
      seat_allowance: 10,
      price_per_seat_cents: 4900,
    });
    expect(await loadPracticeSeatsPlan(admin)).toBeNull();
  });
});
