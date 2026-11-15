import nativeText from "./native-text.cjs";
import environments from "./environments.cjs";
import { CLOUD_SWATCH_COLORS, CLOUD_SWATCHES, swatchColor } from "./place-appearance.mjs";

/** The rail's id for a server of the person's own that signed in with their account and is not saved here. */


/** The swatch a saved colour is offered as (CLOUD_SWATCH_COLORS the other way); null for none, or a colour no swatch has. */
export function swatchOf(color) {
  if (!environments.ENTRY_COLORS.includes(color)) return null;
  return CLOUD_SWATCHES.find(swatch => CLOUD_SWATCH_COLORS[swatch] === color) ?? null;
}

export function placeLook(entry) {
  if (!entry) return null;
  const color = environments.ENTRY_COLORS.includes(entry.color) ? entry.color : null;
  return { name: entry.name, color, swatch: swatchOf(color), change: "local" };
}

/** What the rail's circle says of a look: the swatch of the colour it shows, and why only others change it, if so. */
export const railPaint = (look, color) => (look ? { swatch: swatchOf(color), ...(look.change ? {} : { locked: look.reason ?? "member" }) } : null);

/** What the page sees of it: never the Cloud's id. */
export function pageLook(look) {
  if (!look) return null;
  const { cloudId: _id, ...seen } = look;
  return seen;
}

export function installPlaceLook({ ipcMain, guard, place, save, rail = null, t = nativeText.englishText.t }) {
  const look = () => placeLook(place());
  /** `entry`'s place (none: a server of theirs only the Admin lists) takes `swatch`; `now()` is its look at each step. */
  const recolor = async (entry, now, swatch) => {
    if (!(swatch === null || CLOUD_SWATCHES.includes(swatch))) throw new Error(t("native.places.chooseColor"));
    const current = now();
    if (!current) throw new Error(t("native.places.noColor"));
    if (!current.change) return { outcome: "refused", look: pageLook(current) };
    if (entry) save(entry.id, swatchColor(swatch));
    return { outcome: "saved", look: pageLook(now()) };
  };
  ipcMain.handle("workspaces:look", guard(() => pageLook(look())));
  ipcMain.handle("workspaces:color", guard((_event, swatch) => recolor(place(), look, swatch)));
  if (rail) ipcMain.handle("workspaces:recolor", (event, id, swatch) => {
    if (!rail.owns(event)) throw new Error("workspaces:recolor is only available to the window's rail");
    if (!rail.places().some(listed => listed.id === id && listed.paint)) return Promise.reject(new Error(t("native.places.noLongerHere")));
    const entry = rail.saved(id);
    const now = () => placeLook(rail.saved(id));
    return recolor(entry, now, swatch);
  });
  return { look };
}
