import { expect, it } from "vitest";
import { deciderCredential, researchCredential, voiceCredential } from "./service-credentials.ts";

it("uses the person's provider keys and ignores retired included-service credentials", () => {
  const env = { OMB_CLOUD_VOICE_URL: "https://retired.example", OMB_CLOUD_VOICE_TOKEN: "retired",
    OMB_CLOUD_DECIDER_URL: "https://retired.example", OMB_CLOUD_DECIDER_TOKEN: "retired",
    OMB_CLOUD_X_URL: "https://retired.example", OMB_CLOUD_X_TOKEN: "retired" };
  expect(voiceCredential(undefined, env)).toBeNull();
  expect(deciderCredential(undefined, undefined, env)).toBeNull();
  expect(researchCredential(undefined, env)).toBeNull();
  expect(voiceCredential("own-key", env)).toEqual({ token: "own-key", api: "https://api.elevenlabs.io/v1", included: false });
  expect(deciderCredential("own-key", "https://my-model.example", env)).toEqual({ token: "own-key", api: "https://my-model.example", included: false });
  expect(researchCredential("own-key", env)).toEqual({ token: "own-key", api: "https://treg.to", included: false });
});
