import { JEV_DEFAULT_BASE_URL } from "./decider/jev.ts";

export interface ServiceCredential { token: string; api: string; included: boolean }
export const ELEVENLABS_API_DEFAULT = "https://api.elevenlabs.io/v1";
export const TREG_API_DEFAULT = "https://treg.to";
const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);
export const elevenLabsProviderApi = (env: NodeJS.ProcessEnv = process.env): string => env.OMB_ELEVENLABS_API || ELEVENLABS_API_DEFAULT;
export function voiceCredential(own: string | undefined, env: NodeJS.ProcessEnv = process.env): ServiceCredential | null {
  return own?.trim() ? { token: own.trim(), api: elevenLabsProviderApi(env), included: false } : null;
}
export function deciderCredential(own: string | undefined, ownBaseUrl: string | undefined, _env: NodeJS.ProcessEnv = process.env): ServiceCredential | null {
  return own?.trim() ? { token: own.trim(), api: ownBaseUrl?.trim() || JEV_DEFAULT_BASE_URL, included: false } : null;
}
export function tregProviderApi(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.OMB_TREG_URL?.trim().replace(/\/+$/, "");
  if (!configured) return TREG_API_DEFAULT;
  try {
    const parsed = new URL(configured);
    return parsed.protocol === "https:" || (parsed.protocol === "http:" && LOOPBACK.has(parsed.hostname)) ? configured : TREG_API_DEFAULT;
  } catch { return TREG_API_DEFAULT; }
}
export function researchCredential(own: string | undefined, env: NodeJS.ProcessEnv = process.env): ServiceCredential | null {
  return own?.trim() ? { token: own.trim(), api: tregProviderApi(env), included: false } : null;
}
