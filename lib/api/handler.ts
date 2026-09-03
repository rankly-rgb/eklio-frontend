import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { AnthropicNotConfiguredError } from "@/lib/ai/client";
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

/**
 * A synchronous generation call's error, classified into the three things
 * it can actually mean — never collapsed into one generic message, because
 * a guardrail rejection, a model failure, and a missing API key are three
 * different events and the person waiting deserves to know which. Used by
 * routes that call the model directly in the request/response cycle
 * (`usp-options`, `tone-cards`) — the async pipeline (`generate`) has its
 * own reasons not to forward error text to the client at all (see
 * `lib/generation/job.ts`'s `error` field comment) and doesn't use this.
 *
 * - `AnthropicNotConfiguredError` — infrastructure, not her answers.
 *   503, so a client can tell "try again, this isn't about you" apart from
 *   a 500 that might be a real bug worth investigating.
 * - `Anthropic.APIError` (rate limit, timeout, a bad response from the
 *   model) — genuinely transient, worth an immediate retry. 502.
 * - Anything else — an actual bug. Falls back to `serverError`'s existing
 *   generic message and logging, unchanged.
 */
export function generationErrorResponse(context: string, error: unknown): NextResponse {
  if (error instanceof AnthropicNotConfiguredError) {
    console.error(`[api] ${context}: generation not configured`, error.message);
    return NextResponse.json(
      {
        error: "Generation isn't available right now — that's on us, not your answers. Try again shortly.",
        code: "generation_unavailable",
      },
      { status: 503 }
    );
  }

  if (error instanceof Anthropic.APIError) {
    console.error(`[api] ${context}: model call failed`, error);
    return NextResponse.json(
      {
        error: "The model didn't respond just now. Try again — this isn't about your answers.",
        code: "model_call_failed",
      },
      { status: 502 }
    );
  }

  return serverError(context, error);
}

/** Corps JSON, ou `null` si le corps est absent ou malformé. */
export async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
