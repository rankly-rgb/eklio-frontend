import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { authorizeCron } from "@/lib/api/cron";
import { parseDirections } from "@/lib/data/brand-kit";
import { resumeStep } from "@/lib/brief/flow";
import {
  briefAbandonedEmail,
  directionUnchosenEmail,
} from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/transport";
import { canSend, parseEmailState, recordSend } from "@/lib/email/state";

/*
 * Les deux relances (§7), balayées une fois par jour.
 *
 *   - BRIEF ABANDONNÉ : 24 h sans toucher au brief, DEUX étapes ou plus
 *     franchies. Deux étapes est le seuil qui distingue quelqu'un qui a
 *     commencé de quelqu'un qui a cliqué.
 *   - DIRECTION NON CHOISIE : 48 h après un kit généré sans choix.
 *
 * Le plafond de 72 h et la déduplication par type vivent dans
 * `lib/email/state.ts` : ce n'est pas parce qu'il y a deux raisons d'écrire
 * qu'on écrit deux fois.
 *
 * Ce balayage est BORNÉ. Sans borne, un jour de panne d'envoi rattraperait
 * toute la base d'un coup au run suivant.
 */

export const maxDuration = 300;

const ABANDONED_AFTER_HOURS = 24;
const UNCHOSEN_AFTER_HOURS = 48;
const BATCH = 200;

export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const admin = createAdminClient();
  const now = Date.now();

  const abandoned = await sweepAbandonedBriefs(admin, now);
  const unchosen = await sweepUnchosenDirections(admin, now);

  return NextResponse.json({ abandoned, unchosen });
}

async function sweepAbandonedBriefs(
  admin: ReturnType<typeof createAdminClient>,
  now: number
): Promise<number> {
  const cutoff = new Date(now - ABANDONED_AFTER_HOURS * 3600_000).toISOString();

  const { data, error } = await admin
    .from("project_briefs")
    .select(
      "project_id, progress_step, completed_steps, practice_name, updated_at, projects!inner(user_id)"
    )
    .lt("updated_at", cutoff)
    .limit(BATCH);

  if (error) {
    console.error("[cron/nudges] briefs", error);
    return 0;
  }

  let sent = 0;

  for (const brief of data ?? []) {
    // Deux étapes franchies : le seuil qui distingue « commencé » de « cliqué ».
    if ((brief.completed_steps?.length ?? 0) < 2) continue;

    const userId = (brief.projects as unknown as { user_id: string }).user_id;

    // Un brief déjà transformé en kit n'est pas abandonné.
    const { data: kit } = await admin
      .from("brand_kits")
      .select("id")
      .eq("project_id", brief.project_id)
      .maybeSingle();
    if (kit) continue;

    const delivered = await send(admin, userId, "brief_abandoned", (email) =>
      briefAbandonedEmail({
        to: email,
        userId,
        projectId: brief.project_id,
        // Le lien reprend à l'étape ENREGISTRÉE : renvoyer sur la première
        // question ferait recommencer quelqu'un qui a déjà répondu.
        step: resumeStep(brief),
        practiceName: brief.practice_name,
      })
    );

    if (delivered) sent += 1;
  }

  return sent;
}

async function sweepUnchosenDirections(
  admin: ReturnType<typeof createAdminClient>,
  now: number
): Promise<number> {
  const cutoff = new Date(now - UNCHOSEN_AFTER_HOURS * 3600_000).toISOString();

  const { data, error } = await admin
    .from("brand_kits")
    .select("id, directions, selected_direction_id, updated_at, projects!inner(user_id)")
    .is("selected_direction_id", null)
    .not("directions", "is", null)
    .lt("updated_at", cutoff)
    .limit(BATCH);

  if (error) {
    console.error("[cron/nudges] kits", error);
    return 0;
  }

  let sent = 0;

  for (const kit of data ?? []) {
    const userId = (kit.projects as unknown as { user_id: string }).user_id;
    const directions = parseDirections(kit.directions);
    if (!directions) continue;

    const delivered = await send(admin, userId, "direction_unchosen", (email) =>
      directionUnchosenEmail({
        to: email,
        userId,
        brandKitId: kit.id,
        directionNames: directions.map((direction) => direction.name),
      })
    );

    if (delivered) sent += 1;
  }

  return sent;
}

/** Résout l'adresse, applique le plafond, envoie, note l'envoi. */
async function send(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  kind: "brief_abandoned" | "direction_unchosen",
  build: (email: string) => ReturnType<typeof briefAbandonedEmail>
): Promise<boolean> {
  const { data: account } = await admin.auth.admin.getUserById(userId);
  const user = account?.user;
  if (!user?.email) return false;

  const state = parseEmailState(user.user_metadata);
  if (!canSend(state, kind)) return false;

  const outcome = await sendEmail(build(user.email));
  if (!outcome.ok) {
    console.error(`[cron/nudges] envoi ${kind}`, outcome.error);
    return false;
  }

  await recordSend(admin, userId, user.user_metadata, kind);
  return true;
}
