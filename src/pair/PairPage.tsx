import { useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, LockKeyhole, Smartphone } from "lucide-react";
import { defaultDeviceLabel, isConnected, newAttemptId, pairWithCode, readSessionState, reasonWorthShowing, signInWithToken, type SessionState } from "../lib/session";
import { pairedDestination } from "../lib/phone-pairing";
import { t } from "../lib/i18n";
import { isPrivateHost } from "../../shared/private-host";
import { LoginShell } from "./LoginShell";

/** Native desktop connections may exchange their launch credential; browser pages require an explicit sign-in. */
export function pairsAutomatically(initialCode: string | null, desktop = typeof window !== "undefined" && Boolean(window.ogb?.workspaces)): boolean { return Boolean(initialCode) && desktop; }
/** Plain HTTP exposes credentials and conversations in transit. */
export function unencryptedPublic(where: { protocol: string; hostname: string }): boolean { return where.protocol === "http:" && !isPrivateHost(where.hostname); }

export function PairPage({ initialCode, reason }: { initialCode: string | null; reason?: string }) {
  const [token, setToken] = useState("");
  const [visible, setVisible] = useState(false);
  const [label] = useState(defaultDeviceLabel);
  const [session, setSession] = useState<SessionState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptId] = useState(newAttemptId);
  const [opening, setOpening] = useState(() => pairsAutomatically(initialCode));
  const connected = isConnected(session);
  const notice = reasonWorthShowing(reason);
  const where = typeof location !== "undefined" ? location : null;
  useEffect(() => {
    if (!opening || !initialCode) return;
    let active = true;
    void pairWithCode({ code: initialCode, label, attemptId }).then(result => { if (!active) return; if (result.ok) { location.replace(pairedDestination(location.search)); return; } setOpening(false); setError(result.error); });
    return () => { active = false; };
  }, [opening, initialCode, label, attemptId]);
  useEffect(() => {
    let active = true;
    void readSessionState().then(next => { if (active) setSession(next); });
    return () => { active = false; };
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !token.trim()) return;
    setBusy(true); setError(null);
    const result = await signInWithToken(token);
    setBusy(false);
    if (result.ok) { setToken(""); location.replace(pairedDestination(location.search)); return; }
    setError(result.error);
  }
  return <LoginShell>
    <h1>{t(connected ? "pair.compact.ready" : "login.title")}</h1>
    {connected && <p className="mt-2 text-[13px] leading-6 text-ink-secondary">{t("pair.alreadyConnected")}</p>}
    {where && unencryptedPublic(where) && <p role="alert" className="mt-5 rounded-lg bg-warning/10 px-3 py-2 text-[12px] leading-5 text-warning">{t("pair.notEncrypted")}</p>}
    {notice && !connected && <p className="mt-3 text-[12px] leading-5 text-ink-secondary">{notice}</p>}
    {opening ? <p role="status" className="mt-8 flex items-center gap-2 text-[13px] text-ink-secondary"><Loader2 size={15} className="animate-spin motion-reduce:animate-none" />{t("pair.connecting")}</p>
      : connected ? <a href={pairedDestination(where?.search ?? "")} className="login-submit mt-8">{t("pair.openApp")}<ArrowRight size={14} /></a> : <>
        <form onSubmit={submit} className="mt-8">
          <div className="relative"><KeyRound size={15} className="pointer-events-none absolute left-3 top-3.5 text-ink-tertiary" />
            <input id="login-credential" name="access-token" type={visible ? "text" : "password"} className="login-input" value={token} onChange={e => { setToken(e.target.value); setError(null); }} autoComplete="current-password" autoCapitalize="none" spellCheck={false} disabled={busy} placeholder={t("login.placeholder")} aria-label={t("login.token")} aria-invalid={Boolean(error)} aria-describedby={error ? "login-error" : undefined} />
            <button type="button" className="ui-icon-button absolute right-1.5 top-1.5 size-8" aria-label={t(visible ? "login.hide" : "login.show")} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={15} /> : <Eye size={15} />}</button>
          </div>
          {error && <p id="login-error" role="alert" className="mt-2 text-[12px] leading-5 text-danger">{error}</p>}
          <button type="submit" className="login-submit mt-5" disabled={busy || !token.trim()}>{busy ? <Loader2 size={14} className="animate-spin motion-reduce:animate-none" /> : <ArrowRight size={14} />}{t(busy ? "pair.connecting" : "login.submit")}</button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-ink-tertiary"><LockKeyhole size={11} />{t("login.remember")}</p>
        </form>
        <p className="mt-6 flex items-start justify-center gap-2 text-[11px] leading-5 text-ink-tertiary"><Smartphone size={13} className="mt-0.5 shrink-0" /><span>{t("login.phoneHint")}</span></p>
      </>}
  </LoginShell>;
}
