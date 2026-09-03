import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { loadBrandKitByProject, type BrandKit } from "@/lib/data/brand-kit";
import { loadLaunchProgress, type LaunchProgress } from "@/lib/data/checklist";
import {
  EMPTY_CALENDAR,
  loadCalendar,
  monthKey,
  monthLabel,
  type CalendarSummary,
} from "@/lib/data/calendar";
import {
  getSubscription,
  isEntitledToMonthlyPresence,
  type Subscription,
} from "@/lib/billing/entitlements";

/*
 * L'agrégat de l'accueil (Écran 7) : une seule lecture pour la salutation, le
 * nudge, la carte de marque, la checklist et le contenu du mois.
 *
 * Il est lu par la page ET par `GET /api/home`. Une seule implémentation :
 * l'écran et la route ne peuvent pas diverger.
 */

type Client = SupabaseClient<Database>;

/**
 * AU PLUS UN nudge par écran (§5). L'ordre ci-dessous est une priorité, pas
 * une liste : ce qui est en haut gagne, et rien d'autre ne s'affiche.
 */
export type Nudge =
  | { kind: "resume-brief"; message: string; href: string; cta: string }
  | { kind: "choose-direction"; message: string; href: string; cta: string }
  | { kind: "site-ready"; message: string; href: string; cta: string }
  | { kind: "month-ready"; message: string; href: string; cta: string };

export type HomeModel = {
  /** Prénom pour la salutation, ou `null` : on dit alors « Good morning. ». */
  firstName: string | null;
  projectId: string | null;
  brandKit: BrandKit | null;
  briefProgressStep: number | null;
  briefStarted: boolean;
  checklist: LaunchProgress;
  calendar: CalendarSummary;
  monthKey: string;
  monthLabel: string;
  subscription: Subscription | null;
  entitled: boolean;
  nudge: Nudge | null;
};

export async function loadHome(
  supabase: Client,
  userId: string,
  now: Date = new Date()
): Promise<HomeModel> {
  const month = monthKey(now);

  const [{ data: profile }, { data: project }, subscription] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    /*
     * Le projet COURANT est le plus récemment touché. Le produit n'expose pas
     * de liste de projets : l'accueil parle d'UNE marque, celle sur laquelle on
     * travaille.
     */
    supabase
      .from("projects")
      .select("id, name, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getSubscription(supabase, userId),
  ]);

  const entitled = isEntitledToMonthlyPresence(subscription, now);
  const firstName = firstNameFrom(profile?.full_name);

  if (!project) {
    return {
      firstName,
      projectId: null,
      brandKit: null,
      briefProgressStep: null,
      briefStarted: false,
      checklist: { items: [], resolvedCount: 0, total: 0 },
      calendar: EMPTY_CALENDAR,
      monthKey: month,
      monthLabel: monthLabel(month),
      subscription,
      entitled,
      nudge: null,
    };
  }

  const [{ data: brief }, brandKit] = await Promise.all([
    supabase
      .from("project_briefs")
      .select("progress_step, completed_steps")
      .eq("project_id", project.id)
      .maybeSingle(),
    loadBrandKitByProject(supabase, project.id, userId),
  ]);

  const [checklist, calendar] = await Promise.all([
    brandKit
      ? loadLaunchProgress(supabase, brandKit.row.id)
      : Promise.resolve({ items: [], resolvedCount: 0, total: 0 }),
    brandKit ? loadCalendar(supabase, userId, month) : Promise.resolve(EMPTY_CALENDAR),
  ]);

  return {
    firstName,
    projectId: project.id,
    brandKit,
    briefProgressStep: brief?.progress_step ?? null,
    briefStarted: (brief?.completed_steps?.length ?? 0) > 0,
    checklist,
    calendar,
    monthKey: month,
    monthLabel: monthLabel(month),
    subscription,
    entitled,
    nudge: pickNudge({ project, brief, brandKit, calendar }),
  };
}

function pickNudge({
  project,
  brief,
  brandKit,
  calendar,
}: {
  project: { id: string };
  brief: { progress_step: number; completed_steps: number[] } | null;
  brandKit: BrandKit | null;
  calendar: CalendarSummary;
}): Nudge | null {
  // 1. Un brief commencé et pas fini prime sur tout : c'est la seule chose qui
  //    manque pour avoir une marque.
  if (!brandKit && brief) {
    const step = brief.progress_step;
    return {
      kind: "resume-brief",
      message:
        brief.completed_steps.length > 0
          ? `Your brief is waiting at step ${step} of 7.`
          : "Your brief is ready when you are.",
      href: `/app/briefs/${project.id}`,
      cta: brief.completed_steps.length > 0 ? "Pick up where I left off" : "Start my brief",
    };
  }

  // 2. Trois directions générées, aucune retenue.
  if (brandKit?.directions && !brandKit.selectedDirection) {
    return {
      kind: "choose-direction",
      message: "Three directions are ready. One of them sounds like you.",
      href: `/app/brand-kits/${brandKit.row.id}/reveal`,
      cta: "See them",
    };
  }

  /*
   * 3. Une direction retenue, et pas encore de contenu ce mois-ci : ce qui
   *    manque, c'est le site. Le nudge mène à l'ÉDITEUR, où la maquette et les
   *    instructions vivent ensemble — plus au bloc de prompt du kit, qui n'existe
   *    plus.
   *
   *    La condition est l'exact complément de celle du nudge suivant : les deux
   *    ne peuvent pas se disputer l'écran, et AU PLUS UN nudge reste la règle.
   */
  if (brandKit?.selectedDirection && calendar.ready_count === 0) {
    return {
      kind: "site-ready",
      message: "Your site instructions are ready. Shape them before you paste.",
      href: `/app/brand-kits/${brandKit.row.id}/site`,
      cta: "Open my site",
    };
  }

  // 4. Du contenu prêt ce mois-ci.
  if (brandKit && calendar.ready_count > 0) {
    const waiting = calendar.locked_count;
    return {
      kind: "month-ready",
      message:
        waiting > 0
          ? `This month's post is ready — ${spell(waiting)} more are waiting.`
          : "This month's content is ready.",
      href: "/app/content",
      cta: "See this month",
    };
  }

  return null;
}

/** L'accueil écrit les petits nombres en toutes lettres (Écran 7). */
function spell(count: number): string {
  const words = [
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
  ];
  return words[count] ?? String(count);
}

function firstNameFrom(fullName: string | null | undefined): string | null {
  const first = (fullName ?? "").trim().split(/\s+/)[0];
  return first || null;
}

/** « Good morning », « Good afternoon », « Good evening » — heure locale du serveur. */
export function greeting(firstName: string | null, now: Date = new Date()): string {
  const hour = now.getHours();
  const part =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return firstName ? `${part}, ${firstName}.` : `${part}.`;
}
