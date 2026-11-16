// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Bot, InstanceInfo } from "@/state/store";
import { setLocale } from "@/lib/i18n";

const fixture = vi.hoisted(() => ({ state: { instances: [] as InstanceInfo[], bots: [] as Bot[], config: {} as Record<string, unknown> }, calls: [] as Array<{ path: string; method?: string }> }));
vi.mock("@/state/store", async (original) => ({
  ...await original<typeof import("@/state/store")>(),
  useStore: () => ({
    state: fixture.state,
    dispatch: (action: { type: string; instances?: InstanceInfo[] }) => { if (action.type === "instances" && action.instances) fixture.state = { ...fixture.state, instances: action.instances }; },
    refreshInstances: async () => {}, refreshModels: async () => {},
  }),
  api: async (path: string, init?: { method?: string }) => {
    fixture.calls.push({ path, method: init?.method });
    if (init?.method !== "DELETE") return {};
    const instanceId = decodeURIComponent(path.split("/").pop()!);
    if (fixture.state.bots.some(bot => bot.modelSelection.instanceId === instanceId)) throw new Error("1 bot(s) use this account");
    return { instances: fixture.state.instances.filter((instance) => instance.instanceId !== instanceId) };
  },
}));
import { EnginesSettings } from "./EnginesSettings";

function lmStudio(instanceId: string): InstanceInfo {
  return {
    instanceId, driverKind: "openai-compat", displayName: "LM Studio", access: "api", url: "http://127.0.0.1:1234/v1",
    snapshot: { state: "available", authenticated: true }, models: { default: "gemma", options: [] },
  } as unknown as InstanceInfo;
}

let container: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  setLocale("en");
  fixture.state = { instances: [lmStudio("openai-compat-a"), lmStudio("openai-compat-b")], bots: [], config: {} };
  fixture.calls = [];
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

const render = async () => {
  await act(async () => { root.render(createElement(EnginesSettings, { simple: true, more: { id: "more", open: true, onToggle: () => {} } })); });
};
const click = async (target: Element | undefined) => { expect(target).toBeTruthy(); await act(async () => { (target as HTMLElement).click(); }); };
const card = (instanceId: string) => container.querySelector(`[data-custom-model="${instanceId}"]`)!;

describe("Settings → AI → custom model connections", () => {
  it("removes the selected duplicate connection and keeps the other one", async () => {
    await render();
    await click(card("openai-compat-b").querySelector('[aria-label="Remove LM Studio"]')!);
    expect(fixture.calls.filter((call) => call.method === "DELETE")).toEqual([{ path: "/api/instances/openai-compat-b", method: "DELETE" }]);
    expect(fixture.state.instances.map((instance) => instance.instanceId)).toEqual(["openai-compat-a"]);
  });

  it("waits until no bot uses the server", async () => {
    fixture.state = { ...fixture.state, bots: [{ id: "kiwi", modelSelection: { instanceId: "openai-compat-b", model: "gemma" } } as unknown as Bot] };
    await render();
    await click(card("openai-compat-b").querySelector('[aria-label="Remove LM Studio"]')!);
    expect(card("openai-compat-b").querySelector('[role="alert"]')?.textContent).toContain("1 bot(s) use this account");
    expect(fixture.state.instances).toHaveLength(2);
  });
});
