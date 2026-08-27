import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadHeaderContext } from "@/lib/app/header-context";
import { signOut } from "@/lib/actions/auth";
import { AppHeader } from "@/components/app/app-header";

/*
 * Coquille de l'espace connecté : garde de session, en-tête, contenu.
 *
 * Le proxy protège déjà /app, mais la vérification serveur reste la source de
 * vérité (défense en profondeur).
 */
export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/app");
  }

  const header = await loadHeaderContext(supabase, user.id, user.email);

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader
        brandKitId={header.brandKitId}
        initials={header.initials}
        signOutAction={signOut}
      />
      {children}
    </div>
  );
}
