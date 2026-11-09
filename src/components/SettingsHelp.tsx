import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CircleHelp } from "lucide-react";
import { t } from "@/lib/i18n";

export function SettingsHelp({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const cancelClose = () => { if (timer.current) clearTimeout(timer.current); };
  const show = () => { cancelClose(); setOpen(true); };
  const hide = () => { cancelClose(); timer.current = setTimeout(() => setOpen(false), 160); };

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(320, window.innerWidth - 24);
      const height = popup.current?.offsetHeight ?? 120;
      setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        top: rect.bottom + height + 8 < window.innerHeight ? rect.bottom + 6 : Math.max(12, rect.top - height - 6) });
    };
    const outside = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !popup.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); }
    };
    place();
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, true);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    return () => {
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", place, true);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape, true);
    };
  }, [open]);

  return <>
    <button ref={trigger} type="button" aria-label={t("settings.helpFor", { title: label })}
      aria-expanded={open} aria-describedby={open ? id : undefined}
      onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} onClick={show}
      className="inline-flex size-6 shrink-0 cursor-help items-center justify-center rounded-md text-ink-tertiary hover:bg-control hover:text-ink-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/60">
      <CircleHelp size={13} aria-hidden="true" />
    </button>
    {open && createPortal(
      <div ref={popup} id={id} role="tooltip" onMouseEnter={cancelClose} onMouseLeave={hide}
        style={position} className="fixed z-[200] w-80 max-w-[calc(100vw-24px)] max-h-[calc(100vh-24px)] overflow-y-auto rounded-lg border border-hairline bg-menu px-3 py-2 text-[12px] font-normal leading-5 text-ink-secondary shadow-lg">
        {children}
      </div>, trigger.current?.closest('[role="dialog"]') ?? document.body)}
  </>;
}
