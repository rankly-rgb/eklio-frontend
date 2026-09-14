import { authenticate, generationErrorResponse, json, notFound, serverError } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { createAdminClient } from "@/lib/supabase/server";
import { loadBrandKit } from "@/lib/data/brand-kit";
import { readCatalog } from "@/lib/catalog/read";
import { isBrandKitEntitled } from "@/lib/billing/entitlements";
import { surfaceAccess } from "@/lib/billing/surface-access";
import { resolveEntitledTier } from "@/lib/billing/entitlements";
import { generateDirectoryProfile } from "@/lib/directory/generate";
import { structuredInputFor } from "@/lib/data/directory";

/*
 * POST /api/brand-kits/[id]/directory — écrit la prose du profil Psychology
 * Today et la range par `save_directory_profile`.
 *
 * ⚠ OWNERSHIP D'ABORD, SERVICE-ROLE ENSUITE — la règle du contrat §9.6, la
 * même que `POST /api/briefs/[id]/usp-options`. `loadBrandKit` avec le client
 * de l'APPELANTE vérifie que ce kit est le sien ; `id` ne part vers
 * `createAdminClient()` qu'après. Le service-role est nécessaire parce que
 * `save_directory_profile` est réservée au job de génération
 * (`caller_is_the_database() or service_role`) — et c'est voulu : rien dans un
 * navigateur ne doit pouvoir écrire un profil.
 *
 * ⚠ ET LA GARDE DE PALIER EST LA MÊME QUE L'ÉCRAN. `kit_directory` exige
 * `foundation`. Sans cette ligne, une acheteuse Starter ne verrait pas la
 * section mais pourrait en déclencher la génération — une dépense modèle
 * ouverte à qui ne l'a pas achetée.
 */

export const maxDuration = 60;

/* Deux appels modèle au plus par génération : le plafond horaire est posé sur
   le nombre de GÉNÉRATIONS, pas sur les appels, pour la même raison que
   `usp-options`. */
const RATE_LIMIT = { limit: 10, windowMs: 60 * 60 * 1000 };

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authenticate();
  if (!auth.ok) return auth.response;

  const { supabase, userId } = auth.session;
  const { id } = await context.params;

  const verdict = rateLimit(`directory:${userId}`, RATE_LIMIT);
  if (!verdict.allowed) {
    return json(
      { error: "That's a lot of rewrites at once. Give it a minute." },
      { status: 429, headers: { "retry-after": String(verdict.retryAfterSeconds) } }
    );
  }

  const kit = await loadBrandKit(supabase, id, userId);
  // Kit inexistant OU appartenant à quelqu'un d'autre : la même réponse.
  if (!kit) return notFound();

  if (!(await isBrandKitEntitled(supabase, id))) {
    return json({ error: "This kit is not unlocked yet." }, { status: 402 });
  }

  const gate = surfaceAccess(
    "kit_directory",
    await resolveEntitledTier(supabase, kit.projectId)
  );
  if (!gate.ok) {
    return json(
      { error: "Your directory profile comes with The Foundation." },
      { status: 402 }
    );
  }

  try {
    const catalog = await readCatalog(supabase);
    const { bundle, structured } = await structuredInputFor(
      supabase,
      kit.projectId,
      catalog
    );
    if (!bundle) return notFound();

    const result = await generateDirectoryProfile(bundle, catalog, structured);

    /*
     * ⚠ LA BASE TRANCHE, PAS CE FICHIER. Le trigger
     * `directory_profiles_ethics_gate` repasse les deux champs par
     * `ethics_blocks` ET par les trente clichés d'annuaire. Un refus arrive ici
     * comme une erreur Postgres — et c'est la bonne place : le pré-scan offre
     * une reprise, la base garantit qu'aucun profil interdit n'est rangé.
     */
    const admin = createAdminClient();
    const { error } = await admin.rpc("save_directory_profile", {
      p_brand_kit_id: id,
      p_platform: result.draft.platform,
      p_first_paragraph: result.draft.prose.firstParagraph,
      p_body: result.draft.prose.body,
      p_structured: result.draft.structured,
      p_ethics_check: result.ethicsCheck,
    });
    if (error) return serverError("POST /api/brand-kits/[id]/directory", error);

    return json({ ok: true, modelCalls: result.modelCalls });
  } catch (error) {
    /*
     * `generationErrorResponse` distingue déjà « non configuré », « refus du
     * modèle » et « panne » en trois phrases différentes. Les erreurs propres
     * à ce module (plafond, gabarit, déontologie) y tombent dans la branche
     * générique, ce qui est juste : de son côté à elle, ce sont trois façons
     * pour la même chose de ne pas avoir marché.
     */
    return generationErrorResponse("POST /api/brand-kits/[id]/directory", error);
  }
}
