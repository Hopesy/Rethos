export function createLendingTarget({ environments, ownHome, clean = null }) {
  const home = () => clean?.stranded() ? null : ownHome();
  const environment = () => {
    const own = home();
    return own ? environments().find(entry => entry.origin === own.origin) ?? null : null;
  };
  return {
    cloud(env = null) {
      const own = home();
      return own && env?.origin === own.origin ? { status: "connected", accountId: "own:" + own.environmentId, origin: own.origin } : null;
    },
    environment,
    places: () => { const place = environment(); return place ? [place] : []; },
  };
}
