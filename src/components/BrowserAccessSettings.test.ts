// @vitest-environment happy-dom
import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLocale } from "../lib/i18n";

const f = vi.hoisted(() => ({ api: vi.fn(), copy: vi.fn() }));
vi.mock("../state/store", () => ({ api: f.api, useStore: () => ({ state: {} }) }));
vi.mock("../lib/use-owner-or-admin", () => ({ useOwnerOrAdmin: () => true }));
vi.mock("../lib/copy-text", () => ({ useCopyFeedback: (secret: string) => ({ state: "idle", copy: () => f.copy(secret) }) }));
import { AccessTokensPanel, BrowserQrPanel } from "./BrowserAccessSettings";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  setLocale("en"); f.api.mockReset(); f.copy.mockReset();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); });
const click = async (label: string) => {
  const button = [...host.querySelectorAll("button")].find(b => b.textContent === label || b.getAttribute("aria-label") === label);
  expect(button).toBeTruthy(); await act(async () => button!.click());
};
const offer = (id: string) => ({ id, url: `https://rethos.test/pair#signin=fixture-${id}`, expiresAt: Date.now() + 300_000 });

it("creates a reusable token, shows its secret once and revokes only after inline confirmation", async () => {
  const secret = "omb_sess_" + "a".repeat(43);
  let tokens: Array<{ id: string; token: true; label: string; expiresAt: number }> = [];
  f.api.mockImplementation(async (path, options) => {
    if (path === "/api/auth/sessions") return { sessions: tokens };
    if (path === "/api/auth/pairing") return { credential: "fixture-grant" };
    if (path === "/api/auth/pair") { tokens = [{ id: "test-token", token: true, label: "Browser login", expiresAt: Date.now() + 86400_000 }]; return { token: secret, session: tokens[0] }; }
    if (path === "/api/auth/sessions/test-token" && options.method === "DELETE") { tokens = []; return { ok: true }; }
    throw new Error(path);
  });
  await act(async () => root.render(createElement(AccessTokensPanel)));
  await click("Create token");
  expect(JSON.parse(f.api.mock.calls.find(([path]) => path === "/api/auth/pairing")![1].body)).toEqual(expect.objectContaining({ tokenTtlMs: 90 * 86400_000, scopes: ["admin", "client"] }));
  expect(host.querySelector("input")!.type).toBe("password"); expect(host.querySelector("input")!.value).toBe(secret);
  await click("Copy token"); expect(f.copy).toHaveBeenCalledWith(secret);
  await click("Close"); expect(host.querySelector("input")).toBeNull();
  await click("Revoke"); expect(f.api.mock.calls.some(([path]) => path.endsWith("/test-token"))).toBe(false);
  await click("Confirm revoke"); expect(host.querySelector("li")).toBeNull();
});

it("cancels abandoned StrictMode requests and the owned QR when the panel closes", async () => {
  const pending: Array<(value: ReturnType<typeof offer>) => void> = [];
  f.api.mockImplementation((path) => path === "/api/auth/browser-qr" ? new Promise(resolve => pending.push(resolve)) : Promise.resolve({ ok: true }));
  await act(async () => root.render(createElement(StrictMode, null, createElement(BrowserQrPanel))));
  expect(pending).toHaveLength(2);
  await act(async () => { pending[1](offer("current")); pending[0](offer("stale")); });
  expect(f.api).toHaveBeenCalledWith("/api/auth/pairing/stale", { method: "DELETE" });
  expect(f.api).not.toHaveBeenCalledWith("/api/auth/pairing/current", { method: "DELETE" });
  expect(host.querySelector("svg path")).toBeTruthy();
  await act(async () => root.render(null));
  expect(f.api).toHaveBeenCalledWith("/api/auth/pairing/current", { method: "DELETE" });
});

it("refreshes QR grants, hides expired credentials, and cleans a response received after closing", async () => {
  vi.useFakeTimers();
  let complete: ((value: ReturnType<typeof offer>) => void) | undefined;
  f.api.mockImplementation((path) => path === "/api/auth/browser-qr" ? complete ? new Promise(resolve => { complete = resolve; }) : Promise.resolve(offer("first")) : Promise.resolve({ ok: true }));
  await act(async () => root.render(createElement(BrowserQrPanel)));
  await act(async () => vi.advanceTimersByTime(300_001));
  expect(host.textContent).toContain("expired");
  complete = () => {};
  await click("Refresh QR code");
  expect(f.api).toHaveBeenCalledWith("/api/auth/pairing/first", { method: "DELETE" });
  await act(async () => root.render(null));
  await act(async () => complete!(offer("late")));
  expect(f.api).toHaveBeenCalledWith("/api/auth/pairing/late", { method: "DELETE" });
});

it("shows QR generation failures with a retry control", async () => {
  f.api.mockRejectedValue(new Error("Server unavailable"));
  await act(async () => root.render(createElement(BrowserQrPanel)));
  expect(host.querySelector('[role="alert"]')!.textContent).toBe("Server unavailable");
  expect([...host.querySelectorAll("button")].find(b => b.textContent?.includes("Refresh"))!.disabled).toBe(false);
});
