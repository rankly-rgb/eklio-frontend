import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { authorizeCron } from "@/lib/api/cron";
import { readCatalog } from "@/lib/catalog/read";
import { parseDirections, parseVoiceGuide } from "@/lib/data/brand-kit";
import { monthKey, monthLabel } from "@/lib/data/calendar";
import { isEntitledToMonthlyPresence } from "@/lib/billing/entitlements";
import { planMonth, type MonthlySlot } from "@/lib/generation/monthly";
import { monthReadyEmail } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/transport";
import { canSend, parseEmailState, recordSend } from "@/lib/email/state";
import { track } from "@/lib/analytics";

/*
 * Le run mensuel — le 1er à 00:00 America/New_York.
 *
 * L'HEURE DU CRON EST EN UTC, et c'est un piège. Le §7 demande minuit à New
 * York : `0 5 1 * *` (05:00 UTC) tombe à 00:00 EST l'hiver et 01:00 EDT
 * l'été — toujours le 1er là-bas. `0 4 1 * *` semblerait plus juste en été,
 * mais l'hiver il tomberait à 23:00 EST le DERNIER jour du mois précédent, et
 * `monthKey()` — qui lit l'heure de New York — remplirait alors le mois qui
 * vient de finir.
 *
 * IL VIT ICI, PAS EN BASE : il appelle un modèle, ce que Postgres ne fait pas.
 * `ensure_month_skeleton` pose les seize créneaux ; le remplissage des titres
 * et des légendes est le travail de ce dépôt.
 *
 * IDEMPOTENT DES DEUX CÔTÉS. `ensure_month_skeleton` l'est déjà (`on conflict
 * do nothing`). Le remplissage l'est aussi : on ne touche QUE les créneaux
 * dont le titre manque encore. Un cron rejoué, ou déclenché deux fois, ne
 * réécrit pas le mois de quelqu'un et ne repaie pas une génération.
 *
 * LE DROIT PASSE PAR LA FONCTION UNIQUE. `ensure_month_skeleton` décide de
 * l'ouverture sur `status in ('active','trialing')` — la base ne tient aucune
 * horloge, donc elle IGNORE la grâce de trois jours sur `past_due`. On la
 * rattrape ici : un praticien dans sa grâce voit son mois s'ouvrir, comme le
 * §7 l'exige.
 */

export const maxDuration = 300;

type UserRow = { user_id: string };

export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  const admin = createAdminClient();
  const month = monthKey(new Date());
  const label = monthLabel(month);

  const catalog = await readCatalog(admin);

  // Tout praticien qui a un kit — c'est le kit qui donne une identité dans
  // laquelle décliner le mois.
  const { data: kits, error } = await admin
    .from("brand_kits")
    .select("id, project_id, directions, selected_direction_id, voice_guide, projects!inner(user_id)")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[cron/monthly] lecture des kits", error);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }

  const results: { userId: string; created: number; filled: number }[] = [];
  /*
   * Un praticien peut avoir plusieurs projets, donc plusieurs kits.
   * `ensure_month_skeleton` choisit lui-même le plus récent : traiter le même
   * utilisateur deux fois ne casserait rien (tout est idempotent), mais ferait
   * deux lectures et deux résolutions de compte pour rien.
   */
  const seen = new Set<string>();

  for (const kit of kits ?? []) {
    const userId = (kit.projects as unknown as UserRow).user_id;
    if (seen.has(userId)) continue;
    seen.add(userId);

    try {
      const created = await ensureMonth(admin, userId, month);
      const filled = await fillMonth({
        admin,
        userId,
        month,
        monthName: label,
        kit,
        rules: catalog.ethicsRules,
      });
      await notify(admin, userId, month, label);
      results.push({ userId, created, filled });
    } catch (cause) {
      // Un praticien qui échoue ne doit pas emporter le mois des autres.
      console.error(`[cron/monthly] utilisateur ${userId}`, cause);
    }
  }

  return NextResponse.json({ month, users: results.length, results });
}

async function ensureMonth(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  month: string
): Promise<number> {
  const { data, error } = await admin.rpc("ensure_month_skeleton", {
    p_user_id: userId,
    p_month: month,
  });
  if (error) throw new Error(`ensure_month_skeleton : ${error.message}`);

  /*
   * La grâce de trois jours, rattrapée. La base a verrouillé le mois d'un
   * `past_due` ; notre règle unique dit qu'il y a encore droit.
   */
  const { data: subscription } = await admin
    .from("subscriptions")
    .select("status, current_period_end, cancel_at_period_end, stripe_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();

  const entitled = isEntitledToMonthlyPresence(
    subscription
      ? {
          status: subscription.status,
          currentPeriodEnd: subscription.current_period_end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          stripeSubscriptionId: subscription.stripe_subscription_id,
        }
      : null
  );

  if (entitled) {
    const { error: unlockError } = await admin
      .from("monthly_presence_content")
      .update({ status: "draft" })
      .eq("user_id", userId)
      .eq("month", month)
      .eq("status", "locked");
    if (unlockError) {
      console.error("[cron/monthly] ouverture de la grâce", unlockError);
    }
  }

  return data ?? 0;
}

async function fillMonth({
  admin,
  userId,
  month,
  monthName,
  kit,
  rules,
}: {
  admin: ReturnType<typeof createAdminClient>;
  userId: string;
  month: string;
  monthName: string;
  kit: {
    directions: unknown;
    selected_direction_id: string | null;
    voice_guide: unknown;
  };
  rules: Awaited<ReturnType<typeof readCatalog>>["ethicsRules"];
}): Promise<number> {
  const directions = parseDirections(kit.directions);
  const direction =
    directions?.find((entry) => entry.id === kit.selected_direction_id) ??
    directions?.[0] ??
    null;

  // Sans direction retenue, il n'y a pas d'identité dans laquelle décliner.
  if (!direction) return 0;

  const { data: rows, error } = await admin
    .from("monthly_presence_content")
    .select("id, type, day_of_month, status, title")
    .eq("user_id", userId)
    .eq("month", month)
    .order("day_of_month");

  if (error) throw new Error(`lecture du mois : ${error.message}`);

  // L'IDEMPOTENCE : seuls les créneaux encore sans titre sont écrits.
  const pending = (rows ?? []).filter((row) => row.title === null);
  if (pending.length === 0) return 0;

  const { data: practice } = await admin
    .from("project_briefs")
    .select("practice_name")
    .eq("project_id", (kit as { project_id?: string }).project_id ?? "")
    .maybeSingle();

  const slots: MonthlySlot[] = pending.map((row) => ({
    id: row.id,
    type: row.type as "post" | "story",
    day_of_month: row.day_of_month,
    locked: row.status === "locked",
  }));

  const content = await planMonth({
    monthName,
    practiceName: practice?.practice_name ?? null,
    direction,
    voiceGuide: parseVoiceGuide(kit.voice_guide),
    slots,
    rules,
  });

  let filled = 0;
  for (const item of content) {
    const slot = slots.find((entry) => entry.id === item.id);
    const { error: writeError } = await admin
      .from("monthly_presence_content")
      .update({
        title: item.title,
        caption: item.caption,
        // Un créneau ouvert et rempli est prêt ; un verrouillé le reste.
        ...(slot?.locked ? {} : { status: "ready" }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id)
      // Deuxième filet d'idempotence : si un autre run a rempli entretemps,
      // celui-ci n'écrase rien.
      .is("title", null);

    if (writeError) {
      console.error("[cron/monthly] écriture d'un créneau", writeError);
      continue;
    }
    filled += 1;
  }

  return filled;
}

/** L'e-mail du 1er, sous le plafond des 72 h et hors désinscrits. */
async function notify(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  month: string,
  monthName: string
): Promise<void> {
  const { data: account } = await admin.auth.admin.getUserById(userId);
  const user = account?.user;
  if (!user?.email) return;

  const state = parseEmailState(user.user_metadata);
  if (!canSend(state, "month_ready")) return;

  const { data: ready } = await admin
    .from("monthly_presence_content")
    .select("title, status")
    .eq("user_id", userId)
    .eq("month", month)
    .neq("status", "locked")
    .order("day_of_month")
    .limit(1)
    .maybeSingle();

  const { data: locked } = await admin
    .from("monthly_presence_content")
    .select("id")
    .eq("user_id", userId)
    .eq("month", month)
    .eq("status", "locked")
    .limit(1);

  const email = monthReadyEmail({
    to: user.email,
    userId,
    monthName,
    entitled: (locked ?? []).length === 0,
    readyTitle: ready?.title ?? null,
  });

  const outcome = await sendEmail(email);
  if (outcome.ok) {
    await recordSend(admin, userId, user.user_metadata, "month_ready");
    track("email_sent", { kind: "month_ready", delivered: outcome.delivered });
  } else {
    console.error("[cron/monthly] envoi e-mail", outcome.error);
  }
}
