import type { CloudBackend } from "../../shared/wire";
import { useStore } from "@/state/store";
import { t } from "@/lib/i18n";
import { SettingsHelp } from "./SettingsHelp";

export function CloudBackendPicker({
  value,
  onChange,
}: {
  value: CloudBackend;
  compact?: boolean;
  onChange: (backend: CloudBackend) => void;
}) {
  const { state } = useStore();
  if (state.config?.cloudHome || value === "vps") return null;
  return (
    <div className="mt-3 rounded-lg bg-inset p-3">
      <div className="flex items-center gap-1 text-[12px] font-medium text-ink">{t("computer.remote.title")}
        <SettingsHelp label={t("computer.remote.title")}>{t("computer.remote.help")}</SettingsHelp>
      </div>
      <div className="mt-0.5 text-[12px] text-ink-secondary">
        {t("botAccess.cloud.vpsSummary")}
      </div>
      <button type="button" onClick={() => onChange("vps")} className="mt-2 rounded-lg border border-hairline/40 px-3 py-1.5 text-[12px] text-ink hover:bg-control">
        {t("computer.remote.enable")}
      </button>
    </div>
  );
}
