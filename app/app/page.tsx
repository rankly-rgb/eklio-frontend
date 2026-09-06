import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadHome, loadHomeCanvas } from "@/lib/data/home";
import { HomeView } from "@/components/home/home-view";

/*
 * L'accueil — « your practice this week ».
 *
 * `loadHome` reste l'agrégat partagé avec `GET /api/home` : l'écran et la
 * route ne peuvent pas diverger. `loadHomeCanvas` est SPÉCIFIQUE à cet
 * écran — le site rendu, la photo, le prochain geste, la semaine, les
 * notifications — et n'est appelé QUE par cette page, pour que les cinq
 * autres routes qui lisent `loadHome` pour un seul champ (`brandKit`) ne
 * paient pas ce coût.
 */
export default async function AppHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app");

  const home = await loadHome(supabase, user.id);
  const canvas = await loadHomeCanvas(supabase, home);

  return <HomeView home={home} canvas={canvas} />;
}
