"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signedInRedirectPath } from "@/lib/auth/next-url";
import { siteUrl } from "@/lib/site-url";
import { signUpMessage } from "@/lib/auth/signup-message";

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

  if (password.length < 8) {
    return { error: "Use a password of at least 8 characters." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
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

  redirect("/signup/check-your-email");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

