import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/*
 * Garde de session de l'espace connecté. Le proxy protège déjà /app, mais la
 * vérification serveur reste la source de vérité (défense en profondeur).
 */
export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/app");
  }

  return <>{children}</>;
}
