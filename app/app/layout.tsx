import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadHeaderContext } from "@/lib/app/header-context";
import { loadWorkspaces } from "@/lib/data/workspaces";
import { signOut } from "@/lib/actions/auth";
import { AppHeader } from "@/components/app/app-header";
import { AppFooter } from "@/components/app/footer";

/*
 * Coquille de l'espace connecté : garde de session, en-tête, contenu, pied
 * de page (post-purchase-v2, Lot 2).
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

  const [header, workspaces] = await Promise.all([
    loadHeaderContext(supabase, user.id, user.email),
    loadWorkspaces(supabase),
  ]);

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader
        brandKitId={header.brandKitId}
        initials={header.initials}
        displayName={header.displayName}
        workspaces={workspaces}
        signOutAction={signOut}
      />
      {children}
      <AppFooter />
    </div>
  );
}
