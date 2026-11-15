import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import en from "@/locales/en.json";

const fixture = vi.hoisted(() => ({ config: null as unknown }));
vi.mock("@/state/store", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/state/store")>();
  return { ...original, useStore: () => ({ state: { ...original.initialState, config: fixture.config }, dispatch: vi.fn() }) };
});

const { CloudBackendPicker } = await import("./CloudBackendPicker");
const picker = (value: "box" | "vps" = "box") => renderToStaticMarkup(createElement(CloudBackendPicker, { value, onChange: () => {} }));

describe("CloudBackendPicker", () => {
  afterEach(() => { fixture.config = null; });

  it("offers only a self-hosted remote desktop", () => {
    fixture.config = { cloudHome: false };
    expect(picker()).toContain("Enable self-hosted remote desktop");
    expect(picker()).not.toContain("Boat");
  });

  it("is hidden on My Cloud", () => {
    fixture.config = { cloudHome: true };
    expect(picker()).toBe("");
  });

  it("hides the setup choice once the self-hosted connection is selected", () => {
    expect(picker("vps")).toBe("");
  });

  it("leaves no message that tells someone to switch backends for an engine", () => {
    expect(Object.keys(en)).not.toContain("computer.err.vpsEngine");
    expect(Object.values(en).filter((value) => /switch the cloud backend to Boat/i.test(value))).toEqual([]);
  });
});
