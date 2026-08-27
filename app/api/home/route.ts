import { authenticate, json, serverError } from "@/lib/api/handler";
import { greeting, loadHome } from "@/lib/data/home";

/*
 * GET /api/home — l'agrégat de l'accueil.
 *
 * La page rend le même modèle par la même fonction : l'écran et la route ne
 * peuvent pas diverger.
 */
export async function GET() {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  try {
    const home = await loadHome(auth.session.supabase, auth.session.userId);
    return json({ ...home, greeting: greeting(home.firstName) });
  } catch (error) {
    return serverError("GET /api/home", error);
  }
}
