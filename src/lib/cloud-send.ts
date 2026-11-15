// What either page says about the one-time move to My Cloud (electron/one-home.mjs), and what arrived, in words.
import type { CloudSendCounts } from "../../electron/cloud-send.mjs";
import type { OneHomeCounts, OneHomeNotCarried, OneHomeStayed, OneHomeView } from "../../electron/one-home.mjs";
import type { LocaleKey } from "@/locales";
import { activeLocale, t } from "@/lib/i18n";
import { serverErrorText } from "@/lib/server-error";

const counted = (count: number, one: LocaleKey, many: LocaleKey) => t(count === 1 ? one : many, { count });

export const listOf = (parts: string[]) => new Intl.ListFormat(activeLocale(), { type: "conjunction" }).format(parts);

/** Refusals the preload sends before main is asked: it has no catalog, so they come in English. */
const BRIDGE_REFUSALS: Readonly<Record<string, LocaleKey>> = {
  "Choose Try again to move.": "cloudSend.move.unclicked",
};

/** The words main threw, without Electron's "Error invoking remote method" wrapper; null when there are none. */
export function ipcErrorText(cause: unknown): string | null {
  const text = cause instanceof Error && cause.message ? cause.message.replace(/^Error invoking remote method '[^']*':\s*(?:\w*Error:\s*)?/u, "") : null;
  return text !== null && Object.hasOwn(BRIDGE_REFUSALS, text) ? t(BRIDGE_REFUSALS[text]!) : text;
}

/** "12 bots, 3 skills, 2 logins, 1Password and 48 chats", from counts only. */
export function countedList(sent: CloudSendCounts): string[] {
  const chats = sent.chats;
  return [
    ...(sent.bots ? [counted(sent.bots, "cloudSend.list.botOne", "cloudSend.list.bots")] : []),
    ...(sent.updatedBots ? [counted(sent.updatedBots, "cloudSend.list.changedBotOne", "cloudSend.list.changedBots")] : []),
    ...(sent.skills ? [counted(sent.skills, "cloudSend.list.skillOne", "cloudSend.list.skills")] : []),
    ...(sent.logins ? [counted(sent.logins, "cloudSend.list.loginOne", "cloudSend.list.logins")] : []),
    ...(sent.onePassword ? [t("cloudSend.list.onePassword")] : []),
    ...(sent.settings ? [t("cloudSend.list.settings")] : []),
    ...(chats?.conversations ? [counted(chats.conversations, "cloudSend.list.chatOne", "cloudSend.list.chats")]
      : chats?.messages ? [counted(chats.messages, "cloudSend.list.messageOne", "cloudSend.list.messages")] : []),
  ];
}

/** "4 bots, 2 skills, 2 logins, 1Password, 148 chats and 2 routines": what the move checked on both sides. */
export function arrivedList(counts: OneHomeCounts): string[] {
  return [
    ...(counts.bots ? [counted(counts.bots, "cloudSend.list.botOne", "cloudSend.list.bots")] : []),
    ...(counts.skills ? [counted(counts.skills, "cloudSend.list.skillOne", "cloudSend.list.skills")] : []),
    ...(counts.logins ? [counted(counts.logins, "cloudSend.list.loginOne", "cloudSend.list.logins")] : []),
    ...(counts.onePassword ? [t("cloudSend.list.onePassword")] : []),
    ...(counts.chats ? [counted(counts.chats, "cloudSend.list.chatOne", "cloudSend.list.chats")] : []),
    ...(counts.routines ? [counted(counts.routines, "cloudSend.list.routineOne", "cloudSend.list.routines")] : []),
  ];
}

/** How long after the move is done the corner cards that sell or ask for something still wait. */
export const MOVE_QUIET_MS = 5 * 60_000;

/** Until when the corner cards that sell or ask for something (Product Hunt, the star, Cloud offers) wait for the
 * one-time move: for good while it goes or brings things home (Infinity), and MOVE_QUIET_MS after it is done. */
export function moveQuietUntil(move: OneHomeView | null | undefined): number {
  if (!move) return 0;
  if (move.phase === "done") return move.at ? move.at + MOVE_QUIET_MS : 0;
  return Infinity;
}

/** What a move could not carry, one line each: its name, then why. */
const notCarried = (items: OneHomeNotCarried[] | undefined) => (items ?? []).map((item) => `${item.label}: ${item.error}`);
/** What stayed on this computer because it only works here, one line each. */
const stayedHere = (items: OneHomeStayed[] | undefined) => (items ?? []).map((item) => (item.needs
  ? t("cloudSend.move.stayedNeeds", { name: item.name, program: item.needs })
  : t("cloudSend.move.stayedHere", { name: item.name })));

/** The one-time move's line on either page: on its way (with progress, or who it waits for), almost done, failing for a
 * day (with Try again), what arrived (on My Cloud's page, once), coming home, where the bots came home instead, or this
 * computer's bots on their way home and home because the person keeps them here.
 * `page`: which page shows it; `reason`: why a failing move failed, in main's words, when it said. */
export function moveLine(move: OneHomeView, page: "local" | "cloud"): { kind: "sending" | "failed" | "done"; text: string; extra: string[]; phone?: true; retry?: true; reason?: string; place?: string } | null {
  return move.place ? ownMoveLine(move, move.place, page) : null;
}

/** The move to a server of the person's own, named `place`, on this computer's page: on its way, almost done, waiting for
 * that server's update, or failing for a day with Try again. Once done the window shows that server, which says nothing
 * of it here. */
function ownMoveLine(move: OneHomeView, place: string, page: "local" | "cloud"): ReturnType<typeof moveLine> {
  // What that server refused for good is said there, where the window opens once the move is done.
  if (move.phase === "done" && page === "cloud" && (move.left?.length || move.stayed?.length)) return { kind: "done", text: t("cloudSend.move.doneLeft"), extra: [...notCarried(move.left), ...stayedHere(move.stayed)], place };
  if (page !== "local" || !["copy", "wait", "finishing"].includes(move.phase)) return null;
  const line = (kind: "sending" | "failed", text: string, more: { retry?: true; reason?: string; extra?: string[] } = {}) => ({ kind, text, extra: [], place, ...more });
  const failing = "failing" in move ? move.failing : undefined;
  if (failing) {
    const extra = notCarried(failing.items);
    return failing.error ? line("failed", t("cloudSend.move.failingNamed", { place, error: serverErrorText(failing, failing.error) }), { retry: true, reason: serverErrorText(failing, failing.error), extra })
      : line("failed", t("cloudSend.move.failingPlainNamed", { place }), { retry: true, extra });
  }
  if (move.phase === "copy" && move.updating) return line("sending", t("cloudSend.move.updatingNamed", { place }));
  if (move.phase === "finishing") return line("sending", t("cloudSend.move.finishingNamed", { place }));
  if (move.phase === "wait" && move.waitingFor !== undefined) {
    return line("sending", move.waitingFor ? t("cloudSend.move.waitingNamed", { place, name: move.waitingFor })
      : t(move.waitingWhat === "sign-in" ? "cloudSend.move.waitingSignInNamed" : "cloudSend.move.waitingAnyNamed", { place }));
  }
  const chats = move.phase === "copy" ? move.chats : undefined;
  return line("sending", chats ? t("cloudSend.move.copyChatsNamed", { place, done: chats.done, total: chats.total }) : t("cloudSend.move.copyNamed", { place }));
}
