// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api } from "@/state/api";
import type { Bot } from "@/state/store";
import { setLocale } from "@/lib/i18n";
import { setAdvancedMode } from "@/lib/interface-mode";
import { WorkTargetPicker } from "./WorkTargetPicker";
import type { WorkTarget, WorkTargetStatus } from "../../shared/work-target";

vi.mock("@/state/api", async original => ({ ...await original<typeof import("@/state/api")>(), api: vi.fn() }));
const device: WorkTarget = { kind: "connected", computerId: "11111111-1111-4111-8111-111111111111" };
const bot = { id: "chief", threadId: "main", name: "Rethos", approvalMode: "ask", tasks: [] } as unknown as Bot;
let host: HTMLDivElement, root: Root, status: WorkTargetStatus;
const render = (value = bot, thread = false) => act(async () => { root.render(createElement(WorkTargetPicker, { bot: value, thread })); });
const choose = (value: string) => act(async () => { host.querySelector<HTMLButtonElement>(`[data-work-target="${value}"]`)!.click(); });
beforeEach(() => {
  setLocale("en"); setAdvancedMode(false); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  status = { defaultTarget: { kind: "auto" }, selected: { kind: "auto" }, options: [
    { target: { kind: "auto" }, label: "Auto", available: true, ready: true },
    { target: device, label: "Office PC", available: true, ready: false },
    { target: { kind: "off" }, label: "Off", available: true, ready: true },
  ] };
  vi.mocked(api).mockReset().mockImplementation(async (_url, init) => {
    if (init?.method === "PATCH") {
      const { target, threadId } = JSON.parse(String(init.body));
      status = { ...status, selected: target ?? status.defaultTarget, ...(threadId ? { pinnedTarget: target ?? undefined } : { defaultTarget: target }) };
    }
    return status;
  });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it("saves an offline device without falling back, preserves rejected folder drafts, and persists a valid remote folder", async () => {
  await render(); await choose(`connected:${device.kind === "connected" ? device.computerId : ""}:`);
  expect(host.textContent).toContain("Selected: Office PC");
  expect(status.defaultTarget).toEqual(device);
  const input = host.querySelector("input")!;
  await act(async () => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!; setter.call(input, "relative"); input.dispatchEvent(new Event("input", { bubbles: true })); });
  vi.mocked(api).mockRejectedValueOnce(new Error("Use an absolute working folder"));
  await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("absolute");
  expect(input.value).toBe("relative");
  await act(async () => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!; setter.call(input, "C:\\Projects"); input.dispatchEvent(new Event("input", { bubbles: true })); });
  await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
  expect(status.defaultTarget).toEqual({ ...device, cwd: "C:\\Projects" });
  const calls = vi.mocked(api).mock.calls.length;
  await choose(`connected:${device.kind === "connected" ? device.computerId : ""}:`);
  expect(api).toHaveBeenCalledTimes(calls);
  expect(host.querySelector('[aria-pressed="true"]')?.textContent).toContain("Office PC");
  await act(async () => { setAdvancedMode(true); });
  expect(host.querySelector("input")?.value).toBe("C:\\Projects");
  expect(host.querySelector('[aria-pressed="true"]')?.getAttribute("aria-label")).toBe("Office PC");
  await act(async () => { setAdvancedMode(false); });
  expect(host.querySelector("input")?.value).toBe("C:\\Projects");
  expect(api).toHaveBeenCalledTimes(calls);
});

it("pins only the selected conversation and follows the bot again when cleared", async () => {
  status.defaultTarget = device; status.selected = device;
  await render(bot, true); await choose("off");
  expect(status.pinnedTarget).toEqual({ kind: "off" }); expect(status.defaultTarget).toEqual(device);
  expect(vi.mocked(api).mock.calls.some(([, init]) => init?.body === JSON.stringify({ target: { kind: "off" }, acknowledgeLocalAuto: false, threadId: "main" }))).toBe(true);
  await choose("follow"); expect(status.pinnedTarget).toBeUndefined(); expect(status.selected).toEqual(device);
});

it("keeps named computers in the original grid and hides the redundant automatic choice", async () => {
  status.options.push({ target: { kind: "local" }, label: "this computer", available: false, ready: false });
  await render(bot, true);
  expect(host.querySelector('[data-work-target="follow"]')?.textContent).toContain("Follow Bot");
  expect(host.querySelector('[data-work-target="auto"]')).toBeNull();
  const grid = host.querySelector('[role="group"]')!;
  expect(host.querySelectorAll('[role="group"]')).toHaveLength(1);
  expect([...grid.children].map(card => card.getAttribute("aria-label"))).toEqual(["Follow Bot", "Office PC", "Off", "Bot host computer"]);
  expect(host.querySelector<HTMLButtonElement>('[data-work-target="local"]')?.disabled).toBe(true);
  await act(async () => setAdvancedMode(true));
  expect(host.querySelector('[data-work-target="local"]')?.textContent).toContain("Bot host computer");
  expect(host.querySelector('[data-work-target="auto"]')).not.toBeNull();
});

it("refreshes computers that connect after opening, updates their status, and stops after unmount", async () => {
  vi.useFakeTimers();
  const computer = status.options.splice(1, 1)[0]!;
  await render();
  expect(host.querySelector('[data-work-target^="connected:"]')).toBeNull();
  status = { ...status, options: [...status.options, { ...computer, ready: true, state: "online" }] };
  await act(async () => vi.advanceTimersByTimeAsync(10_000));
  const card = host.querySelector<HTMLButtonElement>('[data-work-target^="connected:"]')!;
  expect(card.textContent).toContain("Office PC");
  expect(card.textContent).toContain("Online");
  status = { ...status, options: status.options.map(option => option.target.kind === "connected" ? { ...option, ready: false, state: "paused" } : option) };
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(card.textContent).toContain("Paused");
  await act(async () => root.render(null));
  const calls = vi.mocked(api).mock.calls.length;
  await act(async () => vi.advanceTimersByTimeAsync(20_000));
  expect(api).toHaveBeenCalledTimes(calls);
});
