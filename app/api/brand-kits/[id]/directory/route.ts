import type { NextResponse } from "next/server";
import {
  authenticate,
  generationErrorResponse,
  json,
  notFound,
  serverError,
  stateNotOpenResponse,
} from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { createAdminClient } from "@/lib/supabase/server";
import { loadBrandKit } from "@/lib/data/brand-kit";
import { readCatalog } from "@/lib/catalog/read";
import { isBrandKitEntitled } from "@/lib/billing/entitlements";
import { surfaceAccess } from "@/lib/billing/surface-access";
import { resolveEntitledTier } from "@/lib/billing/entitlements";
import {
  DirectoryCeilingError,
  DirectoryProseClicheError,
  DirectoryUnbackedCredentialError,
  DirectoryProseInvalidError,
  DirectoryProseRefusedError,
  generateDirectoryProfile,
} from "@/lib/directory/generate";
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

/*
 * ── LES DEUX PHRASES DE REFUS, ÉCRITES UNE SEULE FOIS ───────────────────
 *
 * ⚠ CHACUNE SORT PAR DEUX CHEMINS : le pré-scan de `generateDirectoryProfile`,
 * et le trigger `directory_profiles_ethics_gate` si les deux gardes divergent.
 * Deux textes pour un même `code` briseraient la règle que ce fichier tient —
 * un code, une phrase — et `directory-route.test.ts` le refuse.
 *
 * ⚠ ET AUCUNE NE COMPTE LES ESSAIS. Le premier jet disait « nous l'avons écrit
 * DEUX FOIS » ; c'est faux sur le chemin de la base, où un brouillon accepté du
 * premier coup par le pré-scan peut être refusé à l'écriture. Une phrase vraie
 * sur un seul de ses deux chemins est une phrase fausse.
 */
function clicheRefusal(phrases: string): NextResponse {
  return json(
    {
      error: `We wrote it, and it came back leaning on wording that every other profile in this directory already uses (${phrases}). Nothing was saved — your own answers are untouched. Write it again, or add a line to "How you work" to give us something more specific to write from.`,
      code: "cliche_refused",
    },
    { status: 422 }
  );
}

/*
 * ⚠ LE MESSAGE NOMME LA CLAUSE ET CE QU'ELLE PEUT EN FAIRE. Un refus qui ne
 * dit pas quoi corriger est une panne du point de vue de celle qui le lit :
 * elle recliquera, et recliquer ne changera rien. Les deux issues sont
 * nommées parce qu'elles sont réellement deux — ajouter le titre au brief s'il
 * est à elle, relancer sans s'il ne l'est pas.
 *
 * ⚠ ET CE REFUS N'EST PAS DE SA FAUTE. C'est NOTRE garde qui a refusé NOTRE
 * texte ; la phrase ne doit donc ni l'accuser ni s'excuser d'une panne qui
 * n'en est pas une.
 */
function unbackedRefusal(claims: string): NextResponse {
  return json(
    {
      error: `We wrote ${claims} into your statement, and your brief does not carry it. We will not publish a credential we cannot trace to what you told us, so nothing was saved. If the title is yours, add it to your brief and write it again; if it is not, write it again and we will leave it out.`,
      code: "unbacked_credential",
    },
    { status: 422 }
  );
}

function ethicsRefusal(): NextResponse {
  return json(
    {
      error:
        'We wrote it, and it made a claim we will not publish under a clinical licence. Nothing was saved — your own answers are untouched. Adding a line to "How you work" usually gives us something more specific to write from.',
      code: "ethics_refused",
    },
    { status: 422 }
  );
}

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

    /*
     * ⚠ LA GARDE D'ÉTAT, QUI MANQUAIT ICI — ET C'EST LA ROUTE OÙ ELLE MANQUAIT
     * LE PLUS. `20260915101137` a posé « un État dont les couples ne sont pas
     * vérifiés n'est pas vendable », et `POST /api/briefs/[id]/generate` la
     * posait. Celle-ci, non : zéro appel à `project_state_is_sellable` dans
     * tout `app/api` hors de l'autre route. Or c'est ELLE qui écrit le profil
     * Psychology Today — l'artefact le plus public du produit, celui qui porte
     * le titre d'exercice devant des gens qui cherchent une thérapeute.
     *
     * Le trou ne s'est pas vu parce que rien ne testait cette route. Pendant
     * qu'aucun État n'était relevé, une panne le masquait ; le jour où la
     * Californie s'est ouverte, il serait devenu un titre imprimé pour une
     * juridiction non vérifiée.
     *
     * ⚠ LA BASE EST L'AUTORITÉ. `project_state_is_sellable` vit à côté des
     * lignes qu'elle compte ; recopier ici son « toutes portent verified_at »
     * serait une seconde définition de « ouvert ».
     *
     * ⚠ ET UNE ERREUR DE LECTURE REFUSE. Un droit qu'on n'a pas pu vérifier
     * n'est pas un droit accordé : le pire d'un refus injustifié est un message
     * de trop, le pire de l'inverse est un credential faux sur une page
     * publique. C'est la règle de `20260915101137`, appliquée au bon endroit.
     */
    const { data: sellable, error: sellableError } = await supabase.rpc(
      "project_state_is_sellable",
      { p_project_id: kit.projectId }
    );
    if (sellableError) {
      console.error("[api] directory: project_state_is_sellable", sellableError);
    }
    if (sellableError || sellable !== true) {
      return stateNotOpenResponse(bundle.brief.state);
    }

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
    /*
     * ⚠ UN REFUS DE LA BASE N'EST PAS UNE PANNE DE LA BASE, et ce fichier les
     * a confondus jusqu'au 19 septembre. Le bloc `catch` plus bas avait été
     * corrigé pour cette distinction exacte ; CETTE ligne-ci, qui est l'endroit
     * où le refus arrive RÉELLEMENT, renvoyait encore `serverError` — donc un
     * 500 et « Something didn't go through on our side. Your answers are
     * saved. » devant quelqu'un dont rien n'était tombé.
     *
     * Mesuré en production : deux `save_directory_profile` à 400, sqlstate
     * 23514, « Directory cliche: you deserve », levé par
     * `directory_profiles_ethics_gate`. Elle a lu « c'est de notre faute » et
     * a recliqué ; recliquer ne pouvait rien changer.
     *
     * ⚠ `23514` EST LE SEUL CODE TRAITÉ AINSI. C'est celui des deux `raise` du
     * trigger, et de rien d'autre sur ce chemin. Tout le reste — une panne de
     * connexion, un droit manquant, une contrainte qu'on n'a pas prévue — reste
     * une panne et garde le message générique, sinon celui-ci cesse de vouloir
     * dire quelque chose.
     */
    if (error) {
      if (error.code === "23514") {
        console.error("[api] directory: la base a refusé l'écriture", error.message);
        return error.message.startsWith("Directory cliche")
          ? clicheRefusal(error.message.replace(/^Directory cliche:\s*/, "").trim())
          : ethicsRefusal();
      }
      return serverError("POST /api/brand-kits/[id]/directory", error);
    }

    return json({ ok: true, modelCalls: result.modelCalls });
  } catch (error) {
    /*
     * ⚠ UN REFUS N'EST PAS UNE PANNE, et le premier jet de ce fichier les
     * confondait. Il disait « c'est juste : de son côté, ce sont trois façons
     * pour la même chose de ne pas avoir marché ». C'était faux : « nous
     * n'avons pas réussi à l'écrire sans enfreindre une règle » et « notre
     * serveur est tombé » n'appellent pas la même action de sa part, et le
     * second fait ouvrir un ticket pour un produit qui fonctionne.
     */
    if (error instanceof DirectoryProseRefusedError) {
      console.error("[api] directory: refus déontologique", error.violations);
      return ethicsRefusal();
    }

    /*
     * ⚠ UN CLICHÉ N'EST PAS UNE INFRACTION DÉONTOLOGIQUE. Le message ne doit
     * pas lui faire craindre pour sa licence quand ce qui manque est une
     * phrase moins usée — et il nomme les formules, sans quoi « réécrivez »
     * est un ordre sans objet.
     */
    if (error instanceof DirectoryUnbackedCredentialError) {
      console.error("[api] directory: credential infondé", error.claims);
      return unbackedRefusal(error.claims.map((c) => `"${c}"`).join(", "));
    }

    if (error instanceof DirectoryProseClicheError) {
      console.error("[api] directory: clichés d'annuaire", error.phrases);
      return clicheRefusal(error.phrases.join(", "));
    }

    if (error instanceof DirectoryProseInvalidError) {
      console.error("[api] directory: gabarit non respecté", error.problems);
      return json(
        {
          error:
            "The draft came back the wrong length twice, so we did not save it rather than cut a sentence in half on a public profile. Try again.",
          code: "prose_invalid",
        },
        { status: 422 }
      );
    }

    if (error instanceof DirectoryCeilingError) {
      console.error("[api] directory: plafond atteint", error.limit);
      return json(
        {
          error: "We stopped after two attempts. Nothing further was spent. Try again.",
          code: "ceiling_reached",
        },
        { status: 429 }
      );
    }

    /*
     * `generationErrorResponse` distingue « non configuré », « refus du
     * modèle » et « panne » en trois phrases. Ce qui tombe ici est une vraie
     * panne — et doit le rester, sinon le message générique cesse de vouloir
     * dire quelque chose.
     */
    return generationErrorResponse("POST /api/brand-kits/[id]/directory", error);
  }
}
