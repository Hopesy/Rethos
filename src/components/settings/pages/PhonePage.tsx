

import { t } from "@/lib/i18n";
import { useStore } from "@/state/store";
import { PhoneDevicesSection } from "../../PhoneDevicesSection";

import { PlaceBadge } from "../SettingsNav";
import { ServerPairingCard } from "../../ServerPairingCard";
import { SettingsGroup, SettingsLinkRow, SettingsRows } from "../../SettingsPrimitives";
import { useOtherPlaces } from "../settings-context";
import { useSettingsShell } from "../settings-shell";

/** The phones of the person's other places, one row each. A place already offered by the "Pair with My Cloud" callout at
 * the top is left out, so one screen never has two doors to the same place. */
function OtherPlaces() {
  const { ctx } = useSettingsShell();
  const others = useOtherPlaces("phone");
  if (!ctx.desktop || ctx.client || others.length === 0) return null;
  return (
    <SettingsGroup label={t("settings.otherPlaces")} block="other-places">
      <SettingsRows icons>
        {others.map((place) => (
          <SettingsLinkRow key={place.key} title={place.name} subtitle={t("phone.otherPlace.line", { place: place.name })}
            leading={<PlaceBadge place={{ kind: place.kind === "computer" ? "computer" : "cloud", name: place.name, color: place.color }} size={24} />}
            external onClick={place.open} data={{ "data-other-place": place.key }} />
        ))}
      </SettingsRows>
    </SettingsGroup>
  );
}

export function PhonePage() {
  const { ctx, place } = useSettingsShell();
  const { state } = useStore();
  const focus = state.appSettingsPhonePairing;
  return <>
    {ctx.here
      ? <PhoneDevicesSection profileEmail={state.config?.profile?.email} focusRequest={focus} simple={!ctx.advanced} placeName={place.name} />
      : <ServerPairingCard cloudHome={ctx.cloud} focusRequest={focus} team={state.config?.team?.name} placeName={place.name} simple={!ctx.advanced}
        teamPhoneBlocked={state.config?.managedPolicy?.remoteAccess === false ? t("policy.teamRemoteBlocked", { organization: state.config.managedPolicy.organizationName }) : null} />}
    <OtherPlaces />
  </>;
}
