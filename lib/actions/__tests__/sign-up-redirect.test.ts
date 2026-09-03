import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The full round trip a real invited clinician makes: she has no account,
 * so /invite/[token]'s "Create one" link sends her to
 * /signup?next=/invite/[token]. signIn already honors `next` (see
 * sign-in-redirect.test.ts); signUp did not — after confirming her email
 * she landed on /app with no memory of the invite she came from. This file
 * closes that gap the same way: `next` travels through the hidden form
 * field into signUp, then rides inside emailRedirectTo so it survives the
 * confirmation email, and is validated again by
 * app/auth/callback/route.ts on the way back in (see
 * auth-callback-next.test.ts) — never trusted twice from the same read.
 */

const signUpMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signUp: signUpMock } }),
}));

class RedirectSignal extends Error {
  constructor(readonly target: string) {
    super(`redirect:${target}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (target: string) => {
    throw new RedirectSignal(target);
  },
}));

const { signUp } = await import("@/lib/actions/auth");

async function signUpWith(next?: string | null): Promise<{
  redirectTarget: string;
  emailRedirectTo: string;
}> {
  const formData = new FormData();
  formData.set("email", "clinician@example.com");
  formData.set("password", "correct-horse-battery");
  if (next !== undefined && next !== null) formData.set("next", next);

  try {
    await signUp(null, formData);
  } catch (error) {
    if (error instanceof RedirectSignal) {
      const call = signUpMock.mock.calls[signUpMock.mock.calls.length - 1];
      return {
        redirectTarget: error.target,
        emailRedirectTo: call[0].options.emailRedirectTo,
      };
    }
    throw error;
  }
  throw new Error("signUp did not redirect although account creation succeeded");
}

beforeEach(() => {
  signUpMock.mockReset();
  signUpMock.mockResolvedValue({ error: null });
});

describe("signUp always redirects to check-your-email, regardless of next", () => {
  it("never redirects straight into the app — email confirmation always comes first", async () => {
    expect((await signUpWith("/invite/abc123")).redirectTarget).toBe(
      "/signup/check-your-email"
    );
    expect((await signUpWith()).redirectTarget).toBe("/signup/check-your-email");
  });
});

describe("an internal next survives inside emailRedirectTo", () => {
  it("embeds the invite link so the confirmation email returns there", async () => {
    const { emailRedirectTo } = await signUpWith("/invite/abc123");
    expect(emailRedirectTo).toBe(
      "http://localhost:3000/auth/callback?next=%2Finvite%2Fabc123"
    );
  });

  it("embeds any other internal destination the same way", async () => {
    const { emailRedirectTo } = await signUpWith("/app/checkout?plan=practice");
    expect(emailRedirectTo).toBe(
      "http://localhost:3000/auth/callback?next=%2Fapp%2Fcheckout%3Fplan%3Dpractice"
    );
  });
});

describe("no next, or an external one — plain callback URL, no open redirect", () => {
  it("omits the next param when none was given", async () => {
    const { emailRedirectTo } = await signUpWith();
    expect(emailRedirectTo).toBe("http://localhost:3000/auth/callback");
  });

  it("drops a hostile next rather than embedding it in the email link", async () => {
    for (const hostile of [
      "https://evil.example",
      "//evil.example",
      "javascript:alert(1)",
    ]) {
      const { emailRedirectTo } = await signUpWith(hostile);
      expect(emailRedirectTo).toBe("http://localhost:3000/auth/callback");
    }
  });

  it("still creates the account despite a hostile next", async () => {
    await signUpWith("https://evil.example");
    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: "clinician@example.com" })
    );
  });
});

describe("signup refused — no redirect, whatever next was", () => {
  it("returns the error instead of redirecting", async () => {
    signUpMock.mockResolvedValue({ error: { message: "already registered" } });

    const formData = new FormData();
    formData.set("email", "clinician@example.com");
    formData.set("password", "correct-horse-battery");
    formData.set("next", "/invite/abc123");

    await expect(signUp(null, formData)).resolves.toEqual({
      error: "We couldn't create the account: already registered",
    });
  });
});
