import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, readJson, serverError } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { consumeAnonSpend } from "@/lib/anon/spend";
import { clientIp } from "@/lib/anon/token";
import { createAdminClient } from "@/lib/supabase/server";
import { readCatalog } from "@/lib/catalog/read";
import { CHECK_MAX_CHARS, CHECK_MIN_CHARS } from "@/lib/check/review";
import { rewriteFirstLine, FIRST_LINE_TARGET_CHARS } from "@/lib/check/first-line";
import { AnthropicNotConfiguredError } from "@/lib/ai/client";
import { track } from "@/lib/analytics";

/*
 * ══════════════════════════════════════════════════════════════════════════
 * POST /api/first-line — LE PALIER GRATUIT. NI COMPTE, NI KIT, NI ACHAT.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * « Collez votre profil Psychology Today actuel. On vous dit ce qui ne va pas,
 *   et on réécrit votre premier paragraphe. »
 *
 * ── CE QUE LE MUR GARDAIT, ET CE QUI LE REMPLACE ────────────────────────
 *
 * `/api/check` et `/api/check/rewrite` empilent CINQ portes, et la gratuité
 * les retire toutes les cinq. Chacune est nommée ici avec ce qui prend sa
 * place, parce qu'un mur retiré sans remplaçant est un trou :
 *
 *   1. `authenticate()` → 401                    remplacé par : RIEN. C'est
 *      l'objet du lot. Une inconnue colle un texte et reçoit une réponse.
 *
 *   2. `brandKitId` exigé dans le corps          remplacé par : RIEN. Elle
 *      n'a pas de kit. Le corps ne porte plus qu'un texte.
 *
 *   3. `loadBrandKit(...)` → 404                 remplacé par : RIEN. Il n'y
 *      a pas de ressource à posséder.
 *
 *   4. `isBrandKitEntitled(...)` → 402           remplacé par : RIEN, et
 *      c'est la porte qui définissait le palier. Elle reste sur les deux
 *      routes payantes, qui ne bougent pas.
 *
 *   5. `surfaceRefusal("ethics_rewrite", tier)`  remplacé par : RIEN ici.
 *      Cette garde dit « ce palier-ci n'y a pas droit » ; le palier gratuit
 *      y a droit par définition.
 *
 * ⚠ ET CE QUI LES REMPLACE TOUTES N'EST PAS RIEN — c'est un plafond d'un
 * autre genre. Les cinq portes ci-dessus répondaient à « qui es-tu ». Sans
 * compte, cette question n'a pas de réponse, et la seule qui reste est
 * « combien ». D'où `consumeAnonSpend`, plus bas.
 *
 * ⚠ `consume_check_rewrite` NE POUVAIT PAS SERVIR ICI, et c'est mesuré, pas
 * supposé : la fonction ne prend AUCUN argument et lit `auth.uid()`
 * (`20260909094038`). Sans session elle ne borne rien du tout. Le plafond
 * anonyme est l'autre, celui qui existe déjà pour le brief sans compte.
 *
 * ── SON TEXTE N'EST STOCKÉ NULLE PART ───────────────────────────────────
 *
 * Ni le texte collé, ni la réécriture : lus dans la requête, traités en
 * mémoire, répondus, oubliés. Aucune table, aucune ligne de journal, aucune
 * propriété d'analytics. Ce qui est compté est le nombre de constats et les
 * identifiants de règles — six chaînes fixes.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

/*
 * ⚠ UN PREMIER FILET EN MÉMOIRE, QUI N'EST PAS LE PLAFOND. Celui-ci est
 * par-processus — deux instances serverless comptent séparément et un
 * redéploiement l'efface. Il ralentit une rafale depuis une même adresse ; ce
 * qui BORNE est la ligne en base, juste après.
 */
const BURST = { limit: 6, windowMs: 10 * 60 * 1000 };

const bodySchema = z.object({
  text: z.string().trim().min(CHECK_MIN_CHARS).max(CHECK_MAX_CHARS),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return badRequest(
      `Paste between ${CHECK_MIN_CHARS} and ${CHECK_MAX_CHARS.toLocaleString("en-US")} characters — your profile's opening paragraph is enough.`
    );
  }
  const { text } = parsed.data;

  const burst = rateLimit(`first-line:${clientIp(request) ?? "unknown"}`, BURST);
  if (!burst.allowed) {
    return NextResponse.json(
      {
        error: "That's a lot of rewrites at once. Give it a minute.",
        code: "too_fast",
      },
      { status: 429, headers: { "retry-after": String(burst.retryAfterSeconds) } }
    );
  }

  /*
   * ⚠ LE PLAFOND, AVANT L'APPEL MODÈLE ET PARCE QU'IL Y EN AURA UN.
   * `spend.ts` dit de ne compter que quand le modèle sera réellement appelé —
   * ici il l'est toujours : contrairement à `rewriteAndRescan`, cette
   * réécriture ne part pas d'une infraction, donc rien ne la court-circuite.
   *
   * `assist` et pas `reveal` : c'est un appel texte court, du même ordre que
   * les cartes de ton et les options de positionnement, pas la révélation
   * complète d'une marque.
   *
   * ⚠ ET CE PLAFOND EST PARTAGÉ AVEC LE BRIEF. Une visiteuse qui a rempli un
   * brief anonyme aujourd'hui a déjà entamé les 45 de son IP. C'est un choix :
   * un compteur séparé doublerait la dépense maximale par adresse sans que
   * personne ne l'ait décidé. Le jour où le palier gratuit mérite sa propre
   * enveloppe, `consume_anon_generation` prend déjà un `p_kind`.
   */
  const refusal = await consumeAnonSpend("assist", request);
  if (refusal) return refusal;

  try {
    /*
     * Service-role : il n'y a pas d'appelante à qui emprunter une session, et
     * le catalogue est de la donnée de référence — les mêmes six règles pour
     * toutes. Rien de cette requête ne touche à la donnée de quiconque.
     */
    const catalog = await readCatalog(createAdminClient()).catch(() => null);

    /*
     * ⚠ UNE TABLE DE POSITIONNEMENT VIDE N'EST PAS UN DIAGNOSTIC AMPUTÉ EN
     * SILENCE. Sans ce refus, le palier gratuit retomberait exactement sur le
     * défaut qu'on répare : un profil irréprochable et générique recevrait
     * « rien », et rien ne dirait que la moitié du diagnostic n'a pas tourné.
     *
     * 503 et pas 422 : ce n'est PAS son texte, c'est notre catalogue. C'est le
     * seul cas de cette route, avec la clé absente, où « c'est de notre faute »
     * est la phrase juste.
     */
    if ((catalog?.positioningRules ?? []).length === 0) {
      console.error("[api] first-line: positioning_rules is empty");
      return NextResponse.json(
        {
          error:
            "Half of what we check is missing on our side right now, so we are not going to pretend we looked. Nothing is wrong with your profile — try again shortly.",
          code: "positioning_rules_missing",
        },
        { status: 503 }
      );
    }

    const outcome = await rewriteFirstLine(
      text,
      catalog?.ethicsRules ?? [],
      catalog?.licenseTypes ?? [],
      catalog?.degrees ?? [],
      undefined,
      undefined,
      undefined,
      catalog?.positioningRules ?? [],
      catalog?.positioningPatterns ?? []
    );

    /*
     * Un motif illisible remonte dans le journal. Il ne casse pas la réponse —
     * les autres constats restent vrais — mais il ne disparaît pas non plus.
     */
    if (outcome.positioningUnusable.length > 0) {
      console.error("[api] first-line: unusable positioning patterns", outcome.positioningUnusable);
    }

    // Identifiants de règles et compteurs. Jamais son texte, jamais un extrait.
    track("first_line_used", {
      findings: outcome.before.length,
      rules: outcome.before.map((finding) => finding.ruleId).join(","),
      positioning: outcome.positioning.length,
      positioningRules: outcome.positioning.map((finding) => finding.ruleId).join(","),
      attempts: outcome.attempts,
      resolved: outcome.resolved,
      refusal: outcome.refusal ?? "",
    });

    /*
     * ⚠ LE DIAGNOSTIC PART MÊME QUAND LA RÉÉCRITURE EST REFUSÉE, et il est la
     * moitié qu'on a promise. Le refus dit sa propre raison — aucun de ces
     * trois cas n'est une panne, et aucun ne doit se lire « c'est de notre
     * faute ».
     */
    if (outcome.rewritten === null) {
      return NextResponse.json(
        {
          findings: outcome.before,
          positioning: outcome.positioning,
          rewritten: null,
          targetChars: FIRST_LINE_TARGET_CHARS,
          error:
            outcome.refusal === "credential_introduced"
              ? "We wrote it twice and both drafts put a licence title in your profile that you had not written yourself. We will not hand you a credential we invented, so we kept nothing — but what we found in your own text is below and it stands."
              : outcome.refusal === "ethics"
                ? "We wrote it twice and both drafts made claims we will not publish under a clinical licence. Nothing was kept — but what we found in your own text is below and it stands."
                : "The model gave us nothing back just now. What we found in your own text is below; try the rewrite again in a moment.",
          code:
            outcome.refusal === "credential_introduced"
              ? "credential_introduced"
              : outcome.refusal === "ethics"
                ? "ethics_refused"
                : "rewrite_empty",
        },
        { status: outcome.refusal === "empty" ? 502 : 422 }
      );
    }

    return NextResponse.json({
      findings: outcome.before,
      positioning: outcome.positioning,
      rewritten: outcome.rewritten,
      after: outcome.after,
      attempts: outcome.attempts,
      targetChars: FIRST_LINE_TARGET_CHARS,
    });
  } catch (error) {
    if (error instanceof AnthropicNotConfiguredError) {
      return NextResponse.json(
        {
          error:
            "Rewrites aren't available right now — that's on us, not your profile. Your own text is untouched.",
          code: "generation_unavailable",
        },
        { status: 503 }
      );
    }
    return serverError("POST /api/first-line", error);
  }
}
