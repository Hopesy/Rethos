import assert from "node:assert/strict";
import test from "node:test";

import { createLendingTarget } from "./lending-target.mjs";
test("automatic lending follows the chosen server identity and ends when it is no longer home", () => {
  const server = { id: "vps", origin: "https://vps.test" }, other = { id: "other", origin: "https://other.test" };
  let own = null, stranded = false;
  const target = createLendingTarget({ environments: () => [server, other], ownHome: () => own, clean: { stranded: () => stranded } });
  assert.deepEqual(target.places(), []); assert.equal(target.cloud(server), null);
  own = { origin: server.origin, environmentId: "server-identity" };
  assert.deepEqual(target.places(), [server]); assert.equal(target.environment(), server);
  assert.deepEqual(target.cloud(server), { status: "connected", origin: server.origin, accountId: "own:server-identity" });
  assert.equal(target.cloud(other), null);
  stranded = true; assert.deepEqual(target.places(), []);
  stranded = false; own = null; assert.equal(target.cloud(server), null);
});
