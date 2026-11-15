import { randomBytes, randomUUID } from "node:crypto";

export const computerId = value => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);

export function deviceCredentials(previous, info, sameOwner = true) {
  const same = sameOwner && previous?.environmentId === info.environmentId && computerId(previous.id) && /^[a-f0-9]{64}$/.test(previous.secret);
  return { id: same ? previous.id : randomUUID(), secret: same ? previous.secret : randomBytes(32).toString("hex"), grantRevision: randomUUID() };
}

export function cloudGrant(kept, env, current, info, { folders = [], screen, internet, terminal, chrome }) {
  const bound = kept?.cloud?.accountId === current.accountId && kept.cloud.origin === env.origin;
  const identity = bound && info.environmentId === null ? { sessionId: kept.sessionId, environmentId: kept.environmentId } : info;
  return { ...identity, ...deviceCredentials(kept, identity, bound), enabled: true, folders,
    terminal: terminal === true, computer: screen === true, internet: internet === true, chrome: chrome === true,
    cloud: { accountId: current.accountId, origin: env.origin } };
}
