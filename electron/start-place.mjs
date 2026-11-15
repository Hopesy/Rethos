export async function openStartPlace({ places, profiles, server, show, log = () => {} }) {
  const last = places.remembered();
  if (last?.profile && profiles && await profiles.open(last.profile) === true) return "remembered";
  if (last?.server && await server(last.server).catch(() => false)) return "remembered";
  if (last) {
    log("start: the saved workspace is unavailable; opening the current workspace");
    places.remember(null);
  }
  await show();
  return "home";
}
