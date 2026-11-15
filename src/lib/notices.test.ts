import { beforeEach, expect, it, vi } from "vitest";
import { dismissNotice, GROK_MOVE_NOTICE, launchNotice, markLaunchNotice, nextNotice, noticeSeen, SIMPLE_MODE_NOTICE, STAR_NOTICE, TWO_PLACES_NOTICE, usedBefore } from "./notices";
import type { OnboardingStatus } from "./onboarding";
const record = (hintsSeen: string[] = []) => ({ hintsSeen }) as OnboardingStatus;
const storage = new Map<string, string>();
beforeEach(() => { storage.clear(); vi.stubGlobal("localStorage", { getItem: (id: string) => storage.get(id), setItem: (id: string, value: string) => storage.set(id, value) }); });
it("keeps one launch's notices in order and waits for unknown earlier state", () => {
  const facts = { [GROK_MOVE_NOTICE]: true, [SIMPLE_MODE_NOTICE]: true, [TWO_PLACES_NOTICE]: true, [STAR_NOTICE]: true };
  expect(nextNotice(facts, () => false)).toBe(GROK_MOVE_NOTICE);
  expect(nextNotice({ ...facts, [GROK_MOVE_NOTICE]: null }, () => false)).toBeNull();
  expect(nextNotice(facts, id => id === GROK_MOVE_NOTICE)).toBe(SIMPLE_MODE_NOTICE);
  expect(nextNotice(facts, id => id === GROK_MOVE_NOTICE, GROK_MOVE_NOTICE)).toBeNull();
  const session = new Map<string, string>();
  vi.stubGlobal("sessionStorage", { getItem: (id: string) => session.get(id), setItem: (id: string, value: string) => session.set(id, value) });
  markLaunchNotice(SIMPLE_MODE_NOTICE); markLaunchNotice(STAR_NOTICE);
  expect(launchNotice()).toBe(SIMPLE_MODE_NOTICE);
});
it("persists a dismissal locally and in the workspace while tolerating blocked browser storage", () => {
  expect(dismissNotice(record(), STAR_NOTICE)).toEqual({ onboarding: { hintsSeen: [STAR_NOTICE] } });
  expect(noticeSeen(record(), STAR_NOTICE)).toBe(true);
  vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
  expect(noticeSeen(record([STAR_NOTICE]), STAR_NOTICE)).toBe(true);
  expect(dismissNotice(record([STAR_NOTICE]), STAR_NOTICE)).toBeNull();
});

it("someone has used the app before when a conversation from before this launch has had a reply", () => {
  const launch = 1_000_000;
  const task = (createdAt: number, turns?: number) => ({ createdAt, ...(turns === undefined ? {} : { usage: { turns } }) });
  expect(usedBefore([], launch)).toBe(false);
  expect(usedBefore([{ tasks: [task(launch - 1, 1)] }], launch)).toBe(true);
  expect(usedBefore([{ tasks: [task(launch, 3)] }], launch)).toBe(false);
  expect(usedBefore([{ tasks: [task(launch - 1, 0), task(launch - 1)] }, {}], launch)).toBe(false);
  expect(usedBefore([{}, { tasks: [task(launch + 5, 2), task(launch - 9, 2)] }], launch)).toBe(true);
});
