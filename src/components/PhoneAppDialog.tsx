import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";

import { ANDROID_APK_URL, openExternalLink } from "@/lib/app-links";
import { t } from "@/lib/i18n";
import type { LocaleKey } from "@/locales";

export const PHONE_APPS: ReadonlyArray<{ id: "android"; nameKey: LocaleKey; actionKey: LocaleKey; url: string }> = [
  { id: "android", nameKey: "phoneApp.android", actionKey: "phoneApp.androidAction", url: ANDROID_APK_URL },
];

export interface PhoneAppConnect { key: string; subtitle: string; onSelect(): void }

export function PhoneAppDialog({ open, onClose, connect = [] }: { open: boolean; onClose: () => void; connect?: readonly PhoneAppConnect[] }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="phone-app-dialog-title"
        className="max-h-full w-full max-w-[360px] overflow-y-auto rounded-2xl border border-hairline/50 bg-panel p-5 shadow-2xl"
      >
        <h2 id="phone-app-dialog-title" className="text-[17px] font-semibold text-ink">
          {t("phoneApp.title")}
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">{t("phoneApp.androidSubtitle")}</p>
        {connect.map(destination => <button key={destination.key} type="button" data-phone-app-connect={destination.key}
          className="ui-button mt-3 w-full" onClick={() => { onClose(); destination.onSelect(); }}>
          {t("sidebar.menu.connectPhone")} · {destination.subtitle}
        </button>)}
        <ul className="mt-4 grid grid-cols-1 gap-3">
          {PHONE_APPS.map((app) => (
            <li key={app.id} data-phone-app={app.id} className="flex flex-col items-center gap-3 rounded-xl bg-card p-4 text-center">
              <div className="text-[14px] font-medium text-ink">{t(app.nameKey)}</div>
              <div className="rounded-md bg-white p-2">
                <QRCodeSVG value={app.url} size={132} level="M" bgColor="#ffffff" fgColor="#111111" title={t(app.actionKey)} />
              </div>
              <button type="button" onClick={() => void openExternalLink(app.url)} className="text-[13px] text-accent hover:underline">
                {t(app.actionKey)}
              </button>
            </li>
          ))}
        </ul>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-xl bg-raised px-4 py-2 text-[13px] font-medium text-ink hover:brightness-110"
        >
          {t("common.close")}
        </button>
      </div>
    </div>, document.body
  );
}
