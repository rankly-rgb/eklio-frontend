import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { isPracticeUiEnabled } from "@/lib/tenancy/flags";

function fakeAdmin(response: unknown, error: unknown = null) {
  const from = () => ({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data: response, error }),
      }),
    }),
  });
  return { from } as unknown as SupabaseClient<Database>;
}

describe("isPracticeUiEnabled", () => {
  it("returns true when the flag row's value is the boolean true", async () => {
    const admin = fakeAdmin({ value: true });
    expect(await isPracticeUiEnabled(admin)).toBe(true);
  });

  it("returns false when the flag row's value is false", async () => {
    const admin = fakeAdmin({ value: false });
    expect(await isPracticeUiEnabled(admin)).toBe(false);
  });

  it("fails closed on a query error", async () => {
    const admin = fakeAdmin(null, { message: "permission denied" });
    expect(await isPracticeUiEnabled(admin)).toBe(false);
  });

  it("fails closed when the row is missing", async () => {
    const admin = fakeAdmin(null);
    expect(await isPracticeUiEnabled(admin)).toBe(false);
  });
});
