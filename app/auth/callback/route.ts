import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signedInRedirectPath } from "@/lib/auth/next-url";

/**
 * Cible du lien de confirmation envoyé par email (signup, magic link futur).
 * Échange le code contre une session puis redirige vers l'app.
 *
 * `next` arrives in this URL exactly the way an attacker could put it
 * there too — it is the confirmation link Supabase sends, so anyone can
 * shape one and get a real person to click it. signedInRedirectPath()
 * runs the same allowlist signIn already uses (lib/auth/next-url.ts): an
 * external or malformed `next` falls back to `/app`, never followed.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = signedInRedirectPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
