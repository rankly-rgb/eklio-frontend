import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { loadOwnedOrganization } from "@/lib/data/organization";

function fakeClient(response: unknown, error: unknown = null) {
  const from = vi.fn().mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: response, error }),
      }),
    }),
  });
  return { from } as unknown as SupabaseClient<Database>;
}

describe("loadOwnedOrganization", () => {
  it("maps the row's snake_case fields to camelCase", async () => {
    const client = fakeClient({
      id: "org-1",
      name: "My Practice",
      default_supervisor_name: "Dr. Smith",
    });
    const org = await loadOwnedOrganization(client, "user-1");
    expect(org).toEqual({
      id: "org-1",
      name: "My Practice",
      defaultSupervisorName: "Dr. Smith",
    });
  });

  it("returns null when the user owns no organization", async () => {
    const client = fakeClient(null);
    expect(await loadOwnedOrganization(client, "user-1")).toBeNull();
  });

  it("returns null on a query error rather than throwing", async () => {
    const client = fakeClient(null, { message: "boom" });
    expect(await loadOwnedOrganization(client, "user-1")).toBeNull();
  });
});
