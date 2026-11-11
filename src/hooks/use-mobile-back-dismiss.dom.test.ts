// @vitest-environment happy-dom
import { createElement, StrictMode } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMobileBackDismiss, useMobileBackNavigation } from "./use-mobile-back-dismiss";

let root: Root;
let entries: unknown[];
let position: number;
let pendingBack: (() => void) | undefined;

function Panel({ open, dismiss }: { open: boolean; dismiss: () => void }) {
  useMobileBackNavigation();
  useMobileBackDismiss(open, dismiss);
  return null;
}

const render = (open: boolean, dismiss = vi.fn()) => {
  flushSync(() => root.render(createElement(StrictMode, null, createElement(Panel, { open, dismiss }))));
  return dismiss;
};
const completeBack = () => {
  const complete = pendingBack;
  pendingBack = undefined;
  expect(complete).toBeDefined();
  flushSync(() => complete!());
};

beforeEach(() => {
  entries = [{ route: "chat", draft: "keep" }];
  position = 0;
  pendingBack = undefined;
  vi.spyOn(window.history, "state", "get").mockImplementation(() => entries[position]);
  vi.spyOn(window.history, "pushState").mockImplementation((state) => {
    entries.splice(++position, Infinity, state);
  });
  vi.spyOn(window.history, "back").mockImplementation(() => {
    expect(pendingBack).toBeUndefined();
    pendingBack = () => {
      position = Math.max(0, position - 1);
      window.dispatchEvent(new PopStateEvent("popstate", { state: entries[position] }));
    };
  });
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  flushSync(() => root.unmount());
  await Promise.resolve();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("phone overlay back navigation", () => {
  it("closes menus and nested actions before the underlying drawer", () => {
    let level = 3;
    const closed: string[] = [];
    function Layer({ name, priority }: { name: string; priority: number }) {
      useMobileBackDismiss(true, () => {
        closed.push(name);
        level--;
        draw();
      }, priority);
      return null;
    }
    function Navigation() {
      useMobileBackNavigation();
      return null;
    }
    const draw = () => flushSync(() => root.render(createElement(StrictMode, null,
      createElement(Navigation),
      level > 0 && createElement(Layer, { key: "drawer", name: "drawer", priority: 0 }),
      level > 1 && createElement(Layer, { key: "menu", name: "menu", priority: 20 }),
      level > 2 && createElement(Layer, { key: "submenu", name: "submenu", priority: 30 }),
    )));
    draw();
    for (const name of ["submenu", "menu", "drawer"]) {
      window.history.back();
      completeBack();
      expect(closed.at(-1)).toBe(name);
      expect(position).toBe(name === "drawer" ? 0 : 1);
    }
    expect(pendingBack).toBeUndefined();
  });

  it("dismisses the open panel on system Back and preserves the chat history state", () => {
    const dismiss = vi.fn((): void => { render(false, dismiss); });
    render(false, dismiss);
    render(true, dismiss);
    expect(window.history.state).toMatchObject({ route: "chat", draft: "keep" });
    window.history.back();
    completeBack();
    expect(dismiss).toHaveBeenCalledOnce();
    expect(position).toBe(0);
    expect(window.history.state).toEqual({ route: "chat", draft: "keep" });
    expect(pendingBack).toBeUndefined();
  });

  it("removes the temporary entry after closing via a button without dismissing twice", () => {
    const dismiss = render(true);
    render(false, dismiss);
    completeBack();
    expect(dismiss).not.toHaveBeenCalled();
    expect(position).toBe(0);
  });

  it("keeps a rapidly reopened panel open while the previous close completes", () => {
    const dismiss = render(true);
    render(false, dismiss);
    render(true, dismiss);
    completeBack();
    expect(dismiss).not.toHaveBeenCalled();
    expect(position).toBe(1);
    expect(entries).toHaveLength(2);
  });

  it("dismisses settings first, then the underlying drawer on the next Back", () => {
    const closeDrawer = vi.fn((): void => { render(false, closeDrawer); });
    const closeSettings = vi.fn(() => render(true, closeDrawer));
    render(true, closeDrawer);
    render(true, closeSettings);
    window.history.back();
    completeBack();
    expect(closeSettings).toHaveBeenCalledOnce();
    expect(closeDrawer).not.toHaveBeenCalled();
    expect(position).toBe(1);
    window.history.back();
    completeBack();
    expect(closeDrawer).toHaveBeenCalledOnce();
    expect(position).toBe(0);
  });

  it("adds one entry under StrictMode and releases it on unmount", async () => {
    render(true);
    await Promise.resolve();
    expect(entries).toHaveLength(2);
    expect(pendingBack).toBeUndefined();
    flushSync(() => root.render(null));
    await Promise.resolve();
    completeBack();
    expect(position).toBe(0);
  });

  it("leaves ordinary desktop history untouched", () => {
    render(false);
    render(false);
    expect(window.history.pushState).not.toHaveBeenCalled();
    expect(window.history.back).not.toHaveBeenCalled();
  });

  it("releases a stale overlay entry after reloading the page", () => {
    entries.push({ route: "chat", rethosMobileOverlay: "before-reload" });
    position = 1;
    const dismiss = render(false);
    completeBack();
    expect(position).toBe(0);
    expect(dismiss).not.toHaveBeenCalled();
  });
});
