import { useSyncExternalStore, type ReactNode } from "react";
import { Moon, ShieldCheck, Sun } from "lucide-react";
import { productName } from "../lib/brand";
import { t } from "../lib/i18n";
import { applySkinChoice, readSkin, subscribeSkin, THEME_SKINS } from "../lib/skins";
import { DesktopWorkspaceSwitcher } from "../components/DesktopWorkspaceSwitcher";
import "./login.css";

export function LoginShell({ children, secondary }: { children: ReactNode; secondary?: ReactNode }) {
  const skin = useSyncExternalStore(subscribeSkin, readSkin, () => THEME_SKINS.light);
  const dark = skin === THEME_SKINS.dark;
  const embedded = typeof navigator !== "undefined" && /Android.*; wv\)/.test(navigator.userAgent);
  return <main className="rethos-login bg-app text-ink" data-pair-page data-embedded={embedded || undefined}>
    <aside className="login-scene" aria-label={productName()}>
      <svg className="login-landscape" viewBox="0 0 800 1100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="login-sky" x2="0" y2="1"><stop stopColor="#101b36" /><stop offset=".55" stopColor="#34365e" /><stop offset="1" stopColor="#b59fba" /></linearGradient>
          <linearGradient id="login-peak" x2=".8" y2="1"><stop stopColor="#c6c8e0" /><stop offset=".4" stopColor="#676d99" /><stop offset="1" stopColor="#232940" /></linearGradient>
          <linearGradient id="login-shadow" x2=".2" y2="1"><stop stopColor="#3f4769" /><stop offset="1" stopColor="#0f172b" /></linearGradient>
          <linearGradient id="login-fade" x2="0" y2="1"><stop offset=".35" stopColor="#0a1020" stopOpacity="0" /><stop offset="1" stopColor="#0a1020" /></linearGradient>
          <radialGradient id="login-halo"><stop stopColor="#c2bcff" stopOpacity=".25" /><stop offset="1" stopColor="#c2bcff" stopOpacity="0" /></radialGradient>
        </defs>
        <path fill="url(#login-sky)" d="M0 0h800v1100H0z" /><circle cx="570" cy="310" r="290" fill="url(#login-halo)" />
        <g fill="#e8e8ff" opacity=".45"><circle cx="164" cy="165" r="1.4" /><circle cx="360" cy="95" r="1" /><circle cx="684" cy="198" r="1.4" /><circle cx="94" cy="365" r="1" /><circle cx="418" cy="238" r="1" /></g>
        <circle cx="586" cy="222" r="31" fill="#e7e2f4" opacity=".85" />
        <path d="M-80 760 177 486 291 599 452 296 900 847V1100H-80Z" fill="url(#login-peak)" />
        <path d="m452 296 38 217 81 105-34-133 95 147 62 59 206 156v253H195l155-350 80-181-31-36 55-105-13-52Z" fill="url(#login-shadow)" />
        <path d="m452 296-92 191 59-52 13 35 22-42-13-52 49 137-13-77 56 62-58-114Z" fill="#d9d9e8" opacity=".65" />
        <path d="m177 486-104 211 81-70 19 32 33-64 45 35Z" fill="#cad0e5" opacity=".4" />
        <path d="M-40 842 180 715 310 818 500 677 844 935V1100H-40Z" fill="#19233b" /><path d="M-30 942 247 812 415 942 653 818 850 986v114H-30Z" fill="#111a2f" />
        <path fill="url(#login-fade)" d="M0 0h800v1100H0z" />
      </svg>
      <div className="login-scene-brand"><img src="/app-icon.svg" width={28} height={28} alt="" /><span>{productName()}</span></div>
      <div className="login-scene-copy"><p className="login-eyebrow">YOUR PRIVATE AI SPACE</p><h2>{t("login.hero.title")}</h2><p>{t("login.hero.subtitle")}</p><div className="login-scene-foot"><span>{t("login.hero.tasks")}</span><span>{t("login.hero.chats")}</span><span>{t("login.hero.computers")}</span></div></div>
    </aside>
    <section className="login-main">
      <header className="login-header"><div className="login-header-brand"><img src="/app-icon.svg" width={26} height={26} alt="" /><span className="text-[14px] font-semibold">{productName()}</span></div><div className="login-header-actions">{typeof window !== "undefined" && window.ogb?.workspaces && <DesktopWorkspaceSwitcher />}<button type="button" className="ui-icon-button size-8" aria-label={t(dark ? "settings.theme.light" : "settings.theme.dark")} title={t(dark ? "settings.theme.light" : "settings.theme.dark")} onClick={() => applySkinChoice(dark ? THEME_SKINS.light : THEME_SKINS.dark)}>{dark ? <Sun size={16} /> : <Moon size={16} />}</button></div></header>
      <div className="login-body"><div className="login-stack"><div className="login-form">{children}</div>{secondary}</div></div>
      <footer className="login-footer text-ink-tertiary"><ShieldCheck size={12} /><span>{typeof location === "undefined" ? productName() : location.host}</span></footer>
    </section>
  </main>;
}
