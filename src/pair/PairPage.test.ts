// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLocale } from "../lib/i18n";
const f = vi.hoisted(() => ({ pair: vi.fn(), session: vi.fn() }));
vi.mock("../lib/session", async original => ({ ...await original<typeof import("../lib/session")>(), pairWithCode: f.pair, readSessionState: f.session }));
vi.mock("../components/DesktopWorkspaceSwitcher", () => ({ DesktopWorkspaceSwitcher: () => null }));
import { codeProblem, codeReady, pairingCommand, PairPage, pairsAutomatically, unencryptedPublic } from "./PairPage";
import en from "../locales/en.json";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const code = "ABCD-EFGH-JK23";
let root: Root, host: HTMLDivElement;
const replace = vi.fn();
beforeEach(() => {
  setLocale("en");
  f.pair.mockReset(); f.session.mockResolvedValue({ kind: "unauthenticated", error: "" }); replace.mockReset();
  vi.stubGlobal("location", { replace, protocol: "https:", hostname: "rethos.example.com", host: "rethos.example.com", search: "" });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ label: "My VPS", version: "1", platform: "linux", capabilities: { install: "docker", emailSignIn: true, cloudHome: true } }) }));
  delete window.ogb;
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const render = async (initialCode: string | null = null) => { await act(async () => root.render(createElement(PairPage, { initialCode }))); };
const submit = async () => { await act(async () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); };

it("uses one input and collapsed help, even with a legacy cloud descriptor", async () => {
  await render();
  expect(host.querySelectorAll("input")).toHaveLength(1);
  expect(host.querySelector("details")!.open).toBe(false);
  expect(host.querySelector("code")!.textContent).toBe("docker compose exec rethos rethos pair");
  expect(host.textContent).not.toContain("My Cloud");
  expect(host.querySelector('[type="email"]')).toBeNull();
  expect(host.querySelector("button[type=submit]")!.hasAttribute("disabled")).toBe(true);
  expect(host.querySelector("img")!.src).toContain("/app-icon.svg");
});

it("requires a browser confirmation then pairs with an automatic device label", async () => {
  f.pair.mockResolvedValue({ ok: true }); await render(code);
  expect(f.pair).not.toHaveBeenCalled();
  await submit();
  expect(f.pair).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ code, label: expect.any(String), attemptId: expect.any(String) }));
  expect(replace).toHaveBeenCalledWith("/");
});

it("automatically exchanges a desktop link and preserves the destination", async () => {
  window.ogb = { workspaces: {} } as Window["ogb"];
  f.pair.mockResolvedValue({ ok: true }); await render(code);
  expect(f.pair).toHaveBeenCalledTimes(1);
  expect(replace).toHaveBeenCalledWith("/");
});

it("an expired desktop link returns to the form and allows an explicit retry", async () => {
  window.ogb = { workspaces: {} } as Window["ogb"];
  f.pair.mockResolvedValue({ ok: false, error: "This code has expired." }); await render(code);
  expect(host.querySelector("[role=alert]")!.textContent).toBe("This code has expired.");
  expect(replace).not.toHaveBeenCalled();
  expect(host.querySelector("form")).not.toBeNull();
  expect(f.pair).toHaveBeenCalledTimes(1);
  f.pair.mockResolvedValue({ ok: true }); await submit();
  expect(replace).toHaveBeenCalledWith("/");
});

it("an existing session offers entry without exchanging another code", async () => {
  f.session.mockResolvedValue({ kind: "session", id: "existing", scopes: ["admin"] }); await render(code);
  expect(host.querySelector("form")).toBeNull();
  expect(host.querySelector("a")!.getAttribute("href")).toBe("/");
  expect(f.pair).not.toHaveBeenCalled();
});

it("rejects other credential types and accepts formatted pairing codes", () => {
  expect(codeProblem("1234 5678")).toBe(en["serverError.pair.emailCode"]);
  expect(codeProblem("123456")).toBe(en["serverError.pair.oldCode"]);
  expect(codeProblem("omb_sess_" + "a".repeat(43))).toBe(en["serverError.pair.scriptKey"]);
  expect(codeReady("7kq2 m9xd h4tp")).toBe(true);
  expect(codeReady("1234 5678")).toBe(false);
  expect(pairsAutomatically(code, false)).toBe(false);
  expect(pairsAutomatically(code, true)).toBe(true);
});

it("gives installation-specific commands", () => {
  expect(pairingCommand("docker")).toBe("docker compose exec rethos rethos pair");
  expect(pairingCommand("source")).toBe("pnpm pair");
  expect(pairingCommand("npx")).toBe("npx rethos pair");
  expect(pairingCommand("global")).toBe("rethos pair");
});

it("warns on a public unencrypted connection", async () => {
  vi.stubGlobal("location", { protocol: "http:", hostname: "203.0.113.9", host: "203.0.113.9" });
  await render();
  expect(host.querySelector("[role=alert]")!.textContent).toBe(en["pair.notEncrypted"]);
  expect(unencryptedPublic({ protocol: "https:", hostname: "rethos.example.com" })).toBe(false);
  expect(unencryptedPublic({ protocol: "http:", hostname: "192.168.1.20" })).toBe(false);
});
