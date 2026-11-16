import { companionState, postCompanionMessage, setCompanionE2EHooks } from "./companion.mjs";
import { createCompanionE2E } from "./companion-e2e.mjs";
export { deviceCounts } from "./companion-e2e.mjs";
import { createRelayGrantClient } from "./relay-grant-client.mjs";

const signedOut = () => Promise.reject(Object.assign(new Error("signed out"), { code: "signed_out" }));

export function createDesktopCompanionE2E({ appVersion, readCredentials, updateCredentials, powerMonitor, log, onState }) {
  const client = createRelayGrantClient({ origin: process.env.OMB_CONTROL_PLANE_URL,
    credential: () => readCredentials()?.companionInstallationCredential });
  const e2e = createCompanionE2E({
    readCredentials,
    updateCredentials,
    relayEnabled: Boolean(client),
    fetchGrant: devices => client ? client({ appVersion, devices }) : signedOut(),
    companionState,
    post: postCompanionMessage,
    log,
    onState,
  });
  setCompanionE2EHooks({ initialMessage: () => e2e.message(), tokenRejected: e2e.tokenRejected, changed: () => void e2e.reconcile() });
  powerMonitor?.on("resume", () => e2e.resumed());
  return e2e;
}
