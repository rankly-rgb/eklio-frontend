"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  generateMonthlyPresence,
  PresenceTruncatedError,
} from "@/lib/ai/monthly-presence";
import { paletteFromStored } from "@/lib/ai/directions";
import { EthicsComplianceError } from "@/lib/ethics/enforce";
import { parseStoredBriefDraft } from "@/lib/brief/schemas";
import { parseStoredKit } from "@/lib/kit/content";
import { getSubscriptionState } from "@/lib/billing/entitlements";
import { daysInMonth, formatMonth, monthStart } from "@/lib/presence/month";
import { MONTHLY_PRESENCE } from "@/lib/billing/plans";
import type { MonthlyPresence } from "@/lib/presence/content";

/*
 * Génération du livrable Monthly Presence du mois courant.
 *
 * Deux portes, dans cet ordre, et aucune n'est facultative :
 * 1. le projet appartient au praticien (la RLS le filtre) ;
 * 2. son abonnement est ACTIF — c'est-à-dire que le webhook Stripe l'a
 *    confirmé. Ni la page de succès ni un retour de navigateur ne suffisent.
 */

export type GeneratePresenceResult = { ok: true } | { ok: false; error: string };

const GENERIC_ERROR = "Something went wrong. Please try again.";

const ETHICS_ERROR =
  "We couldn't generate a compliant month of content this time. Please try again.";

const TOO_LONG_ERROR =
  "This month ran longer than we could generate in one pass. Please try again.";

const NOT_SUBSCRIBED_ERROR = `${MONTHLY_PRESENCE.label} isn't active on your account. Subscribe to generate this month's content.`;

const NO_KIT_ERROR =
  "Build your brand kit first — this month's content is written from it.";

/*
 * Journalisation de l'échec, avec sa NATURE. Même règle qu'au kit : le message
 * rendu au praticien ne dit rien d'exploitable, donc la vraie cause doit rester
 * lisible côté serveur, nommée plutôt que noyée dans un `console.error` brut.
 */
function logGenerationFailure(error: unknown): void {
  if (error instanceof EthicsComplianceError) {
    console.error(
      `[generatePresence] ÉCHEC déontologique après ${error.attempts} tentative(s) :`,
      error.violations
    );
    return;
  }
  if (error instanceof PresenceTruncatedError) {
    console.error(
      "[generatePresence] ÉCHEC longueur : réponse coupée par max_tokens."
    );
    return;
  }
  if (error instanceof z.ZodError) {
    console.error(
      "[generatePresence] ÉCHEC structure : le mois ne valide pas le schéma —",
      error.issues.map((issue) => `${issue.path.join(".")} : ${issue.message}`)
    );
    return;
  }

  const detail = error as { name?: string; message?: string; status?: number };
  console.error(
    `[generatePresence] ÉCHEC ${detail?.name ?? "inconnu"}${
      detail?.status ? ` (HTTP ${detail.status})` : ""
    } : ${detail?.message ?? String(error)}`,
    error
  );
}

export async function generatePresence(
  projectId: string
): Promise<GeneratePresenceResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Your session has expired. Sign in again." };
  }

  if (!z.uuid().safeParse(projectId).success) {
    return { ok: false, error: "This project could not be found." };
  }

  /*
   * Porte n°2 : l'abonnement. Elle est vérifiée ICI, côté serveur, et pas
   * seulement à l'affichage — une server action est une URL, et cacher un
   * bouton n'a jamais empêché personne de l'appeler.
   */
  const subscription = await getSubscriptionState(supabase, user.id);
  if (!subscription.isActive) {
    return { ok: false, error: NOT_SUBSCRIBED_ERROR };
  }

  // La RLS filtre par propriétaire : le projet d'un autre est simplement absent.
  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    return { ok: false, error: "This project could not be found." };
  }

  const [{ data: briefRow }, { data: kitRow }] = await Promise.all([
    supabase
      .from("project_briefs")
      .select("data")
      .eq("project_id", projectId)
      .maybeSingle(),
    supabase
      .from("brand_kits")
      .select("content, direction_id")
      .eq("project_id", projectId)
      .maybeSingle(),
  ]);

  const kit = kitRow ? parseStoredKit(kitRow.content) : null;
  if (!kit) {
    /*
     * Sans kit, il n'y a ni voix ni positionnement à reprendre : le mois
     * s'écrirait à côté de la marque qu'il est censé servir.
     */
    return { ok: false, error: NO_KIT_ERROR };
  }

  const { data: direction } = await supabase
    .from("directions")
    .select("*")
    .eq("id", kitRow!.direction_id)
    .maybeSingle();

  if (!direction) {
    return { ok: false, error: NO_KIT_ERROR };
  }

  const draft = parseStoredBriefDraft(briefRow?.data);

  const month = monthStart(new Date());
  const days = daysInMonth(month);

  let generated: MonthlyPresence;
  try {
    generated = await generateMonthlyPresence({
      projectName: project.name,
      draft,
      month,
      monthLabel: formatMonth(month),
      daysInMonth: days,
      kit,
      direction: {
        name: direction.name,
        description: direction.description,
        palette: paletteFromStored(direction.palette),
        heading_font: direction.typographie_titre,
        body_font: direction.typographie_corps,
      },
    });
  } catch (error) {
    // Rien n'est persisté : la génération s'arrête avant la moindre écriture.
    logGenerationFailure(error);

    if (error instanceof EthicsComplianceError) {
      return { ok: false, error: ETHICS_ERROR };
    }
    if (error instanceof PresenceTruncatedError) {
      return { ok: false, error: TOO_LONG_ERROR };
    }
    return { ok: false, error: GENERIC_ERROR };
  }

  /*
   * Écriture par la service_role, obligatoirement : `monthly_presence_content`
   * est en INSERT et UPDATE refusés aux clients par RLS (policies
   * `monthly_presence_content_insert_denied` / `_update_denied`), lecture
   * propriétaire seulement. Ce n'est pas un contournement — c'est le seul
   * chemin d'écriture prévu au schéma, et il exige que l'appartenance du
   * projet ait été vérifiée AVANT, ce qui est fait plus haut avec le client de
   * session.
   *
   * Le statut n'est écrit qu'à la fin, en `complete`. Pas de `generating`
   * intermédiaire : sans ordonnanceur pour le nettoyer, une génération
   * interrompue laisserait la ligne bloquée dans cet état, et le praticien
   * verrait un mois éternellement « en cours » qu'aucun bouton ne débloque.
   */
  const admin = createAdminClient();
  const { error: upsertError } = await admin
    .from("monthly_presence_content")
    .upsert(
      {
        project_id: projectId,
        month,
        content: generated,
        status: "complete",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,month" }
    );

  if (upsertError) {
    console.error("[generatePresence] enregistrement du mois", upsertError);
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath(`/app/projets/${projectId}/presence`);
  return { ok: true };
}
