import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  loadBrandKitByProject,
  listDeletedBrandKits,
  type BrandKit,
  type DeletedBrandKit,
} from "@/lib/data/brand-kit";
import { loadLaunchProgress, type LaunchProgress, type LaunchStep } from "@/lib/data/checklist";
import {
  EMPTY_CONTENT_MONTH,
  contentMonthKey,
  contentMonthMono,
  getContentMonth,
  type ContentItem,
  type ContentMonth,
} from "@/lib/data/content";
import {
  getSubscription,
  isEntitledToMonthlyPresence,
  type Subscription,
} from "@/lib/billing/entitlements";
import { siteSpecGet } from "@/lib/site/rpc";
import { practiceDetailsFrom, bookingUrlFrom } from "@/lib/kit/launch-context";
import type { LaunchStepContext } from "@/components/checklist/launch-checklist";
import type { SiteHero, SitePreviewTokens } from "@/lib/site/types";
import { loadImageContext } from "@/lib/images/context";
import { computeImageFingerprint } from "@/lib/images/fingerprint";
import { getBrandImages } from "@/lib/images/rpc";
import {
  syncNotifications,
  notificationLine,
  type Notification,
} from "@/lib/data/notifications";

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
  /** Her own editorial month, the SAME rows /app/content renders. */
  month: ContentMonth;
  monthKey: string;
  monthLabel: string;
  subscription: Subscription | null;
  entitled: boolean;
  nudge: Nudge | null;
  /** Recently deleted kits still inside their 30-day window, this user's own. */
  deletedKits: DeletedBrandKit[];
};

export async function loadHome(
  supabase: Client,
  userId: string,
  now: Date = new Date()
): Promise<HomeModel> {
  const month = contentMonthKey(now);

  const [{ data: profile }, { data: project }, subscription, deletedKits] = await Promise.all([
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
    // Not scoped to the current project: a kit can be deleted from any of
    // her projects, and "Recently deleted" is account-level housekeeping,
    // not tied to whichever one is most recently touched.
    listDeletedBrandKits(supabase),
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
      month: EMPTY_CONTENT_MONTH,
      monthKey: month,
      monthLabel: contentMonthMono(month),
      subscription,
      entitled,
      nudge: null,
      deletedKits,
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

  const [checklist, contentMonth] = await Promise.all([
    brandKit
      ? loadLaunchProgress(supabase, brandKit.row.id)
      : Promise.resolve({ items: [], resolvedCount: 0, total: 0 }),
    /*
     * The one month model. A refusal -- an unpaid kit, a kit that is not hers
     * -- degrades to the empty month rather than failing home: the rest of
     * this screen is still true, and the checkout offer lives on the cards
     * that sell it.
     */
    brandKit
      ? getContentMonth(supabase, brandKit.row.id, month).then((result) =>
          result.ok ? result.data : EMPTY_CONTENT_MONTH
        )
      : Promise.resolve(EMPTY_CONTENT_MONTH),
  ]);

  return {
    firstName,
    projectId: project.id,
    brandKit,
    briefProgressStep: brief?.progress_step ?? null,
    briefStarted: (brief?.completed_steps?.length ?? 0) > 0,
    checklist,
    month: contentMonth,
    monthKey: month,
    monthLabel: contentMonthMono(month),
    subscription,
    entitled,
    nudge: pickNudge({ project, brief, brandKit, month: contentMonth }),
    deletedKits,
  };
}

function pickNudge({
  project,
  brief,
  brandKit,
  month,
}: {
  project: { id: string };
  brief: { progress_step: number; completed_steps: number[] } | null;
  brandKit: BrandKit | null;
  month: ContentMonth;
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
  if (brandKit?.selectedDirection && month.counts.ready === 0) {
    return {
      kind: "site-ready",
      message: "Your site instructions are ready. Shape them before you paste.",
      href: `/app/brand-kits/${brandKit.row.id}/site`,
      cta: "Open my site",
    };
  }

  // 4. Du contenu prêt ce mois-ci.
  if (brandKit && month.counts.ready > 0) {
    /*
     * `locked_count` is gone with the old model: nothing in `content_items` is
     * withheld from her. What is worth naming instead is what is still in
     * draft -- a number she can act on, and one the database counted.
     */
    const drafts =
      month.items.filter((item) => item.status === "draft").length +
      month.unscheduled.filter((item) => item.status === "draft").length;
    return {
      kind: "month-ready",
      message:
        drafts > 0
          ? `${spell(month.counts.ready)} ready to post, ${spell(drafts)} still in draft.`
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

/*
 * ── THE HOME CANVAS — "your practice this week" ─────────────────────────
 *
 * `loadHome` above stays the shared aggregate: the page, `GET /api/home`, and
 * five other routes read it for one thing (`brandKit`) or a handful, and it
 * must not grow heavier for all of them because the home SCREEN wants more.
 * That is why this is a second function rather than a bigger `loadHome` --
 * "the screen and the route cannot diverge" is about `loadHome` itself, and
 * this does not touch that contract.
 *
 * Everything below is COMPOSITION: no migration, no new table, no model
 * call. The site spec, the launch checklist, the month and the notifications
 * all already exist; this reads them once each and shapes what the home
 * screen's six pieces need.
 */

const HOME_PHOTO_URL_TTL_SECONDS = 300;
const NEXT_ITEM_HORIZON_DAYS = 3;
const SINCE_ROW_LIMIT = 3;

export type NextAction =
  | { kind: "launch_step"; step: LaunchStep; context: LaunchStepContext }
  | { kind: "content_item"; item: ContentItem; photoUrl: string | null }
  | { kind: "none" };

export type WeekDay = {
  key: string;
  label: string;
  hasContent: boolean;
  isToday: boolean;
};

export type SinceRow = {
  id: string;
  href: string;
  text: string;
};

export type HomeCanvas = {
  tokens: SitePreviewTokens;
  hero: SiteHero;
  heroPhotoUrl: string | null;
  /** Her real, enabled page labels, in `envelope.preview.pages` order. */
  pages: string[];
  next: NextAction;
  week: WeekDay[];
  since: SinceRow[];
};

/**
 * Everything the home screen's hero, "Next", week strip and "Since you were
 * here" need, or `null` when there is no kit with a chosen direction yet --
 * the states before that keep today's simpler prompt cards, because none of
 * this (a site to render, a checklist to work through, a month to read) exists
 * for them yet.
 */
export async function loadHomeCanvas(
  supabase: Client,
  home: HomeModel,
  now: Date = new Date()
): Promise<HomeCanvas | null> {
  const kit = home.brandKit;
  if (!kit || !kit.selectedDirection) return null;

  const siteSpec = await siteSpecGet(supabase, kit.row.id);
  if (!siteSpec.ok) return null;

  const { spec, preview } = siteSpec.data;

  const [photoUrls, notifications] = await Promise.all([
    currentBrandImageUrls(supabase, kit),
    syncNotifications(supabase, kit.row.id),
  ]);

  const launchContext: LaunchStepContext = {
    practiceName: kit.practiceName,
    practitionerLine: kit.row.practitioner_line,
    aboutExcerpt: kit.selectedDirection.about_excerpt,
    practiceDetails: practiceDetailsFrom(spec),
    bookingUrl: bookingUrlFrom(spec),
    assetsHref: `/app/brand-kits/${kit.row.id}/assets`,
    siteHref: `/app/brand-kits/${kit.row.id}/site`,
  };

  const todayKey = nyDateKey(now);

  return {
    tokens: preview.tokens,
    hero: spec.hero,
    heroPhotoUrl: photoUrls.get("hero") ?? null,
    pages: preview.pages.map((page) => page.label),
    next: pickNextAction({
      checklist: home.checklist,
      month: home.month,
      todayKey,
      launchContext,
      photoUrlFor: (slot) => photoUrls.get(slot) ?? null,
    }),
    week: buildWeekStrip(home.month, todayKey),
    since: buildSinceRows({ kit, month: home.month, notifications }),
  };
}

/**
 * Every current, ready photograph's signed read URL, by slot.
 *
 * The exact read pattern `app/api/brand-kits/[id]/images/route.ts` and
 * `app/app/content/[id]/page.tsx` already use -- `loadImageContext` then
 * `computeImageFingerprint` then `getBrandImages` -- reused here rather than
 * imported as a shared helper, because `lib/images/` is not touched by this
 * lot. One fetch covers every slot the home screen might need (the hero, and
 * whichever slot the "Next" content item names) instead of guessing which
 * ones to sign ahead of knowing that.
 */
async function currentBrandImageUrls(
  supabase: Client,
  kit: BrandKit
): Promise<Map<string, string>> {
  const context = await loadImageContext(supabase, kit);
  if (!context.ok) return new Map();

  const rows = await getBrandImages(supabase, kit.row.id, computeImageFingerprint(context.input));
  const current = rows.filter((row) => row.current && row.storage_path);

  const urls = new Map<string, string>();
  await Promise.all(
    current.map(async (row) => {
      const signed = await supabase.storage
        .from("brand-assets")
        .createSignedUrl(row.storage_path as string, HOME_PHOTO_URL_TTL_SECONDS);
      if (signed.data?.signedUrl) urls.set(row.slot, signed.data.signedUrl);
    })
  );
  return urls;
}

/**
 * ONE thing to do, chosen by rule, never a list:
 *
 *   1. the next launch step that is neither done nor skipped;
 *   2. otherwise the next content item scheduled within three days that she
 *      has not yet posted;
 *   3. otherwise nothing.
 *
 * `checklist.items` is already in the database's own order (`sort_order`),
 * the same order `/app/launch` itself walks -- this picks the same step that
 * screen would open on.
 */
export function pickNextAction(params: {
  checklist: LaunchProgress;
  month: ContentMonth;
  todayKey: string;
  launchContext: LaunchStepContext;
  photoUrlFor: (slot: string) => string | null;
}): NextAction {
  const nextStep = params.checklist.items.find((item) => item.status === "todo");
  if (nextStep) {
    return { kind: "launch_step", step: nextStep, context: params.launchContext };
  }

  const horizon = addDaysToKey(params.todayKey, NEXT_ITEM_HORIZON_DAYS);
  const dated = params.month.items
    .filter(
      (item): item is ContentItem & { scheduled_for: string } =>
        !item.posted &&
        item.scheduled_for !== null &&
        item.scheduled_for >= params.todayKey &&
        item.scheduled_for <= horizon
    )
    .sort((a, b) => (a.scheduled_for < b.scheduled_for ? -1 : 1));

  const nextItem = dated[0];
  if (nextItem) {
    return {
      kind: "content_item",
      item: nextItem,
      photoUrl: nextItem.image_slot ? params.photoUrlFor(nextItem.image_slot) : null,
    };
  }

  return { kind: "none" };
}

/**
 * Seven days, Sunday through Saturday, containing `todayKey`. `hasContent`
 * reads `scheduled_for` off the ALREADY-LOADED month -- the one line of
 * composition the week strip needed, per the brief.
 *
 * ⚠ Known, deliberate gap: `home.month` is scoped to the CALENDAR MONTH
 * `todayKey` falls in (`get_content_month`), so a week that spans a month
 * boundary can under-count the day or two that belong to the adjacent month.
 * A second `get_content_month` call would close it; this lot does not add
 * one. Logged in FINDINGS.md rather than silently accepted.
 */
export function buildWeekStrip(month: ContentMonth, todayKey: string): WeekDay[] {
  const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
  const weekday = new Date(`${todayKey}T12:00:00Z`).getUTCDay();
  const start = addDaysToKey(todayKey, -weekday);

  return DAY_LETTERS.map((label, index) => {
    const key = addDaysToKey(start, index);
    return {
      key,
      label,
      hasContent: month.items.some((item) => item.scheduled_for === key),
      isToday: key === todayKey,
    };
  });
}

/**
 * At most three rows, notifications first among equals: the retired
 * "Your site instructions are ready" top banner folds in here, under the
 * SAME condition that used to raise it (`pickNudge`'s "site-ready" case) --
 * one fewer bar competing with the hero above the fold, not a new rule.
 */
export function buildSinceRows(params: {
  kit: BrandKit;
  month: ContentMonth;
  notifications: Notification[];
}): SinceRow[] {
  const rows: SinceRow[] = [];

  if (params.kit.selectedDirection && params.month.counts.ready === 0) {
    rows.push({
      id: "site-ready",
      href: `/app/brand-kits/${params.kit.row.id}/site`,
      text: "Your site instructions are ready. Shape them before you paste.",
    });
  }

  for (const notification of params.notifications) {
    if (rows.length >= SINCE_ROW_LIMIT) break;
    rows.push({
      id: notification.id,
      href: hrefForNotification(params.kit.row.id, notification),
      text: notificationLine(notification),
    });
  }

  return rows.slice(0, SINCE_ROW_LIMIT);
}

/**
 * Where a notification's own subject lives.
 *
 * ⚠ `content_ready`'s `payload.item_id` is a `monthly_presence_content` id --
 * that notification kind reads from the table `content_items` superseded
 * (Session 5, `one-month-model.test.ts`). It can only exist for rows synced
 * before that table went dead, and treating `item_id` as a `content_items`
 * id would 404. Routed to the calendar instead of the specific item; see
 * FINDINGS.md.
 */
export function hrefForNotification(brandKitId: string, notification: Notification): string {
  switch (notification.kind) {
    case "asset_rendered": {
      const key =
        typeof notification.payload.key === "string" ? notification.payload.key : null;
      return key
        ? `/app/brand-kits/${brandKitId}/assets?keys=${key}`
        : `/app/brand-kits/${brandKitId}/assets`;
    }
    case "site_stale":
      return `/app/brand-kits/${brandKitId}/site`;
    case "content_ready":
      return "/app/content";
    default:
      return "/app";
  }
}

/** `2026-09-06` for `date`, in the product's own time zone (see `contentMonthKey`). */
export function nyDateKey(date: Date, timeZone = "America/New_York"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

/** A day key shifted by whole calendar days, never a real-time duration. */
export function addDaysToKey(key: string, days: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(
    shifted.getUTCDate()
  ).padStart(2, "0")}`;
}

/** `SATURDAY, SEPTEMBER 5` — the header's date line. Casing comes from `MonoLabel`. */
export function homeHeaderDate(date: Date, timeZone = "America/New_York"): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

/** `Sep 5, 2026` — the canvas caption's "AS OF" date. */
export function homeAsOfDate(date: Date, timeZone = "America/New_York"): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, dateStyle: "medium" }).format(date);
}
