"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signedInRedirectPath } from "@/lib/auth/next-url";

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
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error) {
    return { error: `We couldn't create the account: ${error.message}` };
  }

  redirect("/signup/check-your-email");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
