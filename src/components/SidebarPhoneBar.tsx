import { ChevronLeft, FolderOpen, LayoutGrid, Puzzle, Search, UsersRound, X, Zap } from "lucide-react";
import { useEffect, useRef, type CSSProperties } from "react";

import { useCloudFilesReady } from "@/lib/cloud-files";
import { t } from "@/lib/i18n";
import { useStore } from "@/state/store";

import { CloudRoomCard } from "./CloudRoomCard";
import { CloudUsageCard } from "./CloudUsageMeter";
import { useAutomationsNeedYou } from "./SidebarFooterNav";
import { SidebarPopoverMenu, type SidebarMenuItem } from "./SidebarPopoverMenu";
import { SidebarProfileMenu } from "./SidebarProfileMenu";
import { UpdateIndicator } from "./UpdateIndicator";

export function SidebarPhoneHeading({ open, onClose, style }: { open: boolean; onClose: () => void; style?: CSSProperties }) {
  const backRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) backRef.current?.focus({ preventScroll: true });
  }, [open]);
  return <>
    <button ref={backRef} type="button" data-sidebar-back onClick={onClose} aria-label={t("sidebar.back")}
      className="-ml-2 flex h-11 shrink-0 items-center gap-1 rounded-xl px-2 text-base text-ink hover:bg-raised focus-visible:outline-2 focus-visible:outline-focus" style={style}>
      <ChevronLeft size={22} aria-hidden="true" />{t("sidebar.back")}
    </button>
    <h2 className="min-w-0 flex-1 truncate px-3 text-center text-base font-semibold text-ink">{t("sidebar.chats")}</h2>
  </>;
}

export function SidebarPhoneBar() {
  const { state, dispatch } = useStore();
  const automationsNeedYou = useAutomationsNeedYou();
  const filesReady = useCloudFilesReady();
  const items: SidebarMenuItem[] = [
    {
      key: "automations",
      label: t("sidebar.nav.automations"),
      icon: <Zap size={18} />,
      active: state.activeView === "routines",
      attention: automationsNeedYou,
      onSelect: () => dispatch({ type: "showRoutines", view: "list" }),
    },
    {
      key: "team-map",
      label: t("sidebar.nav.teamMap"),
      icon: <UsersRound size={18} />,
      active: state.activeView === "team-map",
      onSelect: () => dispatch({ type: "showTeamMap" }),
    },
    ...(filesReady ? [{
      key: "files",
      label: t("sidebar.nav.files"),
      icon: <FolderOpen size={18} />,
      active: state.activeView === "files",
      onSelect: () => dispatch({ type: "showFiles" }),
    }] : []),
    {
      key: "apps",
      label: t("sidebar.nav.apps"),
      icon: <Puzzle size={18} />,
      active: state.pluginsOpen,
      onSelect: () => dispatch({ type: "togglePlugins", open: true }),
    },
  ];
  return (
    <div data-sidebar-phone-bar className="border-t border-hairline px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      <CloudRoomCard />
      <CloudUsageCard />
      <div className="flex items-center gap-2 not-first:mt-2">
        <div className="min-w-0 flex-1"><SidebarProfileMenu /></div>
        <SidebarPopoverMenu
          items={items}
          ariaLabel={t("sidebar.tools")}
          triggerClassName="shrink-0 rounded-xl"
          triggerTitle={t("sidebar.tools")}
          renderTrigger={({ open }) => (
            <span className={`relative flex h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm text-ink ${open ? "bg-raised" : "hover:bg-raised"}`}>
              <LayoutGrid size={19} aria-hidden="true" />
              {t("sidebar.tools")}
              {automationsNeedYou && <span aria-hidden className="absolute right-1 top-1 size-2.5 rounded-full bg-danger ring-2 ring-app" />}
            </span>
          )}
        />
        <UpdateIndicator />
      </div>
    </div>
  );
}

export function SidebarPhoneSearch({ query, onQuery }: { query: string; onQuery: (query: string) => void }) {
  return (
    <div data-sidebar-phone-search className="px-4 pb-3">
      <div className="flex h-11 min-w-0 items-center gap-2 rounded-xl border border-hairline bg-card pl-3.5 text-ink-secondary focus-within:border-focus">
        <Search size={17} aria-hidden="true" className="shrink-0" />
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query) { event.preventDefault(); event.stopPropagation(); onQuery(""); }
          }}
          placeholder={t("sidebar.search")}
          aria-label={t("sidebar.searchAria")}
          enterKeyHint="search"
          className="min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-secondary focus:outline-none"
        />
        {query !== "" && (
          <button
            type="button"
            onClick={() => onQuery("")}
            aria-label={t("sidebar.searchClose")}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl text-ink-secondary hover:bg-raised hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
          >
            <X size={15} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
