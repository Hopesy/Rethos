import { useEffect, useRef, useState } from "react";
import { Check, Copy, KeyRound, Loader2, QrCode, RefreshCw, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { api, useStore } from "../state/store";
import { useOwnerOrAdmin } from "../lib/use-owner-or-admin";
import { readMembership } from "../lib/membership";
import { useCopyFeedback } from "../lib/copy-text";
import { t } from "../lib/i18n";
import { SettingRow } from "./SettingsPrimitives";

type AccessToken = { id: string; label: string; token?: true; expiresAt: number; scopes: string[] };
type QrOffer = { id: string; url: string; expiresAt: number };
const date = (at: number) => new Date(at).toLocaleDateString();

export function BrowserAccessSettings() {
  const { state } = useStore();
  const admin = useOwnerOrAdmin();
  const [panel, setPanel] = useState<"tokens" | "qr" | null>(null);
  if (!admin || state.config?.cloudHome || state.config?.team || !readMembership(state.config).pairingCodes || state.config?.managedPolicy?.remoteAccess === false) return null;
  return <>
    <SettingRow title={t("access.tokens.title")} help={t("access.tokens.help")} message={panel === "tokens" ? <AccessTokensPanel /> : undefined}>
      <button type="button" className="ui-button" onClick={() => setPanel(panel === "tokens" ? null : "tokens")}><KeyRound size={13} />{t(panel === "tokens" ? "common.close" : "access.manage")}</button>
    </SettingRow>
    <SettingRow title={t("access.qr.title")} help={t("access.qr.help")} message={panel === "qr" ? <BrowserQrPanel /> : undefined}>
      <button type="button" className="ui-button" onClick={() => setPanel(panel === "qr" ? null : "qr")}><QrCode size={13} />{t(panel === "qr" ? "common.close" : "access.qr.show")}</button>
    </SettingRow>
  </>;
}

export function AccessTokensPanel() {
  const [tokens, setTokens] = useState<AccessToken[]>([]);
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const copied = useCopyFeedback(secret);
  const load = async () => { const result = await api("/api/auth/sessions"); setTokens((result.sessions as AccessToken[]).filter(s => s.token)); };
  useEffect(() => { void load().catch(e => setError(String(e))); }, []);
  async function create() {
    setBusy(true); setError(null); setSecret("");
    try {
      const offer = await api("/api/auth/pairing", { method: "POST", body: JSON.stringify({ label: t("access.tokens.name"), scopes: ["admin", "client"], tokenTtlMs: 90 * 24 * 60 * 60_000 }) });
      const result = await api("/api/auth/pair", { method: "POST", body: JSON.stringify({ code: offer.credential, label: t("access.tokens.name") }) });
      if (result.session?.token !== true || typeof result.token !== "string") throw new Error(t("access.tokens.unsupported"));
      setSecret(result.token); await load();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  async function revoke(id: string) {
    setBusy(true); setError(null);
    try { await api(`/api/auth/sessions/${encodeURIComponent(id)}`, { method: "DELETE" }); setRevokeId(null); setSecret(""); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  return <div className="rounded-xl border border-hairline/50 bg-inset/50 p-3" data-access-tokens>
    <div className="flex items-center justify-between gap-3"><span className="text-[11px] text-ink-secondary">{t("access.tokens.duration")}</span><button type="button" className="ui-button" disabled={busy} onClick={() => void create()}>{busy ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}{t("access.tokens.create")}</button></div>
    {secret && <div className="mt-3 rounded-lg border border-accent/25 bg-accent/5 p-3"><div className="flex items-center gap-2"><input readOnly type="password" value={secret} aria-label={t("login.token")} autoComplete="off" className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-ink outline-none" /><button type="button" className="ui-icon-button size-7" onClick={copied.copy} aria-label={t("access.tokens.copy")}>{copied.state === "copied" ? <Check size={14} /> : <Copy size={14} />}</button><button type="button" className="ui-icon-button size-7" onClick={() => setSecret("")} aria-label={t("common.close")}><X size={14} /></button></div><p role="status" className="mt-1 text-[11px] leading-5 text-ink-secondary">{t(copied.state === "copied" ? "access.tokens.copied" : copied.state === "failed" ? "common.copyFailed" : "access.tokens.once")}</p></div>}
    {tokens.length > 0 && <ul className="mt-2 divide-y divide-hairline/40">{tokens.map(token => <li key={token.id} className="py-2"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-[12px] text-ink">{token.label}</p><p className="mt-0.5 text-[11px] text-ink-tertiary">{t("access.tokens.expires", { date: date(token.expiresAt) })}</p></div><button type="button" className="ui-button" disabled={busy} onClick={() => setRevokeId(revokeId === token.id ? null : token.id)}>{t("access.tokens.revoke")}</button></div>{revokeId === token.id && <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-secondary"><span className="flex-1">{t("access.tokens.revokeHint")}</span><button type="button" className="ui-button text-danger" disabled={busy} onClick={() => void revoke(token.id)}>{t("access.tokens.confirmRevoke")}</button></div>}</li>)}</ul>}
    {error && <p role="alert" className="mt-2 text-[12px] text-danger">{error}</p>}
  </div>;
}

export function BrowserQrPanel() {
  const [offer, setOffer] = useState<QrOffer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  const owned = useRef<string | null>(null);
  const mounted = useRef(true);
  const request = useRef(0);
  const cancel = (id: string) => api(`/api/auth/pairing/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
  async function refresh() {
    const generation = ++request.current;
    setBusy(true); setError(null); setOffer(null);
    if (owned.current) { void cancel(owned.current); owned.current = null; }
    try {
      const next = await api("/api/auth/browser-qr", { method: "POST", body: "{}" }) as QrOffer;
      if (!mounted.current || request.current !== generation) { void cancel(next.id); return; }
      owned.current = next.id; setOffer(next); setNow(Date.now());
    } catch (e) { if (mounted.current && request.current === generation) setError(e instanceof Error ? e.message : String(e)); }
    finally { if (mounted.current && request.current === generation) setBusy(false); }
  }
  useEffect(() => {
    mounted.current = true; void refresh();
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { mounted.current = false; request.current++; clearInterval(timer); if (owned.current) { void cancel(owned.current); owned.current = null; } };
  }, []);
  const seconds = Math.max(0, Math.ceil(((offer?.expiresAt ?? 0) - now) / 1000));
  return <div data-browser-qr className="flex flex-col items-center rounded-xl border border-hairline/50 bg-inset/50 p-5">
    <div className="flex size-[204px] items-center justify-center rounded-xl border border-hairline/30 bg-white p-3">{offer && seconds > 0 ? <QRCodeSVG value={offer.url} size={180} level="M" bgColor="#ffffff" fgColor="#161922" /> : busy ? <Loader2 size={22} className="animate-spin text-gray-400" /> : <QrCode size={52} className="text-gray-300" />}</div>
    <p className="mt-3 text-[12px] text-ink">{t("access.qr.scan")}</p>
    {!error && <p role="status" className="mt-1 text-[11px] text-ink-tertiary">{t(busy ? "access.qr.loading" : seconds ? "access.qr.expires" : "access.qr.expired", { time: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` })}</p>}
    <button type="button" className="ui-button mt-3" disabled={busy} onClick={() => void refresh()}><RefreshCw size={12} />{t("access.qr.refresh")}</button>
    {error && <p role="alert" className="mt-2 text-[12px] text-danger">{error}</p>}
  </div>;
}
