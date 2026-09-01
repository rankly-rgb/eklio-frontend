import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

/*
 * Socle des route handlers de l'application (§7).
 *
 * CONVENTION — ce dépôt portait DEUX conventions serveur : des route handlers
 * (webhook Stripe, callback d'auth) et des server actions (l'ancien tunnel
 * français, retiré au lot 1). Le §7 décrit une surface HTTP explicite : un
 * PATCH sur un brief, un statut de job interrogé toutes les 1,5 s, une
 * ressource d'autrui qui répond 404 et non 403. Deux raisons de trancher pour
 * les route handlers :
 *   - les server actions sont dispatchées EN SÉRIE par React ; un sondage
 *     toutes les 1,5 s se mettrait en travers de l'autosave et des clics ;
 *   - le §7 nomme des verbes et des codes, ce qu'une action ne porte pas.
 *
 * Les server actions restent pour les FORMULAIRES d'authentification, où
 * l'amélioration progressive compte et où elles préexistaient.
 *
 * Toutes les routes ci-dessous sont authentifiées et cadrées à l'utilisateur.
 * La ressource d'un autre répond 404 : un 403 confirmerait son existence.
 */

export type Session = {
  supabase: SupabaseClient<Database>;
  userId: string;
  email: string | null;
};

export type Authenticated =
  | { ok: true; session: Session }
  | { ok: false; response: NextResponse };

export async function authenticate(): Promise<Authenticated> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, response: unauthorized() };
  }

  return {
    ok: true,
    session: { supabase, userId: user.id, email: user.email ?? null },
  };
}

export function json<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
}

/**
 * Ressource absente OU appartenant à quelqu'un d'autre. Les deux cas répondent
 * la même chose, volontairement : distinguer les deux dirait à un inconnu que
 * l'identifiant qu'il a essayé existe.
 */
export function notFound(): NextResponse {
  return NextResponse.json({ error: "Not found." }, { status: 404 });
}

/** Erreur de saisie. Le message est affiché tel quel : il dit quoi faire. */
export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * Panne côté serveur. Le détail est journalisé, jamais renvoyé : il peut citer
 * un extrait de contenu ou une contrainte de base.
 */
export function serverError(context: string, detail: unknown): NextResponse {
  console.error(`[api] ${context}`, detail);
  return NextResponse.json(
    { error: "Something didn't go through on our side. Your answers are saved." },
    { status: 500 }
  );
}

/** Corps JSON, ou `null` si le corps est absent ou malformé. */
export async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
