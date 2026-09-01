import { authenticate, json, serverError } from "@/lib/api/handler";
import { readCatalog } from "@/lib/catalog/read";

/*
 * GET /api/catalog — le catalogue complet, tel qu'il est en base.
 *
 * Les tables de catalogue ne sont lisibles que par le rôle `authenticated`,
 * d'où l'authentification ici comme partout ailleurs.
 */
export async function GET() {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  try {
    return json(await readCatalog(auth.session.supabase));
  } catch (error) {
    return serverError("GET /api/catalog", error);
  }
}
