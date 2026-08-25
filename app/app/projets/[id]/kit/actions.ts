"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateBrandKit, KitScopeError } from "@/lib/ai/kit";
import { paletteFromStored } from "@/lib/ai/directions";
import { practiceName } from "@/lib/ai/brief-context";
import { EthicsComplianceError } from "@/lib/ethics/enforce";
import { parseStoredBriefDraft } from "@/lib/brief/schemas";
import { DEFAULT_KIT_TIER, resolveKitScope } from "@/lib/kit/tiers";
import { buildShareSlug } from "@/lib/kit/share";
import type { StoredKit } from "@/lib/kit/content";

export type GenerateKitResult = { ok: true } | { ok: false; error: string };

const GENERIC_ERROR = "Something went wrong. Please try again.";

/*
 * Échec déontologique : le modèle n'a pas produit de copy conforme, même après
 * régénération. On le dit sans citer les extraits fautifs — ils restent dans
 * les logs serveur (cf. lib/ethics/enforce.ts).
 */
const ETHICS_ERROR =
  "We couldn't generate a compliant brand kit this time. Please try again.";

/* Échec de périmètre : le kit rendu était incomplet. Rien n'a été enregistré. */
const INCOMPLETE_ERROR =
  "The brand kit came back incomplete, so we didn't save it. Please try again.";

const NO_DIRECTION_ERROR =
  "Choose one of your three directions before building your brand kit.";

/*
 * Génère (ou régénère) le kit de marque d'un projet à partir de son brief et
 * de la direction choisie.
 *
 * Une régénération REMPLACE le kit précédent : `brand_kits.project_id` est
 * unique en base, donc un projet porte un kit et un seul. Pas d'historique —
 * si le produit en veut un plus tard, c'est une décision de schéma à prendre
 * dans `eklio-backend`, pas un contournement côté front.
 */
export async function generateKit(
  projectId: string
): Promise<GenerateKitResult> {
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

  // La RLS filtre déjà par propriétaire : un projet d'un autre utilisateur est
  // simplement absent du résultat.
  const { data: project, error: projectSelectError } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .maybeSingle();

  if (projectSelectError) {
    console.error("[generateKit] lecture projet", projectSelectError);
  }
  if (!project) {
    return { ok: false, error: "This project could not be found." };
  }

  const { data: briefRow, error: briefSelectError } = await supabase
    .from("project_briefs")
    .select("data")
    .eq("project_id", projectId)
    .maybeSingle();

  if (briefSelectError) {
    console.error("[generateKit] lecture brief", briefSelectError);
  }
  if (!briefRow) {
    return { ok: false, error: "This project could not be found." };
  }

  const { data: direction, error: directionSelectError } = await supabase
    .from("directions")
    .select("*")
    .eq("project_id", projectId)
    .eq("is_selected", true)
    .maybeSingle();

  if (directionSelectError) {
    console.error("[generateKit] lecture direction", directionSelectError);
  }
  if (!direction) {
    return { ok: false, error: NO_DIRECTION_ERROR };
  }

  // Lecture tolérante, comme partout ailleurs : les briefs et palettes
  // enregistrés avant le Lot 2 portent les anciennes clés françaises.
  const draft = parseStoredBriefDraft(briefRow.data);

  /*
   * Couture du gating par tier (Lot 4) : le tier est aujourd'hui constant et
   * le plus généreux. Quand le paiement sera branché, seule cette ligne change
   * — le périmètre traverse ensuite toute la génération via `scope`.
   */
  const scope = resolveKitScope(DEFAULT_KIT_TIER, draft.pages_wanted);

  let generated;
  try {
    generated = await generateBrandKit({
      projectName: project.name,
      draft,
      direction: {
        name: direction.name,
        description: direction.description,
        palette: paletteFromStored(direction.palette),
        heading_font: direction.typographie_titre,
        body_font: direction.typographie_corps,
      },
      scope,
    });
  } catch (error) {
    console.error("[generateKit] appel Anthropic", error);
    // Échec structurel, de périmètre ou déontologique : rien n'est persisté,
    // la génération s'arrête avant la moindre écriture.
    if (error instanceof EthicsComplianceError) {
      return { ok: false, error: ETHICS_ERROR };
    }
    if (error instanceof KitScopeError) {
      return { ok: false, error: INCOMPLETE_ERROR };
    }
    return { ok: false, error: GENERIC_ERROR };
  }

  const { website_prompt: websitePrompt, ...content } = generated;

  /*
   * Le slug de partage est stable d'une régénération à l'autre : un lien déjà
   * transmis ne doit pas mourir parce que le praticien a relancé la génération.
   */
  const { data: existingKit } = await supabase
    .from("brand_kits")
    .select("share_slug")
    .eq("project_id", projectId)
    .maybeSingle();

  const stored: StoredKit = { ...content, tier: scope.tier };

  const { error: upsertError } = await supabase.from("brand_kits").upsert(
    {
      project_id: projectId,
      direction_id: direction.id,
      // `content` porte le livrable et le tier qui l'a produit ; le prompt
      // multi-plateformes a sa propre colonne au schéma.
      content: stored,
      multi_builder_prompt: websitePrompt,
      share_slug:
        existingKit?.share_slug ??
        buildShareSlug(practiceName(project.name, draft)),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "project_id" }
  );

  if (upsertError) {
    console.error("[generateKit] enregistrement du kit", upsertError);
    return { ok: false, error: GENERIC_ERROR };
  }

  const { error: projectUpdateError } = await supabase
    .from("projects")
    .update({ status: "kit" })
    .eq("id", projectId);
  if (projectUpdateError) {
    // Le kit est enregistré : un statut resté à `directions` dégrade la
    // reprise, il n'invalide pas le livrable. On journalise sans échouer.
    console.error("[generateKit] mise à jour statut projet", projectUpdateError);
  }

  revalidatePath("/app");
  revalidatePath(`/app/projets/${projectId}/directions`);
  revalidatePath(`/app/projets/${projectId}/kit`);
  redirect(`/app/projets/${projectId}/kit`);
}
