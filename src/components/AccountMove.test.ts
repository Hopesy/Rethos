// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import type { WorkspaceMoveBridge, WorkspaceMoveNotice } from "../../electron/workspace-move.mjs";
import { setLocale } from "@/lib/i18n";
import { AccountMoveStatus, useAccountMoveLine } from "./AccountMove";

afterEach(() => { vi.unstubAllGlobals(); setLocale("en"); });
function Status() { const move = useAccountMoveLine(false); return createElement(AccountMoveStatus, { kind: move.kind, place: move.place, retry: move.retry, onOpen: () => {} }); }
it("shows the selected server and retains a failed retry until a successful retry updates its state", async () => {
  setLocale("en");
  const notice: WorkspaceMoveNotice = { move: { phase: "copy", place: "Garage server", failing: { error: "Server offline" } } };
  const retry = vi.fn().mockRejectedValueOnce(new Error("Still offline")).mockResolvedValueOnce({ move: { phase: "copy", place: "Garage server" } });
  const bridge: WorkspaceMoveBridge = { notice: async () => notice, dismiss: async () => ({}), moveRetry: retry, onNotice: () => () => {} };
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.stubGlobal("window", window);
  const previous = window.ogb;
  window.ogb = { platform: "win32", workspaceMove: bridge } as typeof window.ogb;
  const host = document.createElement("div"), root = createRoot(host); document.body.append(host);
  try {
    await act(async () => root.render(createElement(Status)));
    expect(host.textContent).toContain("Garage server move needs you");
    await act(async () => (host.querySelector("[data-move-retry]") as HTMLButtonElement).click());
    expect(host.textContent).toContain("Still offline");
    await act(async () => (host.querySelector("[data-move-retry]") as HTMLButtonElement).click());
    expect(host.textContent).toContain("Moving to Garage server");
    expect(host.querySelector("[data-move-retry]")).toBeNull();
  } finally { await act(async () => root.unmount()); host.remove(); window.ogb = previous; }
});
