import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { json, serverError } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { countUnpaidProjects } from "@/lib/billing/entitlements";
import { track } from "@/lib/analytics";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  ANON_COOKIE,
  anonCookieOptions,
  anonExpiryFrom,
  clientIp,
  hashAnonToken,
  ipBucket,
  mintAnonToken,
} from "@/lib/anon/token";

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

/*
 * Le même ralentisseur pour une adresse sans compte, un peu plus serré : elle
 * n'a rien payé, et personne n'a besoin de dix briefs anonymes en une heure.
 */
const ANON_CREATE_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 };
export async function POST(request: Request) {
  const supabaseSession = await createClient();
  const {
    data: { user },
  } = await supabaseSession.auth.getUser();

  /*
   * ⚠ NO ACCOUNT REQUIRED. This route used to begin with `authenticate()`, and
   * that single line was the wall the acquisition walk found: the brief lives
   * under `/app`, so a stranger had to hand over an email address and a
   * password, confirm it by leaving the site, and come back — before receiving
   * anything at all.
   *
   * A visitor with no session gets an anonymous brief owned by a token. The
   * account is created later, at the moment she wants to keep what she is
   * already looking at.
   */
  if (!user) return createAnonymousBrief(request);

  const supabase = supabaseSession;
  const userId = user.id;

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


/*
 * ── AN ANONYMOUS BRIEF, AND THE MONEY IT COULD COST ─────────────────────
 *
 * Creating one is two INSERTs and no model call, so it is cheap. It is still
 * capped, because the row it creates is what a generation later hangs off, and
 * because a table of ownerless rows is the shape of the dead table this project
 * spent two sessions killing.
 *
 * ⚠ WRITTEN WITH THE SERVICE ROLE, and it has to be. The insert policy on
 * `projects` deliberately refuses an anonymous row: a browser that chooses its
 * own token hash can choose one it has already seen, which would hand it
 * someone else's brief. The token is minted here, where the client cannot
 * influence it.
 */
async function createAnonymousBrief(request: Request) {
  const bucket = ipBucket(clientIp(request));

  /*
   * A different ledger from the generation cap — this one is per-process and
   * cheap, and it is only here to stop a script opening ten thousand rows. The
   * one that guards MONEY is `consume_anon_generation`, in the database, on
   * the generate route.
   */
  const verdict = rateLimit(`anon-briefs:${bucket}`, ANON_CREATE_LIMIT);
  if (!verdict.allowed) {
    return NextResponse.json(
      { error: "That's a lot of new briefs at once. Give it a minute." },
      { status: 429, headers: { "retry-after": String(verdict.retryAfterSeconds) } }
    );
  }

  const admin = createAdminClient();
  const token = mintAnonToken();

  const { data: project, error } = await admin
    .from("projects")
    .insert({
      user_id: null,
      anon_token_hash: hashAnonToken(token),
      anon_expires_at: anonExpiryFrom(),
    })
    .select("id")
    .single();

  if (error || !project) return serverError("POST /api/briefs (anon)", error);

  const { error: briefError } = await admin
    .from("project_briefs")
    .insert({ project_id: project.id });

  if (briefError) {
    // Same rule as the signed-in path: a project with no brief row 404s on the
    // first question, so an orphan is undone rather than left.
    await admin.from("projects").delete().eq("id", project.id);
    return serverError("POST /api/briefs (anon)", briefError);
  }

  /*
   * ⚠ THE COOKIE IS THE ONLY WAY BACK. It is httpOnly — no script of ours
   * needs to read it, and one of someone else's must not — and it lasts as
   * long as the row it points at.
   */
  const jar = await cookies();
  jar.set(ANON_COOKIE, token, anonCookieOptions());

  track("brief_started", { projectId: project.id, anonymous: true });
  return json({ id: project.id }, { status: 201 });
}
