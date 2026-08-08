import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Cible du lien de confirmation envoyé par email (signup, magic link futur).
 * Échange le code contre une session puis redirige vers l'app.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
