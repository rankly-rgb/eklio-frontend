import { NextResponse } from "next/server";
import { authenticate, json, serverError } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { track } from "@/lib/analytics";

/*
 * POST /api/briefs — crée un projet et son brief, rend l'identifiant.
 *
 * Le projet et le brief naissent ENSEMBLE : un projet sans ligne de brief
 * ferait un 404 sur la première question. Si la seconde insertion échoue, la
 * première est défaite — un projet orphelin n'apparaîtrait nulle part mais
 * porterait quand même le nom de la practice.
 *
 * ── POURQUOI UN PLAFOND ──────────────────────────────────────────────────
 *
 * Le crédit de génération est PAR KIT, et un kit par projet. Sans plafond de
 * projets, l'allocation gratuite se remet à zéro à chaque « New brief » : on
 * aurait mis un compteur sur une porte à côté de laquelle on peut passer
 * autant de fois qu'on veut.
 *
 * SIX, et c'est un choix de produit plus qu'une mesure. Le produit parle
 * d'UNE marque — l'accueil montre le projet le plus récemment touché et
 * n'expose aucune liste. Six laisse la place à une reprise après un faux
 * départ, à un cabinet de groupe, à un changement de nom ; il ferme la boucle
 * infinie. Si quelqu'un légitime bute dessus, le nombre est ici, en un seul
 * endroit, et le message le dit sans le traiter en fraudeur.
 */
const MAX_PROJECTS_PER_USER = 6;

/** Ralentisseur : la création d'un projet est deux INSERT, pas une génération. */
const CREATE_LIMIT = { limit: 20, windowMs: 60 * 60 * 1000 };
export async function POST() {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { supabase, userId } = auth.session;

  const verdict = rateLimit(`briefs:${userId}`, CREATE_LIMIT);
  if (!verdict.allowed) {
    return NextResponse.json(
      { error: "That's a lot of new briefs at once. Give it a minute." },
      {
        status: 429,
        headers: { "retry-after": String(verdict.retryAfterSeconds) },
      }
    );
  }

  /*
   * `head: true` : on veut le NOMBRE, pas les lignes. La RLS de `projects` est
   * propriétaire-only, donc ce compte est déjà cadré à l'utilisateur — le
   * `.eq` explicite est là pour que ça reste vrai si la policy change.
   */
  const { count, error: countError } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (countError) return serverError("POST /api/briefs", countError);

  if ((count ?? 0) >= MAX_PROJECTS_PER_USER) {
    return NextResponse.json(
      {
        error: `You've got ${MAX_PROJECTS_PER_USER} briefs going. Finish or delete one before starting another.`,
      },
      { status: 409 }
    );
  }

  const { data: project, error } = await supabase
    .from("projects")
    .insert({ user_id: userId })
    .select("id")
    .single();

  if (error || !project) return serverError("POST /api/briefs", error);

  const { error: briefError } = await supabase
    .from("project_briefs")
    .insert({ project_id: project.id });

  if (briefError) {
    const { error: cleanupError } = await supabase
      .from("projects")
      .delete()
      .eq("id", project.id);
    if (cleanupError) {
      console.error("[api] projet orphelin", project.id, cleanupError);
    }
    return serverError("POST /api/briefs", briefError);
  }

  track("brief_started", { projectId: project.id });
  return json({ id: project.id }, { status: 201 });
}
