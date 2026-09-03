import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  acceptOrgInvite,
  createOrgInvite,
  previewOrgInvite,
  removeOrgMember,
} from "@/lib/tenancy/rpc";

/*
 * Même stub que `lib/site/__tests__/rpc.test.ts` : un `.rpc()` moqué, un
 * client castée pour porter le mock.
 */
function stub(response: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data: response, error });
  return { rpc, client: { rpc } as unknown as SupabaseClient<Database> };
}

function lastCall(rpc: ReturnType<typeof stub>["rpc"]) {
  return rpc.mock.calls[rpc.mock.calls.length - 1];
}

// Version/variant nibbles matter: zod's uuid() requires the 3rd group to
// start with 1-8 and the 4th to start with 8/9/a/b (found by actually
// running these tests against all-same-digit placeholders, which fail).
const ORG_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const MEMBER_ID = "33333333-3333-4333-8333-333333333333";

describe("createOrgInvite", () => {
  it("envoie p_org_id et p_email", async () => {
    const { rpc, client } = stub("raw-token-value");
    await createOrgInvite(client, { orgId: ORG_ID, email: "a@example.com" });

    expect(lastCall(rpc)).toEqual([
      "create_org_invite",
      { p_org_id: ORG_ID, p_email: "a@example.com" },
    ]);
  });

  it("ajoute p_project_id seulement s'il est fourni", async () => {
    const { rpc, client } = stub("raw-token-value");
    await createOrgInvite(client, {
      orgId: ORG_ID,
      email: "a@example.com",
      projectId: PROJECT_ID,
    });

    expect(lastCall(rpc)).toEqual([
      "create_org_invite",
      { p_org_id: ORG_ID, p_email: "a@example.com", p_project_id: PROJECT_ID },
    ]);
  });

  it("rend le jeton brut au succès", async () => {
    const { client } = stub("raw-token-value");
    const result = await createOrgInvite(client, {
      orgId: ORG_ID,
      email: "a@example.com",
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toBe("raw-token-value");
  });

  it("rejette une entrée mal formée avant même l'appel réseau", async () => {
    const { rpc, client } = stub("raw-token-value");
    await expect(
      createOrgInvite(client, { orgId: "not-a-uuid", email: "a@example.com" })
    ).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("remonte une PostgrestError telle quelle — pas d'enveloppe à déballer", async () => {
    const { client } = stub(null, {
      message: "create_org_invite: not an active owner",
      code: "P0001",
    });
    const result = await createOrgInvite(client, {
      orgId: ORG_ID,
      email: "a@example.com",
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.message).toBe(
      "create_org_invite: not an active owner"
    );
  });
});

describe("previewOrgInvite", () => {
  it("envoie p_token", async () => {
    const { rpc, client } = stub([]);
    await previewOrgInvite(client, { token: "tok" });

    expect(lastCall(rpc)).toEqual(["preview_org_invite", { p_token: "tok" }]);
  });

  it("une table vide est un succès avec data: null — pas une erreur", async () => {
    const { client } = stub([]);
    const result = await previewOrgInvite(client, { token: "bogus" });

    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toBeNull();
  });

  it("une ligne devient organizationName/invitedEmail", async () => {
    const { client } = stub([
      { organization_name: "Elm & Ember", invited_email: "clinician@example.com" },
    ]);
    const result = await previewOrgInvite(client, { token: "tok" });

    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toEqual({
      organizationName: "Elm & Ember",
      invitedEmail: "clinician@example.com",
    });
  });
});

describe("acceptOrgInvite", () => {
  it("envoie p_token et rend l'id d'organisation", async () => {
    const { rpc, client } = stub(ORG_ID);
    const result = await acceptOrgInvite(client, { token: "tok" });

    expect(lastCall(rpc)).toEqual(["accept_org_invite", { p_token: "tok" }]);
    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toBe(ORG_ID);
  });

  it("remonte le refus (email qui ne correspond pas, jeton déjà utilisé…) tel quel", async () => {
    const { client } = stub(null, {
      message: "accept_org_invite: signed-in email does not match the invited email",
    });
    const result = await acceptOrgInvite(client, { token: "tok" });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.message).toContain("does not match");
  });
});

describe("removeOrgMember", () => {
  it("envoie p_member_id et rend data: null au succès", async () => {
    const { rpc, client } = stub(null);
    const result = await removeOrgMember(client, { memberId: MEMBER_ID });

    expect(lastCall(rpc)).toEqual([
      "remove_org_member",
      { p_member_id: MEMBER_ID },
    ]);
    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toBeNull();
  });

  it("refuse de retirer un owner — le message vient tel quel de la base", async () => {
    const { client } = stub(null, {
      message: "remove_org_member: cannot remove an owner",
    });
    const result = await removeOrgMember(client, { memberId: MEMBER_ID });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.message).toBe(
      "remove_org_member: cannot remove an owner"
    );
  });
});
