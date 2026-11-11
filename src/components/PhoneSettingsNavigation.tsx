import { ChevronLeft, ChevronRight, X, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { t } from "@/lib/i18n";
import type { AppSettingsSection } from "@/state/store";

type Entry = { id: AppSettingsSection; label: string; icon: LucideIcon };
export function PhoneSettingsNavigation({ groups, search, onSelect, onClose, children }: {
  groups: { label?: string; entries: Entry[] }[];
  search: ReactNode;
  onSelect: (id: AppSettingsSection) => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  return <div data-phone-settings-index className="flex min-h-0 w-full flex-col">
    <PhoneSettingsHeader title={t("settings.title")} onClose={onClose} />
    <div className="px-4 pb-3">{search}</div>
    <nav aria-label={t("settings.title")} className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-6">
      {groups.map((group, index) => group.entries.length > 0 && <section key={index}>
        {group.label && <h3 className="px-2 pb-2 text-sm text-ink-secondary">{group.label}</h3>}
        <div className="overflow-hidden rounded-2xl border border-hairline bg-card">
          {group.entries.map(({ id, label, icon: Icon }) => <button key={id} type="button" data-phone-settings-section={id} onClick={() => onSelect(id)}
            className="flex min-h-14 w-full items-center gap-3 border-b border-hairline px-4 text-left text-base last:border-b-0 hover:bg-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus">
            <Icon size={20} aria-hidden /><span className="min-w-0 flex-1">{label}</span><ChevronRight size={18} aria-hidden className="text-ink-secondary" />
          </button>)}
        </div>
      </section>)}
      {children}
    </nav>
  </div>;
}

export function PhoneSettingsHeader({ title, onBack, onClose }: { title: string; onBack?: () => void; onClose: () => void }) {
  return <header className="flex min-h-16 shrink-0 items-center gap-2 px-3 text-ink">
    {onBack && <button type="button" data-phone-settings-back onClick={onBack} aria-label={t("sidebar.back")} className="flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-raised"><ChevronLeft size={22} /></button>}
    <h2 className="min-w-0 flex-1 truncate px-1 text-lg font-semibold">{title}</h2>
    <button type="button" onClick={onClose} aria-label={t("settings.close")} className="flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-raised"><X size={22} /></button>
  </header>;
}
