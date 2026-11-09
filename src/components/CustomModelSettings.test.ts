// @vitest-environment happy-dom
import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { InstanceInfo } from "@/state/store";
import { setLocale } from "@/lib/i18n";

const fixture = vi.hoisted(() => ({ api: vi.fn(), dispatch: (_action: any) => {}, refresh: vi.fn() }));
vi.mock("@/state/store", async original => ({
  ...(await original<typeof import("@/state/store")>()),
  api: fixture.api,
  useStore: () => ({ dispatch: fixture.dispatch, refreshInstances: fixture.refresh }),
}));
const { CustomModelCard } = await import("./CustomModelSettings");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
let initial: InstanceInfo;
let saved: InstanceInfo;
function Harness() {
  const [server, setServer] = useState(initial);
  fixture.dispatch = action => setServer(action.instances[0]);
  return createElement(CustomModelCard, { server });
}
const findButton = (text: string) => [...host.querySelectorAll("button")].find(button => button.textContent === text || button.getAttribute("aria-label") === text)!;
const checkbox = (id: string) => [...host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find(input => input.closest("label")?.textContent === id)!;
const click = async (element: HTMLElement) => { await act(async () => element.click()); };
const fill = async (input: HTMLInputElement, value: string) => {
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
};
const open = async () => { await act(async () => root.render(createElement(Harness))); await click(findButton("Select models")); };

beforeEach(() => {
  setLocale("en");
  document.documentElement.dataset.reducedMotion = "true";
  initial = { instanceId: "wb", displayName: "Existing", driverKind: "openai-compat", url: "https://example.test/v1",
    openaiEndpoint: { protocol: "chat", models: ["model-a"], defaultModel: "model-a", keySaved: true } } as InstanceInfo;
  saved = structuredClone(initial);
  fixture.api.mockReset();
  fixture.api.mockImplementation(async (path: string, init: RequestInit) => {
    if (path.endsWith("/models")) return { models: ["model-a", "model-b", "model-c"] };
    const body = JSON.parse(String(init.body));
    saved = { ...saved, ...(body.displayName ? { displayName: body.displayName } : {}), openaiEndpoint: { ...saved.openaiEndpoint!, models: body.models, defaultModel: body.defaultModel } };
    return { instances: [saved] };
  });
  host = document.createElement("div"); host.setAttribute("role", "dialog"); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); delete document.documentElement.dataset.reducedMotion; });

it("keeps selection open across automatic saves and persists a new default without resending the key", async () => {
  await open();
  await click(checkbox("model-b"));
  expect(checkbox("model-b").checked).toBe(true);
  await click(findButton("Set model-b as default"));
  expect(saved.openaiEndpoint?.defaultModel).toBe("model-b");
  await click(checkbox("model-c"));
  const writes = fixture.api.mock.calls.filter(([, init]) => init.method === "PATCH");
  expect(writes.map(([, init]) => JSON.parse(init.body))).toEqual([
    { models: ["model-a", "model-b"], defaultModel: "model-a" },
    { models: ["model-a", "model-b"], defaultModel: "model-b" },
    { models: ["model-a", "model-b", "model-c"], defaultModel: "model-b" },
  ]);
  expect(host.querySelector('button[aria-expanded="true"]')).not.toBeNull();
  expect(host.querySelector<HTMLInputElement>('input[type="password"]')?.value).toBe("");
});

it("rolls selection back after a failed save and retains the list for retry", async () => {
  await open();
  fixture.api.mockRejectedValueOnce(new Error("Connection busy"));
  await click(checkbox("model-b"));
  expect(checkbox("model-b").checked).toBe(false);
  expect(host.querySelector('[role="alert"]')?.textContent).toBe("Connection busy");
  await click(checkbox("model-b"));
  expect(checkbox("model-b").checked).toBe(true);
});

it("offers manual model entry after an unavailable catalog", async () => {
  fixture.api.mockResolvedValueOnce({ models: [], error: "unavailable" });
  await open();
  await fill(host.querySelector<HTMLInputElement>("input[data-menu-search]")!, "manual/model");
  await click(findButton('Add “manual/model”'));
  expect(saved.openaiEndpoint?.models).toEqual(["model-a", "manual/model"]);
  expect(host.textContent).toContain("Model list unavailable");
});

it("discards stale discovery and stages models until changed connection details are saved", async () => {
  let resolve!: (result: unknown) => void;
  let signal: AbortSignal;
  fixture.api.mockImplementationOnce((_path, init) => { signal = init.signal; return new Promise(done => { resolve = done; }); });
  await open();
  await fill(host.querySelector<HTMLInputElement>('input[aria-label="API address"]')!, "https://new.example/v1");
  expect(signal!.aborted).toBe(true);
  await act(async () => resolve({ models: ["stale-model"] }));
  expect(host.textContent).not.toContain("stale-model");
  await fill(host.querySelector<HTMLInputElement>('input[type="password"]')!, "replacement-key");
  await fill(host.querySelector<HTMLInputElement>("input[data-menu-search]")!, "manual/new");
  await click(findButton('Add “manual/new”'));
  expect(fixture.api.mock.calls.filter(([, init]) => init.method === "PATCH")).toHaveLength(0);
  await click(findButton("Save"));
  const body = JSON.parse(fixture.api.mock.calls.at(-1)![1].body);
  expect(body).toMatchObject({ url: "https://new.example/v1", key: "replacement-key", models: ["model-a", "manual/new"] });
});

it("disables writes while a save is pending", async () => {
  await open();
  let resolve!: (result: unknown) => void;
  fixture.api.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await click(checkbox("model-b"));
  expect(checkbox("model-c").disabled).toBe(true);
  await click(checkbox("model-c"));
  expect(fixture.api.mock.calls.filter(([, init]) => init.method === "PATCH")).toHaveLength(1);
  await act(async () => resolve({ instances: [{ ...initial, openaiEndpoint: { ...initial.openaiEndpoint, models: ["model-a", "model-b"] } }] }));
});

it("selects a protocol through the shared menu and saves it explicitly", async () => {
  await act(async () => root.render(createElement(Harness)));
  await click(findButton("API protocol"));
  expect(host.querySelector('[role="menu"]')).not.toBeNull();
  await click(findButton("Responses"));
  expect(fixture.api).not.toHaveBeenCalled();
  await click(findButton("Save"));
  expect(JSON.parse(fixture.api.mock.calls.at(-1)![1].body)).toMatchObject({ protocol: "responses" });
  expect(host.querySelector('select')).toBeNull();
  expect(host.querySelector('details')).toBeNull();
});

it("creates a connection using the API host as its name without a name field", async () => {
  await act(async () => root.render(createElement(CustomModelCard)));
  await fill(host.querySelector<HTMLInputElement>('input[aria-label="API address"]')!, "https://models.example/v1");
  await fill(host.querySelector<HTMLInputElement>('input[type="password"]')!, "new-key");
  await click(findButton("Select models"));
  await click(checkbox("model-b"));
  await click(findButton("Save"));
  const [path, init] = fixture.api.mock.calls.at(-1)!;
  expect(path).toBe("/api/instances/openai-compat");
  expect(JSON.parse(init.body)).toMatchObject({ displayName: "models.example", url: "https://models.example/v1", key: "new-key", models: ["model-b"], defaultModel: "model-b" });
});
