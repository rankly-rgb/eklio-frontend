import { authenticate, json, serverError } from "@/lib/api/handler";
import { track } from "@/lib/analytics";

/*
 * POST /api/briefs — crée un projet et son brief, rend l'identifiant.
 *
 * Le projet et le brief naissent ENSEMBLE : un projet sans ligne de brief
 * ferait un 404 sur la première question. Si la seconde insertion échoue, la
 * première est défaite — un projet orphelin n'apparaîtrait nulle part mais
 * porterait quand même le nom de la practice.
 */
export async function POST() {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { supabase, userId } = auth.session;

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
