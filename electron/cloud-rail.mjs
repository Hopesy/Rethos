import nativeText from "./native-text.cjs";
import environments from "./environments.cjs";
import { placeLook, railPaint } from "./place-look.mjs";

export const RAIL_MIN_PLACES = 2;
export const PROFILE_PLACE = "profile:";

export function railPlaces({ saved, home = null, offers = () => false, waiting = () => false, profiles = [], computerSettling = null }) {
  const computer = environments.savedPlace(saved, environments.LOCAL_ID), color = computer.color ?? null;
  const remote = saved.environments.filter(entry => entry.kind !== "local" && entry.origin).map(entry => ({
    id: entry.id, name: entry.name, color: entry.color ?? null, kind: "server", opens: true, removable: true, forget: true,
    paint: railPaint(placeLook(entry), entry.color), ...(entry.id === saved.activeId ? { active: true } : {}),
    ...(waiting(entry.id) ? { attention: true } : {}), ...(offers(entry) ? { makeHome: true } : {}),
  }));
  const own = profiles.map(profile => ({ id: PROFILE_PLACE + profile.id, name: profile.name || computer.name,
    color: profile.color ?? null, kind: "computer", profile: profile.id, opens: true,
    paint: { swatch: profile.swatch ?? null }, ...(profile.name ? { named: true } : {}), ...(profile.active ? { active: true } : {}),
    ...(typeof profile.settling === "string" ? { settling: profile.settling } : {}),
  }));
  const all = [...(home ? [] : [{ id: computer.id, name: computer.name, color, kind: "computer", opens: true, paint: railPaint(placeLook(computer), color),
    ...(saved.activeId === environments.LOCAL_ID && !own.some(place => place.active) ? { active: true } : {}),
    ...(waiting(computer.id) ? { attention: true } : {}), ...(typeof computerSettling === "string" ? { settling: computerSettling } : {}) }]), ...own, ...remote];
  return all.length < RAIL_MIN_PLACES ? [] : all;
}

const plain = value => typeof value === "string" ? value : "";
const CHOICES = Object.freeze(["link", "address"]);

export function installCloudRail({ ipcMain, guard, trusted, lists = trusted, beside = () => false, places, open, add, targets, makeHome = null, forget = null, openProfile = null, local = null, t = nativeText.englishText.t }) {
  let sent = "";
  const allowed = (channel, handler) => guard((event, ...args) => {
    if (!trusted(event)) throw new Error(`${channel} is only available in this app's window`);
    return handler(event, ...args);
  });
  const handle = (channel, handler) => ipcMain.handle(channel, allowed(channel, handler));
  const listed = (channel, handler) => ipcMain.handle(channel, guard((event, ...args) => {
    if (!lists(event)) throw new Error(`${channel} is only available in this app's window`);
    return handler(event, ...args);
  }));
  // ＋'s choices: main's, and a new organization while this account runs a Team plan's organizations (unless the Admin has
  // turned adding them off).
  const choices = () => ({ ...add.choices(), cloud: false, organization: false, account: false, local: local?.creatable() === true });
  ipcMain.handle("workspaces:places", guard((event) => (lists(event) ? { places: places(), add: choices() }
    : { places: [], add: { cloud: false, link: false, address: false, organization: false }, ...(beside() ? { beside: true } : {}) })));
  // A Cloud the Admin is still making has no saved place: its own screen opens, by main's word for which Cloud it is.
  const opening = place => {
    if (!place.profile) { local?.cancel(); return open(place.id); }
    if (!openProfile) throw new Error(t("native.places.noLongerHere"));
    return openProfile(place.profile);
  };
  listed("workspaces:open", async (_event, id) => {
    const place = places().find(entry => entry.id === plain(id) && entry.opens);
    if (!place) throw new Error(t("native.places.noLongerHere"));
    await opening(place);
    return { outcome: "switched" };
  });
  listed("workspaces:remove", async (_event, id) => {
    const place = places().find(entry => entry.id === plain(id) && entry.removable && entry.forget);
    if (!place) throw new Error(t("native.places.noLongerHere"));
    return { outcome: forget ? ((await forget(place.id)) === false ? "failed" : "removed") : "unsupported" };
  });
  // Make … my home, from a circle's menu: only a server main listed with it, by main's own word for it.
  listed("workspaces:make-home", (_event, id) => {
    const place = places().find(entry => entry.id === plain(id) && entry.makeHome);
    if (!place || !makeHome) throw new Error(t("native.home.notAvailable"));
    return makeHome(place.id);
  });
  // A workspace of this computer's own: a new one from ＋ (on the rail's page, or this computer's own from the Server menu),
  // and a name, a colour or its removal from its circle's menu, only for one main listed.
  handle("workspaces:local-new", (_event, name, color) => {
    if (!local?.creatable()) throw new Error(t("native.places.cannotAdd"));
    const made = local.create({ name: plain(name), color: plain(color) || null });
    if (made.outcome === "made" && openProfile) void Promise.resolve().then(() => openProfile(made.id)).catch(() => {});
    return made;
  });
  const profileListed = id => {
    const place = places().find(entry => entry.id === plain(id) && entry.profile && !entry.account);
    if (!place || !local) throw new Error(t("native.places.noLongerHere"));
    return place.profile;
  };
  listed("workspaces:local-edit", (_event, id, changes) => {
    const profile = profileListed(id);
    if (changes && typeof changes.name === "string") return local.rename(profile, changes.name);
    if (changes && Object.hasOwn(changes, "color")) return local.recolor(profile, changes.color === null ? null : plain(changes.color));
    throw new Error(t("native.places.noLongerHere"));
  });
  listed("workspaces:local-remove", (_event, id) => local.remove(profileListed(id)));
  // The Connect sheet's address (a link, or an address with the code typed apart): main finds the server there first,
  // then connects only to what it found.
  listed("workspaces:add", (_event, choice, link, code) => {
    if (!CHOICES.includes(choice) || !add.choices()[choice]) throw new Error(t("native.places.cannotAdd"));
    const pasted = choice === "link" ? plain(link).trim().slice(0, 4096) : "";
    return pasted ? add.run(choice, pasted, typeof code === "string" ? code.trim().slice(0, 256) : null) : add.run(choice);
  });
  listed("workspaces:probe", (_event, address, code) => {
    if (!add.choices().link || !add.probe) throw new Error(t("native.places.cannotAdd"));
    return add.probe(plain(address).trim().slice(0, 4096), plain(code).trim().slice(0, 256));
  });
  return {
    changed() {
      const key = JSON.stringify([places(), choices(), beside()]);
      if (key === sent) return;
      sent = key;
      for (const target of targets()) if (target && !target.isDestroyed()) target.send("workspaces:changed");
    },
  };
}
