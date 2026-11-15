export async function openStartPlace({ places, profiles, server, show, log = () => {} }) {
  let last;
  try { last = places.remembered(); }
  catch (error) { if (error?.code !== "ENOENT") log(`start: saved workspace could not be read (${error?.message ?? error})`); }
  if (last?.profile && profiles && await profiles.open(last.profile) === true) return "remembered";
  if (last?.server && await server(last.server).catch(() => false)) return "remembered";
  if (last) {
    log("start: the saved workspace is unavailable; opening the current workspace");
    places.remember(null);
  }
  await show();
  return "home";
}
