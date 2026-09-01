import type { NextRequest } from "next/server";
import { authenticate, badRequest, json, serverError } from "@/lib/api/handler";
import { loadCalendar, monthKey } from "@/lib/data/calendar";

/*
 * GET /api/calendar?month=YYYY-MM-01 — le calendrier éditorial d'un mois.
 *
 * Sans `month`, le mois courant à New York : c'est le fuseau du produit, celui
 * dans lequel le cron mensuel tourne.
 */
export async function GET(request: NextRequest) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const raw = request.nextUrl.searchParams.get("month");
  const month = raw ?? monthKey(new Date());

  if (!/^\d{4}-\d{2}-01$/.test(month)) {
    return badRequest("Ask for a month as YYYY-MM-01.");
  }

  try {
    return json(
      await loadCalendar(auth.session.supabase, auth.session.userId, month)
    );
  } catch (error) {
    return serverError("GET /api/calendar", error);
  }
}
