import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadHome } from "@/lib/data/home";
import { HomeView } from "@/components/home/home-view";

/*
 * L'accueil (Écran 7). Le même agrégat que `GET /api/home`, par la même
 * fonction : l'écran et la route ne peuvent pas diverger.
 */
export default async function AppHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app");

  const home = await loadHome(supabase, user.id);

  return <HomeView home={home} />;
}
