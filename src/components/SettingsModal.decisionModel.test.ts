import { describe, expect, it } from "vitest";
import { fullContext, resolveSettingsTarget, searchSettings } from "./settings/settings-index";
import { t } from "@/lib/i18n";

describe("decision and extraction settings", () => {
  it("opens the routing section from existing settings links", () => {
    expect(resolveSettingsTarget("decisionModel", fullContext())).toEqual({ page: "ai", anchor: "routing" });
  });
  it("finds routing by its supported providers and functions", () => {
    for (const query of ["decision", "extraction", "jev", "typesafe", "cloudflare", "workers ai", "routing"]) {
      const hits = searchSettings(query, fullContext(), entry => t(entry.labelKey!), page => t(page.labelKey));
      expect(hits.some(hit => hit.entry.id === "routing"), query).toBe(true);
    }
  });
});
