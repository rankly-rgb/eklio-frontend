import { NextResponse } from "next/server";
import { authenticate, json, serverError } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { countUnpaidProjects } from "@/lib/billing/entitlements";
import { track } from "@/lib/analytics";

/*
 * POST /api/briefs — crée un projet et son brief, rend l'identifiant.
 *
 * Le projet et le brief naissent ENSEMBLE : un projet sans ligne de brief
 * ferait un 404 sur la première question. Si la seconde insertion échoue, la
 * première est défaite — un projet orphelin n'apparaîtrait nulle part mais
 * porterait quand même le nom de la practice.
 *
 * ── POURQUOI UN PLAFOND, ET SUR QUOI IL PORTE ───────────────────────────
 *
 * Le crédit de génération est PAR KIT, et un kit par projet. Sans plafond,
 * l'allocation gratuite se remet à zéro à chaque « New brief » : on aurait mis
 * un compteur sur une porte à côté de laquelle on peut passer autant de fois
 * qu'on veut.
 *
 * Il porte donc sur les projets NON PAYÉS, et sur eux seuls. Quelqu'un qui a
 * acheté trois kits ne cultive rien, et lui opposer un mur serait un ticket de
 * support qu'on ne devrait jamais recevoir. Les projets payés ne sont pas
 * plafonnés du tout.
 *
 * TROIS briefs non payés en même temps : de quoi explorer, reprendre après un
 * faux départ, comparer deux noms de cabinet. Au-delà, ce n'est plus de
 * l'exploration. Le refus n'atteint alors QUE quelqu'un qui n'a pas payé, ce
 * qui est exactement à qui il s'adresse — et son texte peut donc dire la
 * chose utile : finissez-en un, ou déverrouillez celui-ci.
 */
const MAX_UNPAID_PROJECTS = 3;

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

  if ((await countUnpaidProjects(supabase, userId)) >= MAX_UNPAID_PROJECTS) {
    return NextResponse.json(
      {
        error: `You've got ${MAX_UNPAID_PROJECTS} briefs open and none of them unlocked yet. Finish one, or unlock it, before starting another.`,
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
