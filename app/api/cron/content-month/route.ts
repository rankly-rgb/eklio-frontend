import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/api/cron";
import { createAdminClient } from "@/lib/supabase/server";
import { ARMED_ENV_VAR, contentGenerationArmed } from "@/lib/content/generate/armed";
import { nextMonthKey } from "@/lib/content/generate/queue";
import { openAiTransport, spendMeter } from "@/lib/content/generate/openai";
import { selectDueMonths } from "@/lib/content/month/due";
import { serverDuePort } from "@/lib/content/month/server-ports";
import { MONTH_CAP_USD, orchestrateMonthForKit } from "@/lib/content/month/run-for-kit";
import { POSTS_PER_MONTH } from "@/lib/content/bank";

/*
 * ── LE REMPLISSAGE MENSUEL ──────────────────────────────────────────────
 *
 * Énumère les comptes dus pour le mois qui vient (`selectDueMonths`), puis fait
 * sortir un mois par compte par l'orchestrateur produit (`orchestrateMonthForKit`). Tout
 * ce qui refuse, tire, rédige, contrôle et publie est dans `lib/content/month/` ;
 * cette route n'est que la porte.
 *
 * ── ⚠ DEUX VERROUS, TOUJOURS ────────────────────────────────────────────
 *
 * `vercel.json` ne planifie pas cette route, et `CONTENT_GENERATION_ARMED` doit
 * valoir exactement `"true"` (voir `lib/content/generate/armed.ts`). Sans le
 * drapeau, elle répond 503 en nommant l'interrupteur, et rien n'est dépensé :
 * le déploiement de ce code ne change rien pour personne.
 *
 * ── ⚠ IDEMPOTENTE, PAR LA BASE ──────────────────────────────────────────
 *
 * Un compte servi (`proposed`, `approved`) n'est pas dû ; un mois en cours
 * reprend son journal (F71 : seulement s'il détient encore ses sujets) ; la clé
 * `content_months_kit_month_key` refuse un second mois. Deux déclenchements ne
 * font pas deux mois, et un déclenchement tué reprend au suivant.
 *
 * ── ⚠ UN COMPTE APRÈS L'AUTRE, ET PAS AU-DELÀ DU TEMPS ──────────────────
 *
 * Un mois prend deux à trois minutes. On n'en COMMENCE pas un nouveau quand le
 * temps restant ne suffit plus : le compte suivant attend le déclenchement
 * suivant, et la réponse le dit (`deferred`). Un mois coupé par la plateforme
 * n'est pas perdu — son journal le reprend — mais on ne le provoque pas.
 */

export const maxDuration = 300;

/**
 * On ne commence plus de mois passé ce délai. Mesuré : le mois de janvier local a
 * pris 127 s d'appels (58 appels, 2026-10-04), composition et assemblage en plus.
 */
const START_BUDGET_MS = 30_000;

type Served = {
  brandKitId: string;
  ok: boolean;
  stage?: string;
  refusal?: string;
  written?: number;
  costUsd: number;
};

export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  if (!contentGenerationArmed()) {
    return NextResponse.json(
      {
        armed: false,
        generated: 0,
        reason: `${ARMED_ENV_VAR} is not set to "true". Nothing was generated and nothing was spent.`,
      },
      { status: 503 }
    );
  }

  /*
   * ⚠ LA CLÉ AVANT TOUTE LECTURE. Armée sans clé, la route ne doit ni énumérer
   * ni ouvrir de mois : elle dirait « en cours » à des comptes que rien ne
   * remplira.
   */
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { armed: true, generated: 0, reason: "OPENAI_API_KEY is not set. Nothing was generated and nothing was spent." },
      { status: 503 }
    );
  }

  const started = Date.now();
  const month = nextMonthKey(new Date());
  const admin = createAdminClient();

  const { due, skipped } = await selectDueMonths(serverDuePort(admin as never), {
    month,
    posts: POSTS_PER_MONTH,
  });

  const transport = openAiTransport(key);
  const served: Served[] = [];
  const deferred: string[] = [];

  for (const account of due) {
    if (Date.now() - started > START_BUDGET_MS) {
      deferred.push(account.brandKitId);
      continue;
    }
    /* ⚠ UN COMPTEUR PAR COMPTE : le plafond d'un mois ne se partage pas. */
    const meter = spendMeter(MONTH_CAP_USD);
    try {
      const outcome = await orchestrateMonthForKit(admin as never, account, month, { transport, meter });
      served.push(
        outcome.ok
          ? { brandKitId: account.brandKitId, ok: true, written: outcome.month.written, costUsd: outcome.costUsd }
          : {
              brandKitId: account.brandKitId,
              ok: false,
              stage: outcome.stage,
              refusal: outcome.refusal,
              costUsd: outcome.costUsd,
            }
      );
    } catch (error) {
      /*
       * ⚠ UN COMPTE QUI LÈVE N'ARRÊTE PAS LES AUTRES, ET IL EST DIT. Ce qu'il a
       * payé est au journal et au compteur ; son mois reprendra au déclenchement
       * suivant.
       */
      served.push({
        brandKitId: account.brandKitId,
        ok: false,
        stage: "error",
        refusal: (error as Error).message,
        costUsd: meter.spentUsd(),
      });
    }
  }

  return NextResponse.json({
    armed: true,
    month,
    generated: served.filter((s) => s.ok).length,
    served,
    skipped,
    deferred,
  });
}
