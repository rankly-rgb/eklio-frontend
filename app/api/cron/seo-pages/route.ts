import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/api/cron";
import { createAdminClient } from "@/lib/supabase/server";
import { nextMonthKey } from "@/lib/content/generate/queue";
import { openAiTransport, spendMeter } from "@/lib/content/generate/openai";
import { SEO_ARMED_ENV_VAR, seoGenerationArmed } from "@/lib/seo/armed";
import { SEO_MONTH_CAP_USD } from "@/lib/seo/kinds";
import { openAiSeoWriter } from "@/lib/seo/writer";
import { runSeoMonthForUser, seoCandidateUsers } from "@/lib/seo/server-ports";

/*
 * ── LES PAGES SEO DU MOIS ───────────────────────────────────────────────
 *
 * Énumère les comptes à considérer, puis fait sortir le mois SEO de chacun :
 * contexte → plan (quota par la base) → claim_seo_slot → rédacteur → contrôles →
 * seo_pieces. Tout ce qui décide est dans `lib/seo/` ; cette route est la porte.
 *
 * ⚠ DEUX VERROUS (`lib/seo/armed.ts`) : absente de `vercel.json`, et
 * `SEO_GENERATION_ARMED` doit valoir exactement "true". Éteinte, elle répond 503
 * et rien n'est lu, réservé ni dépensé.
 *
 * ⚠ IDEMPOTENTE PAR LA BASE. Un second déclenchement le même mois trouve les
 * emplacements tenus (`quota_reached`) et n'écrit rien de plus.
 */

export const maxDuration = 300;

/** On ne commence plus une abonnée passé ce délai : la suivante attend le déclenchement suivant. */
const START_BUDGET_MS = 120_000;

export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  if (!seoGenerationArmed()) {
    return NextResponse.json(
      { armed: false, generated: 0, reason: `${SEO_ARMED_ENV_VAR} is not set to "true". Nothing was generated and nothing was spent.` },
      { status: 503 }
    );
  }
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
  const transport = openAiTransport(key);
  const runId = randomUUID();

  const served: unknown[] = [];
  const deferred: string[] = [];
  for (const userId of await seoCandidateUsers(admin)) {
    if (Date.now() - started > START_BUDGET_MS) {
      deferred.push(userId);
      continue;
    }
    /* ⚠ UN COMPTEUR PAR ABONNÉE : le plafond d'un mois ne se partage pas. */
    const meter = spendMeter(SEO_MONTH_CAP_USD);
    try {
      const outcome = await runSeoMonthForUser(admin, {
        userId,
        month,
        runId,
        writer: openAiSeoWriter({ transport, meter }),
      });
      served.push(
        outcome.ok
          ? {
              userId,
              ok: true,
              pieces: outcome.month.pieces.map((p) => ({
                kind: p.kind,
                intent: p.intentKey,
                status: p.status,
                attempts: p.attempts,
                firstPass: p.firstPass,
                costUsd: p.costUsd,
                checks: p.findings.map((f) => f.check),
                ...(p.detail ? { detail: p.detail } : {}),
              })),
              costUsd: outcome.month.costUsd,
              stopped: outcome.month.stopped,
            }
          : outcome.stage === "context"
            ? { userId, ok: false, stage: "context", reason: outcome.refusal.reason, detail: outcome.refusal.detail }
            : { userId, ok: false, stage: "quota", quota: outcome.plan.quota }
      );
    } catch (error) {
      /* Une abonnée qui lève n'arrête pas les autres, et c'est dit. */
      served.push({ userId, ok: false, stage: "error", reason: (error as Error).message, costUsd: meter.spentUsd() });
    }
  }

  return NextResponse.json({ armed: true, month, runId, served, deferred });
}
