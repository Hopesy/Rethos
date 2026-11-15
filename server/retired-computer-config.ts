import type { JsonValue } from "./schema.ts";

export function migrateRetiredComputerConfig(value: JsonValue): JsonValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const next = { ...value };
  delete next.box;
  const defaults = next.newBotDefaults;
  if (!defaults || typeof defaults !== "object" || Array.isArray(defaults)) return next;
  const migratedDefaults = { ...defaults };
  const profile = defaults.profile;
  if (profile && typeof profile === "object" && !Array.isArray(profile) &&
      (profile.cloudBackend === "box" || (profile.computer === "cloud" && profile.cloudBackend !== "vps"))) {
    const migrated = { ...profile };
    delete migrated.cloudBackend;
    if (migrated.computer === "cloud") delete migrated.computer;
    migratedDefaults.profile = migrated;
  }
  if (Array.isArray(defaults.routines)) migratedDefaults.routines = defaults.routines.map(routine =>
    routine && typeof routine === "object" && !Array.isArray(routine) && routine.runOn === "cloud" ? { ...routine, runOn: "maus", enabled: false } : routine);
  next.newBotDefaults = migratedDefaults;
  return next;
}
