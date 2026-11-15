export function relayBrokerOrigin(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return (url.protocol === "https:" || (url.protocol === "http:" && local)) && !url.username && !url.password &&
      url.pathname === "/" && !url.search && !url.hash ? url.origin : null;
  } catch { return null; }
}

export function createRelayGrantClient({ origin, credential, fetch: request = globalThis.fetch }) {
  const broker = relayBrokerOrigin(origin);
  if (!broker) return null;
  return async ({ appVersion, devices }) => {
    const token = credential();
    if (typeof token !== "string" || !token) throw Object.assign(new Error("Relay credentials are missing"), { code: "signed_out" });
    const response = await request(`${broker}/v1/installations/self/relay-token`, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(15_000),
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ appVersion, devices }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw Object.assign(new Error(`Relay broker answered ${response.status}`), { code: response.status === 401 || response.status === 403 ? "signed_out" : "network_unavailable" });
    }
    return response.json();
  };
}
