// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLocale } from "../lib/i18n";
const f = vi.hoisted(() => ({ signIn: vi.fn() }));
vi.mock("../lib/session", async original => ({ ...await original<typeof import("../lib/session")>(), signInWithBrowserGrant: f.signIn }));
import { BrowserSignInPage } from "./BrowserSignInPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;
const replace = vi.fn();
const credential = `omb_pair_${"b".repeat(43)}`;
beforeEach(() => {
  setLocale("en"); f.signIn.mockReset(); replace.mockReset();
  vi.stubGlobal("location", { replace, host: "rethos.test" });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const render = async () => act(async () => root.render(createElement(BrowserSignInPage, { credential, owner: "rethos.test" })));
const click = async () => act(async () => (host.querySelector(".login-submit") as HTMLButtonElement).click());

it("waits for confirmation and opens the app after exchanging the QR credential", async () => {
  f.signIn.mockResolvedValue({ ok: true }); await render(); expect(f.signIn).not.toHaveBeenCalled();
  await click(); expect(f.signIn).toHaveBeenCalledWith(credential, expect.any(String)); expect(replace).toHaveBeenCalledWith("/");
});

it("shows an expired-link error and preserves the attempt id when retrying a failed request", async () => {
  f.signIn.mockResolvedValue({ ok: false, error: "This QR code expired" }); await render(); await click();
  expect(host.querySelector('[role="alert"]')!.textContent).toBe("This QR code expired"); expect(replace).not.toHaveBeenCalled();
  const firstId = f.signIn.mock.calls[0][1]; await click(); expect(f.signIn.mock.calls[1][1]).toBe(firstId);
});
