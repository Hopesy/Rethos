import type { CloudBackend } from "../../shared/wire";
import { cn } from "@/lib/cn";
import { useStore } from "@/state/store";
import { t } from "@/lib/i18n";
import { SettingsHelp } from "./SettingsHelp";

export function CloudBackendPicker({
  value,
  compact = false,
  onChange,
}: {
  value: CloudBackend;
  compact?: boolean;
  onChange: (backend: CloudBackend) => void;
}) {
  const { state } = useStore();
  if (state.config?.cloudHome) return null;
  return (
    <div className="mt-3 rounded-lg bg-inset p-3">
      <div className="flex items-center gap-1 text-[12px] font-medium text-ink">{compact ? t("botAccess.cloud.provider") : t("botAccess.cloud.backend")}
        <SettingsHelp label={t("botAccess.cloud.backend")}>{t(value === "vps" ? "botAccess.cloud.vpsAutoDescription" : "botAccess.cloud.hostedBackendDescription")}</SettingsHelp>
      </div>
      <div className="mt-0.5 text-[12px] text-ink-secondary">
        {t(value === "vps" ? "botAccess.cloud.vpsSummary" : "botAccess.cloud.hostedSummary")}
      </div>
      <div className="mt-2 flex overflow-hidden rounded-lg border border-hairline/40">
        {(["box", "vps"] as const).map((backend, i) => (
          <button
            key={backend}
            onClick={() => onChange(backend)}
            className={cn(
              "flex-1 py-1.5 text-[12px]",
              i > 0 && "border-l border-hairline/40",
              value === backend ? "bg-raised text-ink" : "text-ink-secondary hover:bg-raised/60 hover:text-ink",
            )}
          >
            {backend === "vps" ? t("botAccess.cloud.selfHostedVps") : t("botAccess.cloud.boat")}
          </button>
        ))}
      </div>
    </div>
  );
}
