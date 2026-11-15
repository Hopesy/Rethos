import { hintSeen, hintSeenPatch, type OnboardingStatus } from "@/lib/onboarding";

/** The Simple mode popup, once per browser (simple-mode-prompt.ts keeps whether it was closed). */
export const SIMPLE_MODE_NOTICE = "simple-mode-prompt";
export const STAR_NOTICE = "github-star-dismissed";
/** Bots on this computer and on another place of the person's (two-places.ts): dismissed per place, by main. */
export const TWO_PLACES_NOTICE = "two-places";
/** The Move from Grok Bot popup: each person sees it once, first of all, after their welcome. */
export const GROK_MOVE_NOTICE = "grok-move-2026-11";

/**
 * Every notice, in the order a launch asks them: one launch shows one notice, the first one due, and only the product-updates
 * question may follow it there. The rest wait for later launches, in this order.
 */
export const NOTICES = [GROK_MOVE_NOTICE, SIMPLE_MODE_NOTICE, TWO_PLACES_NOTICE, STAR_NOTICE] as const;

export type NoticeId = (typeof NOTICES)[number];

export type NoticeFacts = Partial<Record<NoticeId, boolean | null>>;

/** `launch`: the notice this launch already showed (launchNotice), the only one besides the product-updates question that
 * may show again in it. */
export function nextNotice(facts: NoticeFacts, seen: (id: NoticeId) => boolean, launch: NoticeId | null = null): NoticeId | null {
  for (const id of NOTICES) {
    if (seen(id) || (launch !== null && id !== launch)) continue;
    if (facts[id] === null) return null;
    if (facts[id]) return id;
  }
  return null;
}

const LAUNCH_KEY = "omb.launch.notice";
// Where browser storage is blocked, this page's memory stands in for it, so a claim still holds for the page.
let launchMemory: NoticeId | null = null;
const isNotice = (id: unknown): id is NoticeId => (NOTICES as readonly unknown[]).includes(id);

/** The first notice this launch showed, kept for the window's session, so a reload is the same launch. */
export function launchNotice(): NoticeId | null {
  try {
    const id = sessionStorage.getItem(LAUNCH_KEY);
    if (isNotice(id)) return id;
  } catch {}
  return launchMemory;
}

/** The first claim of a launch holds; a later one changes nothing. */
export function markLaunchNotice(id: NoticeId): void {
  if (launchNotice()) return;
  try {
    sessionStorage.setItem(LAUNCH_KEY, id);
  } catch {
    launchMemory = id;
  }
}

const stored = (id: string): string | null => { try { return localStorage.getItem(id); } catch { return null; } };
const store = (id: string, value: string) => { try { localStorage.setItem(id, value); } catch {} };

export function noticeSeen(record: OnboardingStatus | undefined, id: string): boolean {
  return hintSeen(record, id) || stored(id) === "1";
}

export function dismissNotice(record: OnboardingStatus | undefined, id: string): { onboarding: { hintsSeen: string[] } } | null {
  store(id, "1");
  return hintSeenPatch(record, id);
}

export function localDay(now: number): string {
  const date = new Date(now), two = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

/** The line atop a workspace of this computer's own: closed for good with its ✕, else shown on HOME_LINE_DAYS days at most
 * and for HOME_LINE_SPAN_DAYS from the first. Kept in the workspace's own config, so each workspace has its own. */
export const HOME_LINE_NOTICE = "home-line-profile";
const HOME_LINE_DAYS = 3, HOME_LINE_SPAN_DAYS = 7;
const homeLineDayHint = (day: string) => `${HOME_LINE_NOTICE}:day-${day}`;
const homeLineDays = (record: OnboardingStatus | undefined) => (record?.hintsSeen ?? [])
  .filter(id => id.startsWith(`${HOME_LINE_NOTICE}:day-`)).map(id => id.slice(`${HOME_LINE_NOTICE}:day-`.length))
  .filter(day => /^\d{4}-\d{2}-\d{2}$/.test(day)).sort();
const dayNumber = (day: string) => { const [year, month, date] = day.split("-").map(Number); return Math.round(new Date(year!, month! - 1, date!).getTime() / 86_400_000); };

export function homeLineStage(record: OnboardingStatus | undefined, now: number): "due" | "done" {
  if (hintSeen(record, HOME_LINE_NOTICE)) return "done";
  const days = homeLineDays(record), today = localDay(now);
  if (days.includes(today)) return "due";
  if (days.length >= HOME_LINE_DAYS) return "done";
  return days.length && dayNumber(today) - dayNumber(days[0]!) >= HOME_LINE_SPAN_DAYS ? "done" : "due";
}

/** Today counted among the line's days: the patch to save, or null when today is counted already or the line is done. */
export function homeLineShown(record: OnboardingStatus | undefined, now: number): { onboarding: { hintsSeen: string[] } } | null {
  return homeLineStage(record, now) === "due" ? hintSeenPatch(record, homeLineDayHint(localDay(now))) : null;
}

export const LAUNCHED_AT = Date.now();

export function usedBefore(
  bots: ReadonlyArray<{ tasks?: ReadonlyArray<{ createdAt?: number; usage?: { turns: number } }> }>,
  launchedAt = LAUNCHED_AT,
): boolean {
  return bots.some(bot => bot.tasks?.some(task => (task.createdAt ?? Infinity) < launchedAt && (task.usage?.turns ?? 0) > 0) ?? false);
}
