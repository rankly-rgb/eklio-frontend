"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signedInRedirectPath } from "@/lib/auth/next-url";
import { siteUrl } from "@/lib/site-url";
import { signUpMessage } from "@/lib/auth/signup-message";
import { track } from "@/lib/analytics";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";
import { claimAnonBrief } from "@/lib/anon/claim";
import { ANON_COOKIE } from "@/lib/anon/token";
import { currentAnonToken } from "@/lib/anon/session";

export type AuthFormState = { error: string } | null;

export async function signIn(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        error:
          "Your email address isn't confirmed yet. Click the link we sent you, or sign up again to get a new one.",
      };
    }
    return { error: "That email and password don't match. Try again." };
  }

  /*
   * Retour à la page demandée AVANT la connexion, pas au tableau de bord.
   *
   * Le proxy pose `?next=` quand il intercepte une page protégée ; jusqu'ici
   * personne ne le consommait, et tout le monde atterrissait sur `/app`. Ça se
   * voyait surtout sur le tunnel de paiement : un praticien parti de `/pricing`
   * pour acheter se retrouvait sur son tableau de bord, sans rien qui lui dise
   * où était passé son achat. Une intention perdue au moment précis où elle
   * était la plus forte.
   *
   * `next` vient de l'URL, donc d'où on veut : `signedInRedirectPath` refuse
   * tout ce qui n'est pas un chemin interne (cf. `lib/auth/next-url.ts`). Un
   * `next` refusé ne fait jamais échouer la connexion — il est simplement
   * ignoré au profit du tableau de bord.
   */
  redirect(signedInRedirectPath(String(formData.get("next") ?? "")));
}

export async function signUp(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  /*
   * ⚠ THE ATTEMPT, NOT THE FORM. `/signup` is a static page, so there is no
   * server render to measure "she opened it" without making that page dynamic
   * — and the number that matters is how many people got as far as pressing
   * the button, which is exactly this. Emitted before the password check, so
   * a bounced attempt still counts as an attempt: a signup step that only
   * counted successes could never show a password rule turning people away.
   */
  track("signup_started");

  if (password.length < 8) {
    return { error: "Use a password of at least 8 characters." };
  }

  /*
   * ⚠ READ BEFORE SIGNING UP. `signUp` may issue a session, which changes what
   * `resolveBriefCaller` reports — and by then it would report the new user
   * and forget the cookie entirely. The brief she is looking at is identified
   * now, while nothing has changed yet.
   */
  const anonToken = await currentAnonToken();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/callback`,
    },
  });

  if (error) {
    /*
     * ⚠ THE UPSTREAM MESSAGE NEVER REACHES HER. This line used to read
     * `${error.message}`, and a therapist on a phone was shown:
     *
     *   We couldn't create the account: Unexpected token 'H', "Host not i"...
     *   is not valid JSON
     *
     * Whatever the auth layer is having trouble with — a rate limit, an
     * outage, a proxy in front of it returning HTML — the sentence she reads
     * has to be one a human wrote, and it has to say what to do next. The
     * machine detail is what an engineer needs, so it goes to the server log,
     * where it is useful and where she never sees it.
     */
    console.error(`[signUp] ${error.code ?? "unknown"}: ${error.message}`);
    return { error: signUpMessage(error.code) };
  }

  /*
   * ── SIGNING UP CLAIMS THE BRIEF, IT DOES NOT START ONE ────────────────
   *
   * She answered seven steps and is looking at three directions. The account
   * exists so she can keep THAT.
   *
   * ⚠ THE CLAIM DOES NOT WAIT FOR A SESSION, and that is what keeps email
   * confirmation out of the critical path rather than merely shortening it.
   * `signUp` returns the new user's id even when confirmation is on and no
   * session is issued — so the brief is attached to her account at the moment
   * she signs up, and is waiting for her whether she is let straight in or has
   * to confirm first.
   *
   * It never fails the signup. Her account exists either way; a brief that
   * could not be attached is a brief, not an account.
   */
  let claimedProjectId: string | null = null;

  if (data.user && anonToken) {
    const outcome = await claimAnonBrief(createAdminClient(), {
      token: anonToken,
      userId: data.user.id,
    });

    if (outcome.claimed) {
      claimedProjectId = outcome.projectId;
      /*
       * The cookie is spent. Leaving it would point at a row that no longer
       * answers to it, and on a shared device the next person would carry a
       * token for someone else's claimed project.
       */
      const jar = await cookies();
      jar.delete(ANON_COOKIE);
    } else {
      console.info(`[signUp] brief not claimed: ${outcome.reason}`);
    }
  }

  /*
   * ⚠ THE PROJECT ID IS WHAT MAKES THIS STEP JOINABLE. Without it, the funnel
   * can count accounts but cannot tell which anonymous walk became which
   * account — and that link is the whole point of letting the brief run
   * without one. It is null when she signed up without a brief in flight,
   * which is itself worth being able to count.
   */
  track("account_created", {
    userId: data.user?.id ?? null,
    projectId: claimedProjectId,
    claimed: claimedProjectId !== null,
    confirmed: data.session !== null,
  });

  /*
   * With confirmation ON, `signUp` issues no session and she is told to check
   * her email — but her brief is already hers. With confirmation OFF, the
   * session exists and this redirect lands her straight back on it.
   */
  redirect(data.session ? "/app" : "/signup/check-your-email");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

