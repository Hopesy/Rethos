import { useState } from "react";
import { t } from "@/lib/i18n";
import { api } from "@/state/api";
import { profileLabel } from "../../SidebarProfileMenu";
import { SettingRow, SettingsGroup, SettingsLinkRow, SettingsRows } from "../../SettingsPrimitives";
import { useYou } from "../account-summary";
import { useSettingsShell } from "../settings-shell";
import { SignOutConfirm } from "../SignOutConfirm";

export function AccountPage() {
  const { place, go } = useSettingsShell();
  const { profile, session } = useYou();
  const [signingOut, setSigningOut] = useState(false);
  return <SettingsGroup block="you">
    <SettingsRows>
      <SettingsLinkRow title={t("settings.account.nameRow")} value={profileLabel(profile)} onClick={() => go("bots", "about-you")} />
      <SettingRow title={t("settings.account.signedInTo", { place: place.name })} subtitle={profile?.email}>{null}</SettingRow>
      {session?.kind === "session" && <SettingRow title={t("settings.account.signOutBrowser")}>
        <button type="button" className="settings-quiet cursor-pointer" onClick={() => setSigningOut(true)}>{t("settings.account.signOutShort")}</button>
      </SettingRow>}
    </SettingsRows>
    {signingOut && <SignOutConfirm browser here={place.name} onConfirm={() => api("/api/auth/logout", { method: "POST" }).finally(() => location.reload())} onClose={() => setSigningOut(false)} />}
  </SettingsGroup>;
}
