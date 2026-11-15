import assert from "node:assert/strict";
import test from "node:test";
import { createRelayGrantClient, relayBrokerOrigin } from "./relay-grant-client.mjs";

test("relay has no implicit service and requires a valid explicitly configured broker", () => {
  for (const origin of [undefined, "", "http://public.test", "https://user:secret@broker.test", "https://broker.test/path"]) {
    assert.equal(relayBrokerOrigin(origin), null);
    assert.equal(createRelayGrantClient({ origin, credential: () => "fixture" }), null);
  }
  assert.equal(relayBrokerOrigin("https://broker.example.test"), "https://broker.example.test");
});

test("a user's broker receives only its credential and the relay grant request", async () => {
  const calls = [];
  const read = createRelayGrantClient({ origin: "https://broker.example.test", credential: () => "fixture-token",
    fetch: async (url, init) => { calls.push({ url, init }); return Response.json({ token: "fixture.grant" }); } });
  assert.deepEqual(await read({ appVersion: "1.0", devices: { e2e: 1, legacy: 0 } }), { token: "fixture.grant" });
  assert.equal(calls[0].url, "https://broker.example.test/v1/installations/self/relay-token");
  assert.equal(calls[0].init.headers.authorization, "Bearer fixture-token");
  assert.equal(calls[0].init.redirect, "error");
});
