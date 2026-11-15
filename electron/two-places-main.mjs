import { handSaved, serverRequests } from "./own-home-main.mjs";
import { createTwoPlaces, installTwoPlaces } from "./two-places.mjs";
import nativeText from "./native-text.cjs";

/** How often main looks whether the places changed (a server said it is the person's own, My Cloud became ready). */
const WATCH_MS = 60_000;
const ROUTE = "/api/places/elsewhere";

async function json(response) {
  if (!response.ok) { await response.body?.cancel(); return null; }
  try { return await response.json(); } catch { return null; }
}
async function sent(response, what) {
  await response.body?.cancel();
  if (!response.ok) throw Object.assign(new Error(`${what} answered ${response.status}`), { status: response.status });
}

export function installTwoPlacesMain({ ipcMain, guard, localRequest, fetch: fetchImpl, environments, ownHome, dismissed, tell, log = () => {}, t = nativeText.englishText.t }) {
  const put = (payload) => ({ method: "PUT", body: JSON.stringify(payload), signal: AbortSignal.timeout(10_000) });
  const places = () => {
    const out = [];
    for (const place of environments().filter((entry) => handSaved(entry) && ownHome.owns(entry))) {
      const server = serverRequests(place, fetchImpl);
      out.push({ key: `server:${place.origin}`, name: place.name, kind: "server",
        read: async () => json(await server.request("GET", "/api/cloud-send?move=1", { signal: AbortSignal.timeout(10_000) })),
        tell: async (payload) => sent(await server.request("PUT", ROUTE, { ...put(payload), headers: { "content-type": "application/json" } }), place.name),
        ...(ownHome.offers(place) ? { bring: () => ownHome.start(place.id) } : {}) });
    }
    return out;
  };
  const moved = () => ownHome.away();
  const settled = () => !ownHome.active();
  let label = null;
  const twoPlaces = createTwoPlaces({
    local: async () => (moved() ? null : json(await localRequest("/api/cloud-send?move=1", { signal: AbortSignal.timeout(10_000) }))),
    here: {
      name: async () => (label ??= (await json(await localRequest("/.well-known/openmausbot/environment", { signal: AbortSignal.timeout(10_000) })))?.label ?? null),
      tell: async (payload) => sent(await localRequest(ROUTE, { ...put(payload), headers: { "content-type": "application/json" } }), t("rail.thisComputer")),
    },
    t, places, settled, quiet: () => !settled() && !moved(), dismissed, onChange: tell, log });
  installTwoPlaces({ ipcMain, guard, twoPlaces });
  let watched = "";
  const watch = setInterval(() => {
    ownHome.refresh();
    const now = JSON.stringify([settled(), moved(), places().map((place) => [place.key, Boolean(place.bring)])]);
    if (now !== watched) { watched = now; void twoPlaces.refresh({ force: true }); } else void twoPlaces.refresh();
  }, WATCH_MS);
  watch.unref?.();
  return { ...twoPlaces, close: () => clearInterval(watch) };
}
