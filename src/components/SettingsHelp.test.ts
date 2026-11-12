// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLocale } from "@/lib/i18n";
import { Card } from "./SettingsPrimitives";
import { SettingsHelp } from "./SettingsHelp";

let host: HTMLDivElement;
let root: Root;
const detail = "This setting applies to future runs and keeps the saved model for existing work.";

beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  setLocale("en");
  host = document.createElement("div");
  host.setAttribute("role", "dialog");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(createElement(Card, {
    title: "Recovery", subtitle: "Try a backup when startup fails.", help: detail,
    children: createElement("button", { type: "button" }, "Save"),
  })));
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const trigger = () => host.querySelector<HTMLButtonElement>('[aria-label="Help for Recovery"]')!;
const tooltip = () => host.querySelector<HTMLElement>('[role="tooltip"]');
const pointer = async (target: Element, type: string) => {
  await act(async () => target.dispatchEvent(new MouseEvent(type, { bubbles: true, relatedTarget: document.body })));
};
const settle = async () => { await act(async () => vi.advanceTimersByTime(200)); };

it("keeps the summary visible and opens the complete explanation on hover", async () => {
  expect(host.textContent).toContain("Try a backup when startup fails.");
  expect(host.textContent).not.toContain(detail);
  expect(tooltip()).toBeNull();
  await pointer(trigger(), "mouseover");
  expect(tooltip()?.textContent).toBe(detail);
  expect(trigger().getAttribute("aria-describedby")).toBe(tooltip()?.id);
  await pointer(trigger(), "mouseout");
  await pointer(tooltip()!, "mouseover");
  await settle();
  expect(tooltip()).not.toBeNull();
  await pointer(tooltip()!, "mouseout");
  await settle();
  expect(tooltip()).toBeNull();
});

it("keeps keyboard help open until focus leaves and lets Escape dismiss just the help", async () => {
  const escaped = vi.fn();
  host.addEventListener("keydown", escaped);
  await act(async () => trigger().focus());
  expect(tooltip()?.textContent).toBe(detail);
  await pointer(trigger(), "mouseout");
  await settle();
  expect(tooltip()).not.toBeNull();
  await act(async () => trigger().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
  expect(tooltip()).toBeNull();
  expect(document.activeElement).toBe(trigger());
  expect(escaped).not.toHaveBeenCalled();
  await act(async () => trigger().blur());
  await act(async () => trigger().focus());
  await act(async () => host.querySelectorAll<HTMLButtonElement>("button")[1]!.focus());
  await settle();
  expect(tooltip()).toBeNull();
});

it("opens on a tap and closes on an outside pointer without activating another control", async () => {
  await act(async () => trigger().click());
  expect(tooltip()?.textContent).toBe(detail);
  await act(async () => document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
  expect(tooltip()).toBeNull();
  expect(trigger().getAttribute("aria-expanded")).toBe("false");
});

it("shows one explanation when pointer and keyboard focus move between different settings", async () => {
  await act(async () => root.render(createElement("div", null,
    createElement(SettingsHelp, { label: "Recovery", children: detail }),
    createElement(SettingsHelp, { label: "Tools", children: "Choose which tools are available." }),
  )));
  await act(async () => trigger().focus());
  await pointer(host.querySelector('[aria-label="Help for Tools"]')!, "mouseover");
  expect(host.querySelectorAll('[role="tooltip"]')).toHaveLength(1);
  expect(tooltip()?.textContent).toBe("Choose which tools are available.");
  expect(trigger().getAttribute("aria-expanded")).toBe("false");
});
