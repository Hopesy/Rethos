import { expect, it } from "vitest";
import { FakeChrome } from "../testing/fake-chrome.ts";
import { CdpBrowser } from "./browser.ts";

it("finishes competing window fits at the most recently requested page size", async () => {
  const chrome = new FakeChrome();
  const browser = await CdpBrowser.connect(chrome);
  try {
    await browser.waitForPage();
    let first = true;
    chrome.delay = method => {
      if (method !== "Browser.getWindowForTarget" || !first) return 0;
      first = false;
      return 80;
    };
    await Promise.all([
      browser.setViewport({ width: 1500, height: 1000 }),
      browser.setViewport({ width: 1280, height: 800 }),
    ]);
    expect(chrome.viewport).toEqual({ width: 1280, height: 800 });
  } finally {
    await browser.close();
  }
});
