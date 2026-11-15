// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { setLocale } from "@/lib/i18n";
import { AppNotices } from "./AppNotices";
import { LOCAL_VIEWER } from "@/lib/onboarding";
import { GROK_MOVE_NOTICE, SIMPLE_MODE_NOTICE, STAR_NOTICE } from "@/lib/notices";

const fixture = vi.hoisted(() => ({ quiet: false, dispatch: vi.fn(), api: vi.fn().mockResolvedValue({}) }));
vi.mock("@/state/store", () => ({
  api: fixture.api,
  useStore: () => ({ dispatch: fixture.dispatch, state: {
    connected: true, hydrated: true, bots: [{ tasks: [{ createdAt: 1, usage: { turns: 1 } }] }],
    groups: [], routines: [], instances: [], config: { onboarding: { hintsSeen: [] } },
  } }),
}));
vi.mock("@/lib/corner-popup", () => ({ cornerPopupWaits: () => fixture.quiet, firstChatQuiet: () => false, firstReplyPending: () => false }));
vi.mock("@/lib/updater", () => ({ useUpdaterState: () => null }));
vi.mock("@/lib/two-places", () => ({ useTwoPlaces: () => ({ suggest: null }) }));
vi.mock("./CloudSendStrip", () => ({ useMoveQuiet: () => false }));
vi.mock("./MausBotWelcome", () => ({ useMausBotWelcomeDue: () => ({ due: false }) }));
vi.mock("./onboarding/WelcomeGate", () => ({ localDesktopPage: () => true }));
vi.mock("./SimpleModePrompt", () => ({
  SIMPLE_MODE_PROMPT: "[data-simple-mode-prompt]",
  reportSimpleModePrompt: vi.fn(),
  SimpleModePrompt: ({ onClose }: { onClose(): void }) => createElement("button", { onClick: onClose, "data-simple-mode-prompt": true }, "Choose interface mode"),
}));
vi.mock("@/lib/simple-mode-prompt", () => ({ useSimpleModePromptSeen: () => false }));

let root: Root, host: HTMLDivElement;
beforeEach(() => {
  setLocale("en"); fixture.quiet = false;
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear(); sessionStorage.clear();
  localStorage.setItem(GROK_MOVE_NOTICE, "1"); localStorage.setItem(STAR_NOTICE, "1");
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

it("keeps the interface prompt and closes it for the current launch", async () => {
  await act(async () => root.render(createElement(AppNotices, { viewer: LOCAL_VIEWER })));
  expect(host.textContent).toContain("Choose interface mode");
  expect(sessionStorage.getItem("omb.launch.notice")).toBe(SIMPLE_MODE_NOTICE);
  await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
  expect(host.textContent).toBe("");
});

it("waits while the interface is occupied and never queries a commercial account", async () => {
  const state = vi.fn();
  Object.assign(window, { ogb: { cloudAccount: { state }, cloudPlan: { state } } });
  fixture.quiet = true;
  await act(async () => root.render(createElement(AppNotices, { viewer: LOCAL_VIEWER })));
  expect(host.textContent).toBe("");
  expect(state).not.toHaveBeenCalled();
  delete window.ogb;
});
