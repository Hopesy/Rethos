import { DesktopWorkspaceSwitcher, openServerMenu } from "./DesktopWorkspaceSwitcher";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";


afterEach(() => { vi.unstubAllGlobals(); });

it("names the saved-server switcher with the product word, not workspace", () => {
  vi.stubGlobal("window", { ogb: { workspaces: { state: () => new Promise(() => {}), menu: () => Promise.resolve() } } });
  const html = renderToStaticMarkup(createElement(DesktopWorkspaceSwitcher));
  expect(html).toContain('aria-label="Switch server: Servers"');
  expect(html).toContain(">Servers<");
  expect(html).not.toMatch(/workspace/i);
});

it("renders nothing outside the desktop app", () => {
  vi.stubGlobal("window", {});
  expect(renderToStaticMarkup(createElement(DesktopWorkspaceSwitcher))).toBe("");
});

const visibleText = (html: string) => html.replace(/<span class="sr-only">.*?<\/span>/g, "").replace(/<!-- -->/g, "").replace(/<[^>]+>/g, "");

it("says My Cloud while a Cloud home is showing, in a browser too, never always on without the plan to say so, and nothing more elsewhere", () => {
  vi.stubGlobal("window", {});
  const browser = renderToStaticMarkup(createElement(DesktopWorkspaceSwitcher, { cloudHome: true }));
  expect(visibleText(browser)).toBe("My Cloud");
  expect(browser).toContain("data-cloud-home-indicator");
  expect(browser).not.toContain("<button");
  const compact = renderToStaticMarkup(createElement(DesktopWorkspaceSwitcher, { cloudHome: true, compact: true }));
  expect(compact).toContain('title="My Cloud"');
  expect(compact).toContain('<span class="sr-only">My Cloud</span>');

  vi.stubGlobal("window", { ogb: { workspaces: { state: () => new Promise(() => {}), menu: () => Promise.resolve() } } });
  const desktop = renderToStaticMarkup(createElement(DesktopWorkspaceSwitcher, { cloudHome: true }));
  expect(visibleText(desktop)).toBe("My Cloud");
  expect(desktop).toContain('aria-label="Switch server: My Cloud"');
  expect(desktop).toContain("data-cloud-home-indicator");
  const elsewhere = renderToStaticMarkup(createElement(DesktopWorkspaceSwitcher));
  expect(elsewhere).not.toContain("always on");
  expect(elsewhere).not.toContain("data-cloud-home-indicator");
});

it("names whose Cloud a browser signed in to under My Cloud, quietly", () => {
  vi.stubGlobal("window", {});
  const browser = renderToStaticMarkup(createElement(DesktopWorkspaceSwitcher, { cloudHome: true, owner: "ada@example.test" }));
  expect(visibleText(browser)).toBe("My Cloudada@example.test’s Cloud");
  expect(browser).toContain('title="My Cloud · ada@example.test’s Cloud"');
  expect(browser).toContain('<span class="block truncate text-[12px] font-normal text-ink-secondary">ada@example.test’s Cloud</span>');
  const compact = renderToStaticMarkup(createElement(DesktopWorkspaceSwitcher, { cloudHome: true, owner: "ada@example.test", compact: true }));
  expect(compact).toContain('<span class="sr-only">My Cloud · ada@example.test’s Cloud</span>');
  expect(renderToStaticMarkup(createElement(DesktopWorkspaceSwitcher, { owner: "ada@example.test" }))).toBe("");
});

it("draws Simple mode's switcher as a rounded pill that names the server in full, swapping to the laptop icon only when the row is too narrow", () => {
  vi.stubGlobal("window", { ogb: { workspaces: { state: () => new Promise(() => {}), menu: () => Promise.resolve() } } });
  const pill = renderToStaticMarkup(createElement(DesktopWorkspaceSwitcher, { inline: true, pill: true }));
  expect(pill).toMatch(/aria-label="Switch server: Servers" aria-haspopup="menu" aria-expanded="false"[^>]*class="[^"]*\bh-8\b[^"]*\brounded-full\b[^"]*\bbg-raised\/50\b[^"]*\btext-\[13px\][^"]*\bfont-medium\b/);
  expect(pill).toContain('<span class="min-w-0 truncate @max-[124px]/sidebar-top:hidden">Servers</span>');
  expect(pill).toContain("lucide-chevron-down");
  expect(pill).toContain('class="lucide lucide-laptop hidden shrink-0 text-ink-secondary @max-[124px]/sidebar-top:block"');
  expect(pill).not.toContain("@max-[96px]");
  const inline = renderToStaticMarkup(createElement(DesktopWorkspaceSwitcher, { inline: true }));
  expect(inline).toContain("lucide-laptop");
  expect(inline).toMatch(/class="[^"]*\bh-7\b[^"]*\brounded-md\b[^"]*\btext-\[13px\]/);
  expect(inline).not.toContain("rounded-full");

  vi.stubGlobal("window", {});
  const browser = renderToStaticMarkup(createElement(DesktopWorkspaceSwitcher, { inline: true, pill: true, cloudHome: true }));
  expect(visibleText(browser)).toBe("My Cloud");
  expect(browser).toMatch(/class="[^"]*\bh-8\b[^"]*\brounded-full\b/);
});

it("opens the saved server menu and reports failures", async () => { const menu = vi.fn().mockResolvedValue(undefined); await openServerMenu({ menu }); expect(menu).toHaveBeenCalledOnce(); menu.mockRejectedValue(new Error("unavailable")); await expect(openServerMenu({ menu })).rejects.toThrow("unavailable"); });
