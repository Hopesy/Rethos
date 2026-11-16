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
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

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
