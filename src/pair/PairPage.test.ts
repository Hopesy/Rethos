// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLocale } from "../lib/i18n";
const f = vi.hoisted(() => ({ pair: vi.fn(), session: vi.fn(), login: vi.fn() }));
vi.mock("../lib/session", async original => ({ ...await original<typeof import("../lib/session")>(), pairWithCode: f.pair, readSessionState: f.session, signInWithToken: f.login }));
vi.mock("../components/DesktopWorkspaceSwitcher", () => ({ DesktopWorkspaceSwitcher: () => null }));
import { PairPage, pairsAutomatically, unencryptedPublic } from "./PairPage";
import en from "../locales/en.json";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const code = "ABCD-EFGH-JK23";
let root: Root, host: HTMLDivElement;
const replace = vi.fn();
beforeEach(() => {
  setLocale("en");
  f.pair.mockReset(); f.login.mockReset(); f.session.mockResolvedValue({ kind: "unauthenticated", error: "" }); replace.mockReset();
  vi.stubGlobal("location", { replace, protocol: "https:", hostname: "rethos.example.com", host: "rethos.example.com", search: "" });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ label: "My VPS", version: "1", platform: "linux", capabilities: { install: "docker", emailSignIn: true, cloudHome: true } }) }));
  delete window.ogb;
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const render = async (initialCode: string | null = null) => { await act(async () => root.render(createElement(PairPage, { initialCode }))); };
const submit = async () => { await act(async () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); };
const fill = async (value: string) => { await act(async () => { const input = host.querySelector("input")!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); }); };

it("shows one accessible masked token input without visible labels or alternate login instructions", async () => {
  await render();
  expect(host.querySelectorAll("input")).toHaveLength(1);
  expect(host.querySelector("details")).toBeNull();
  expect(host.querySelector("label")).toBeNull();
  expect(host.querySelector("input")!.getAttribute("aria-label")).toBe(en["login.token"]);
  expect(host.textContent).not.toContain(en["login.usePair"]);
  expect(host.textContent).not.toContain(en["login.help"]);
  expect(host.textContent).not.toContain(en["login.subtitle"]);
  expect(host.querySelector("input")!.type).toBe("password");
  expect(host.querySelector("code")).toBeNull();
  expect(host.textContent).not.toContain("My Cloud");
  expect(host.querySelector('[type="email"]')).toBeNull();
  expect(host.querySelector("button[type=submit]")!.hasAttribute("disabled")).toBe(true);
  expect(host.querySelector("img")!.src).toContain("/app-icon.svg");
});

it("signs in with the reusable token and clears the input after success", async () => {
  f.login.mockResolvedValue({ ok: true }); await render();
  const input = host.querySelector("input")!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "omb_sess_" + "a".repeat(43)); input.dispatchEvent(new Event("input", { bubbles: true })); });
  await submit();
  expect(f.login).toHaveBeenCalledWith("omb_sess_" + "a".repeat(43));
  expect(f.pair).not.toHaveBeenCalled(); expect(replace).toHaveBeenCalledWith("/"); expect(input.value).toBe("");
});

it("shows an invalid token error and supports revealing the input", async () => {
  f.login.mockResolvedValue({ ok: false, error: "Token expired" }); await render();
  const input = host.querySelector("input")!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "invalid"); input.dispatchEvent(new Event("input", { bubbles: true })); });
  await submit(); expect(host.querySelector('[role="alert"]')!.textContent).toBe("Token expired"); expect(replace).not.toHaveBeenCalled();
  await act(async () => (host.querySelector('[aria-label="Show token"]') as HTMLButtonElement).click()); expect(input.type).toBe("text");
});

it("uses token login even when a browser opens an old pairing link", async () => {
  f.login.mockResolvedValue({ ok: true }); await render(code);
  expect(f.pair).not.toHaveBeenCalled();
  expect(host.querySelector("input")!.name).toBe("access-token");
  expect(host.querySelector("input")!.value).toBe("");
  await fill("omb_sess_" + "a".repeat(43));
  await submit();
  expect(f.pair).not.toHaveBeenCalled(); expect(f.login).toHaveBeenCalledOnce();
  expect(replace).toHaveBeenCalledWith("/");
});

it("automatically exchanges a desktop link and preserves the destination", async () => {
  window.ogb = { workspaces: {} } as Window["ogb"];
  f.pair.mockResolvedValue({ ok: true }); await render(code);
  expect(f.pair).toHaveBeenCalledTimes(1);
  expect(replace).toHaveBeenCalledWith("/");
});

it("an expired desktop connection returns to token login", async () => {
  window.ogb = { workspaces: {} } as Window["ogb"];
  f.pair.mockResolvedValue({ ok: false, error: "This code has expired." }); await render(code);
  expect(host.querySelector("[role=alert]")!.textContent).toBe("This code has expired.");
  expect(replace).not.toHaveBeenCalled();
  expect(host.querySelector("form")).not.toBeNull();
  expect(f.pair).toHaveBeenCalledTimes(1);
  f.login.mockResolvedValue({ ok: true }); await fill("omb_sess_" + "a".repeat(43)); await submit();
  expect(f.pair).toHaveBeenCalledTimes(1); expect(f.login).toHaveBeenCalledOnce();
  expect(replace).toHaveBeenCalledWith("/");
});

it("an existing session offers entry without exchanging another code", async () => {
  f.session.mockResolvedValue({ kind: "session", id: "existing", scopes: ["admin"] }); await render(code);
  expect(host.querySelector("form")).toBeNull();
  expect(host.querySelector("a")!.getAttribute("href")).toBe("/");
  expect(f.pair).not.toHaveBeenCalled();
});

it("restricts automatic connection links to the desktop bridge", () => {
  expect(pairsAutomatically(code, false)).toBe(false);
  expect(pairsAutomatically(code, true)).toBe(true);
});

it("warns on a public unencrypted connection", async () => {
  vi.stubGlobal("location", { protocol: "http:", hostname: "203.0.113.9", host: "203.0.113.9" });
  await render();
  expect(host.querySelector("[role=alert]")!.textContent).toBe(en["pair.notEncrypted"]);
  expect(unencryptedPublic({ protocol: "https:", hostname: "rethos.example.com" })).toBe(false);
  expect(unencryptedPublic({ protocol: "http:", hostname: "192.168.1.20" })).toBe(false);
});
