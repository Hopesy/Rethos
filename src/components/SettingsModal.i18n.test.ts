// The trap is module scope: SECTIONS is built once at import time, and a label resolved there would keep the boot
// language.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { setLocale, t } from "@/lib/i18n";
import { en, locales } from "@/locales";
import { StoreProvider } from "@/state/store";

// No DOM here: the screen only asks whether the desktop bridge is there, so an empty window answers as a browser tab
// does.
beforeAll(() => {
  (globalThis as { window?: unknown }).window ??= {};
  // The skin picker reads the attribute main.tsx stamps before first paint.
  (globalThis as { document?: unknown }).document ??= { documentElement: { dataset: {} } };
});

// Pinned to Advanced: these cover the Advanced rail. Analytics (mocked below) boots PostHog on import, which wants a
// real browser.
vi.mock("@/lib/interface-mode", () => ({ useAdvancedMode: () => true, setAdvancedMode: () => {} }));
vi.mock("@/lib/analytics", () => ({
  analyticsEnabled: () => false,
  setAnalyticsEnabled: () => {},
}));

async function renderSettings(): Promise<string> {
  const { SettingsModal } = await import("./SettingsModal");
  return renderToStaticMarkup(createElement(StoreProvider, null, createElement(SettingsModal)));
}

afterEach(() => {
  setLocale("en");
});

describe("Settings → General", () => {
  it("renders in the language the picker selected, and re-renders in the next one", async () => {
    setLocale("pt-br");
    const pt = await renderSettings();
    expect(pt).toContain("Configurações");
    expect(pt).toContain(t("settings.section.phoneDevices"));

    // Same module instance, no reload: a frozen label would still say "Provedores de modelos" here.
    setLocale("ja");
    const ja = await renderSettings();
    expect(ja).toContain("設定");
    expect(ja).toContain(t("settings.section.phoneDevices"));
    for (const key of [
      "settings.section.appearance", "settings.section.phoneDevices", "settings.page.browser",
    ] as const) {
      expect(locales.ja[key], key).toBeTruthy();
      expect(locales.ja[key], key).not.toBe(en[key]);
      expect(ja, key).toContain(locales.ja[key]!);
    }
    expect(ja).not.toContain("Provedores de modelos");
  });

  it("stays English when no language is picked", async () => {
    setLocale("en");
    const en = await renderSettings();
    expect(en).toContain("Settings");
    expect(en).toContain("Phone &amp; devices");
  });

  it("keeps labeled desktop navigation alongside the responsive settings sheet", async () => {
    const html = await renderSettings();
    expect(html).toContain('data-settings-section="phone"');
    expect(html).toContain('<nav aria-label="Settings"');
    expect(html).toContain('id="app-settings-title" class="sr-only"');
  });
});
