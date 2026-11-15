// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Bot } from "@/state/store";
import { api, ApiError } from "@/state/api";
import { setLocale } from "@/lib/i18n";
import { ConnectedComputers } from "./ConnectedComputers";

vi.mock("@/state/api", async original => ({ ...await original<typeof import("@/state/api")>(), api: vi.fn() }));
const computer = { id: "pc", name: "Office PC", online: true, busy: false, botPermissions: true,
  scopes: { folders: [{ id: "sessions", name: "Sessions", write: false }], terminal: true, screen: true } };
const bot = { id: "chief", threadId: "main", name: "Rethos", approvalMode: "full", tasks: [] } as unknown as Bot;
let host: HTMLDivElement;
let root: Root;
const render = (value = bot) => act(() => root.render(createElement(ConnectedComputers, { bot: value })));
const advance = (milliseconds: number) => act(() => vi.advanceTimersByTimeAsync(milliseconds));

beforeEach(() => {
  vi.useFakeTimers(); setLocale("en"); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.mocked(api).mockReset().mockResolvedValue({ computers: [computer], known: [] });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it("shows connection capabilities and follows the selected conversation's permission changes", async () => {
  render(); await advance(0);
  expect(host.textContent).toContain("Office PCOnline");
  expect(host.textContent).toContain("Files · Terminal · Desktop");
  expect(host.textContent).toContain("Files: full access");
  render({ ...bot, tasks: [{ threadId: "main", approvalMode: "ask" }] as Bot["tasks"] });
  expect(host.textContent).toContain("Files: authorized folders; ask for more");
  render({ ...bot, computer: "off" });
  expect(host.textContent).not.toContain("Files · Terminal");
  expect(host.textContent).not.toContain(" · Desktop");
  render(bot);
  vi.mocked(api).mockResolvedValue({ computers: [{ ...computer, botPermissions: false }], known: [] });
  await advance(10_000);
  expect(host.textContent).toContain("Authorized folders: 1");
  expect(host.textContent).not.toContain("Files: full access");
});

it("refreshes offline and revoked devices, removes stale capability claims on failure and retries", async () => {
  render(); await advance(0);
  vi.mocked(api).mockResolvedValue({ computers: [{ ...computer, online: false }], known: [{ id: "pc", name: "Office PC", lent: true }, { id: "old", name: "Old PC", lent: false }] });
  await advance(10_000);
  expect(host.querySelectorAll('[data-computer-id="pc"]')).toHaveLength(1);
  expect(host.textContent).toContain("Offline"); expect(host.textContent).toContain("Access stopped");
  expect(host.textContent).not.toContain("Files: full access");
  vi.mocked(api).mockRejectedValue(new ApiError("Unavailable", 503));
  await advance(10_000);
  expect(host.textContent).toContain("Connection status unavailable");
  vi.mocked(api).mockResolvedValue({ computers: [computer], known: [] });
  act(() => host.querySelector<HTMLButtonElement>('[aria-label="Refresh connection status"]')!.click());
  await advance(0);
  expect(host.textContent).toContain("Office PCOnline");
});

it("hides an unavailable endpoint and aborts pending reads on unmount", async () => {
  vi.mocked(api).mockRejectedValue(new ApiError("Not found", 404));
  render(); await advance(20_000);
  expect(host.textContent).toBe(""); expect(api).toHaveBeenCalledTimes(1);
  const signal = vi.mocked(api).mock.calls[0]![1]!.signal!;
  act(() => root.render(null));
  expect(signal.aborted).toBe(true);
});
