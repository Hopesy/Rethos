import { targetLabel, useWorkTarget } from "@/lib/work-target";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useMenuMotion } from "./MenuMotion";
import { MENU_HEADING, MENU_SHEET } from "./menu-recipe";
import { t } from "@/lib/i18n";
import { instanceSupportsLocalComputer, localComputerDisabledReason, localComputerSelectable, pageOnRemoteServer } from "@/lib/local-computer";
import { effectivePlace, personPin, PLACES, placeLabelKey, placeOffered, type Place } from "@/lib/place";
import { placeBlocked, placeFacts, placeHasIssue, placeViewFor, usePlaceSeat } from "@/lib/place-view";
import { useStore, type Bot, type Task } from "@/state/store";
import type { PlaceView } from "../../shared/place-view";
import { useDesktopCapabilities } from "./DesktopCapabilities";
import { PlaceIcon } from "./PlaceIcon";
import type { SidebarMenuItem } from "./SidebarPopoverMenu";

export type PlaceAvailability = Record<Place, boolean>;

export function usePlaceViews(bot: Bot): Record<Place, { view: PlaceView; reachable: boolean; policy: boolean; listed: boolean }> {
  const { state } = useStore();
  const { capabilities } = useDesktopCapabilities();
  const seat = usePlaceSeat(state.config, capabilities);
  const backend = bot.cloudBackend === "vps" ? "vps" : "box";
  const allowed = state.config?.managedPolicy?.computers ?? { thisComputer: true, localVm: true, box: true, vps: true };
  const providerSupportsLocal = instanceSupportsLocalComputer(state.instances, bot);
  const local = {
    ready: localComputerSelectable({ capabilities, providerSupportsLocal }),
    reason: localComputerDisabledReason({ capabilities, providerSupportsLocal }) ?? t("computer.unavailableLocal"),
  };
  const entry = (place: Place) => {
    const view = placeViewFor(placeFacts({ bot, place, seat, config: state.config, instances: state.instances, local }));
    const policy = (place === "cloud" ? allowed[backend] : place === "vm" ? allowed.localVm : place === "local" ? allowed.thisComputer : true)
      && placeOffered(place, state.config, bot);
    const listed = placeOffered(place, state.config, bot) && !(place === "local" && pageOnRemoteServer(capabilities));
    return { view, policy, listed, reachable: policy && !placeBlocked(view) };
  };
  return { cloud: entry("cloud"), vm: entry("vm"), local: entry("local"), browser: entry("browser") };
}

export function usePlaceAvailability(bot: Bot): PlaceAvailability {
  const views = usePlaceViews(bot);
  return { cloud: views.cloud.reachable, vm: views.vm.reachable, local: views.local.reachable, browser: views.browser.reachable };
}

/** The place chip as one + menu entry with the same choices, for a phone composer that has no room for the chip. */
export function usePlaceMenuItem({ bot, task, disabled = false, onPin }: {
  bot: Bot;
  task?: Pick<Task, "surface" | "surfaceAuto" | "workTarget"> | null;
  disabled?: boolean;
  onPin: (surface: Place | null) => void;
}): SidebarMenuItem {
  const places = usePlaceViews(bot);
  const target = useWorkTarget(bot, true);
  const effective = effectivePlace(bot, task);
  const pin = personPin(task);
  const pinned = Boolean(pin || target.status?.pinnedTarget);
  const off = effective === "off";
  const botDefault = bot.computer ?? "auto";
  const followsAuto = botDefault === "auto";
  const check = <Check size={14} className="text-accent" aria-hidden="true" />;
  const choose = (surface: Place | null) => { if (surface === null && target.status?.pinnedTarget) void target.save(null); else if (surface !== (pin ?? null) || target.selected.kind === "connected") onPin(surface); };
  return {
    key: "place",
    label: t("computer.worksOn"),
    subtitle: target.selected.kind === "connected" ? targetLabel(target.selected, target.status) : t(placeLabelKey(effective)),
    icon: <PlaceIcon place={effective} size={16} aria-hidden="true" />,
    disabled: disabled || off,
    onSelect: () => {},
    submenu: [
      {
        key: "place:follow",
        label: followsAuto ? t("place.auto") : t("place.followBot"),
        note: followsAuto ? t("place.autoDetail") : t("place.followBotDetail", { place: t(placeLabelKey(botDefault)) }),
        icon: <PlaceIcon place={botDefault} size={16} aria-hidden="true" />,
        active: !pinned,
        trailing: !pinned ? check : undefined,
        onSelect: () => choose(null),
      },
      ...(target.status?.options ?? []).filter(option => option.target.kind === "connected").map(option => ({
        key: 'connected:' + option.label, label: option.label, disabled: !option.available,
        note: option.ready ? t("computer.connected.online") : t("computer.connected.offline"),
        onSelect: () => { void target.save(option.target); },
      })),
      ...PLACES.filter((place) => places[place].listed).map((place): SidebarMenuItem => {
        const { view, reachable, policy } = places[place];
        return {
          key: `place:${place}`,
          label: t(placeLabelKey(place)),
          note: !policy ? t("place.unavailable") : placeHasIssue(view) ? view.short : t(DESCRIPTION[place]),
          icon: <PlaceIcon place={place} size={16} aria-hidden="true" />,
          active: pin === place,
          trailing: pin === place ? check : undefined,
          disabled: !reachable,
          onSelect: () => choose(place),
        };
      }),
    ],
  };
}

const DESCRIPTION: Record<Place, "computer.dest.cloudDesc" | "computer.dest.vmDesc" | "computer.dest.localDesc" | "computer.dest.browserDesc"> = {
  cloud: "computer.dest.cloudDesc", vm: "computer.dest.vmDesc", local: "computer.dest.localDesc", browser: "computer.dest.browserDesc",
};

export function PlaceChip({ bot, task, live, disabled = false, onPin }: {
  bot: Bot;
  task?: Pick<Task, "surface" | "surfaceAuto" | "workTarget"> | null;
  live: boolean;
  disabled?: boolean;
  onPin: (surface: Place | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const motion = useMenuMotion(open);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const places = usePlaceViews(bot);
  const target = useWorkTarget(bot, true);
  const effective = effectivePlace(bot, task);
  const pin = personPin(task);
  const pinned = Boolean(pin || target.status?.pinnedTarget);
  const off = effective === "off";
  const label = target.selected.kind === "connected" ? targetLabel(target.selected, target.status) : t(placeLabelKey(effective));
  const showLive = live && effective !== "off" && effective !== "auto";
  const title = off ? t("place.offHint") : disabled ? t("place.busy") : pinned ? t("place.pinnedHere") : t("place.fromBot");

  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => { if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);

  const choose = (surface: Place | null) => { setOpen(false); if (surface === null && target.status?.pinnedTarget) void target.save(null); else if (surface !== (pin ?? null) || target.selected.kind === "connected") onPin(surface); };
  const botDefault = bot.computer ?? "auto";
  const followsAuto = botDefault === "auto";

  return (
    <div className="relative flex items-center" ref={wrapperRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("place.chipAria", { place: label })}
        disabled={disabled || off}
        title={off || disabled ? title : `${label} — ${title}`}
        data-testid="place-chip"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "relative flex size-8 shrink-0 items-center justify-center rounded-full text-ink-secondary hover:bg-control hover:text-ink",
          pinned && "text-accent hover:text-accent",
          (disabled || off) && "cursor-not-allowed opacity-45 hover:bg-transparent",
        )}
      >
        <PlaceIcon place={effective} size={16} className="shrink-0 opacity-80" aria-hidden="true" />
        {showLive && <span className="absolute right-1.5 top-1.5 size-1.5 animate-pulse rounded-full bg-success" aria-label={t("place.live")} />}
      </button>
      {motion.shown && (
        <div role="menu" aria-label={t("place.chipTitle")} className={cn("absolute bottom-full left-0 z-40 mb-2 w-[300px] overflow-hidden", MENU_SHEET, motion.className)} {...motion.exitProps}>
          <div className={MENU_HEADING}>{t("place.chipTitle")}</div>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              role="menuitemradio"
              aria-checked={!pinned}
              onClick={() => choose(null)}
              className={cn("flex items-start gap-2 rounded-md px-2 py-1.5 text-left", !pinned ? "bg-menu-active" : "hover:bg-menu-hover")}
            >
              <PlaceIcon place={botDefault} size={16} className="mt-px shrink-0 text-ink-secondary" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] leading-[18px] text-ink">{followsAuto ? t("place.auto") : t("place.followBot")}</span>
                <span className="block text-[12px] leading-4 text-ink-secondary">
                  {followsAuto ? t("place.autoDetail") : t("place.followBotDetail", { place: t(placeLabelKey(botDefault)) })}
                </span>
              </span>
              {!pinned && <Check size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />}
            </button>
            {(target.status?.options ?? []).filter(option => option.target.kind === "connected").map(option => <button
              key={option.target.kind === "connected" ? option.target.computerId : option.label} type="button" role="menuitemradio"
              aria-checked={target.selected.kind === "connected" && option.target.kind === "connected" && target.selected.computerId === option.target.computerId}
              disabled={!option.available || target.saving} className="rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-menu-hover disabled:opacity-50"
              onClick={() => { void target.save(option.target).then(saved => { if (saved) setOpen(false); }); }}>
              {option.label} · {t(option.ready ? "computer.connected.online" : "computer.connected.offline")}
            </button>)}
            {target.error && <p role="alert" className="px-2 text-[12px] text-danger">{target.error}</p>}
            {PLACES.filter((place) => places[place].listed).map((place) => {
              const selected = pin === place;
              const { view, reachable, policy } = places[place];
              const detail = !policy ? t("place.unavailable") : placeHasIssue(view) ? view.short : t(DESCRIPTION[place]);
              return (
                <button
                  key={place}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  disabled={!reachable}
                  title={!policy ? t("place.unavailable") : placeHasIssue(view) ? view.line : undefined}
                  onClick={() => choose(place)}
                  className={cn("flex items-start gap-2 rounded-md px-2 py-1.5 text-left", selected ? "bg-menu-active" : reachable ? "hover:bg-menu-hover" : "cursor-not-allowed opacity-45")}
                >
                  <PlaceIcon place={place} size={16} className="mt-px shrink-0 text-ink-secondary" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] leading-[18px] text-ink">{t(placeLabelKey(place))}</span>
                    <span className="block text-[12px] leading-4 text-ink-secondary">{detail}</span>
                  </span>
                  {selected && <Check size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
