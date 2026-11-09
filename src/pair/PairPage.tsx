import { useEffect, useState } from "react";
import { ArrowRight, Check, ChevronRight, Copy, Loader2, ShieldCheck } from "lucide-react";
import { DesktopWorkspaceSwitcher } from "../components/DesktopWorkspaceSwitcher";
import { productName } from "../lib/brand";
import { useCopyFeedback } from "../lib/copy-text";
import { defaultDeviceLabel, isConnected, newAttemptId, pairWithCode, readSessionState, reasonWorthShowing, type EnvironmentDescriptor, type SessionState } from "../lib/session";
import { pairedDestination } from "../lib/phone-pairing";
import { t } from "../lib/i18n";
import { PAIRING_INPUT_PROBLEM_KEY, readPairingInput } from "../../shared/pairing-code";
import { isPrivateHost } from "../../shared/private-host";

/** Only the desktop app pairs from a link at once; a browser asks, so a sent link cannot sign it in unseen. */
export function pairsAutomatically(initialCode: string | null, desktop = typeof window !== "undefined" && Boolean(window.ogb?.workspaces)): boolean {
  return Boolean(initialCode) && desktop;
}

export function codeProblem(code: string): string | null {
  const read = readPairingInput(code);
  return read.kind === "wrong" && read.problem !== "notACode" ? t(PAIRING_INPUT_PROBLEM_KEY[read.problem]) : null;
}

export function codeReady(code: string): boolean {
  const kind = readPairingInput(code).kind;
  return kind === "code" || kind === "credential";
}

/** Plain http to the open internet exposes the session cookie and conversations. */
export function unencryptedPublic(where: { protocol: string; hostname: string }): boolean {
  return where.protocol === "http:" && !isPrivateHost(where.hostname);
}

export function pairingCommand(install?: EnvironmentDescriptor["capabilities"]["install"]): string {
  if (install === "docker") return "docker compose exec rethos rethos pair";
  if (install === "source") return "pnpm pair";
  if (install === "npx") return "npx rethos pair";
  return "rethos pair";
}

export function PairPage({ initialCode, reason }: { initialCode: string | null; reason?: string }) {
  const [code, setCode] = useState(initialCode ?? "");
  const [label] = useState(defaultDeviceLabel);
  const [environment, setEnvironment] = useState<EnvironmentDescriptor | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState(newAttemptId);
  const [opening, setOpening] = useState(() => pairsAutomatically(initialCode));
  const command = pairingCommand(environment?.capabilities.install);
  const copied = useCopyFeedback(command);

  useEffect(() => {
    if (!opening || !initialCode) return;
    let active = true;
    void pairWithCode({ code: initialCode, label, attemptId }).then(result => {
      if (!active) return;
      if (result.ok) { location.replace(pairedDestination(location.search)); return; }
      setOpening(false);
      setError(result.error);
    });
    return () => { active = false; };
  }, [opening, initialCode, label, attemptId]);

  useEffect(() => {
    let active = true;
    void fetch("/.well-known/openmausbot/environment")
      .then(r => r.ok ? r.json() : null)
      .then((next: EnvironmentDescriptor | null) => { if (active) setEnvironment(next); })
      .catch(() => {});
    void readSessionState().then(next => { if (active) setSession(next); });
    return () => { active = false; };
  }, []);

  const connected = isConnected(session);
  const problem = codeProblem(code) ?? error;
  const where = typeof location !== "undefined" && typeof location.protocol === "string" ? location : null;
  const notice = reasonWorthShowing(reason);

  async function submitCode(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !codeReady(code)) return;
    setBusy(true);
    setError(null);
    const result = await pairWithCode({ code, label, attemptId });
    setBusy(false);
    if (result.ok) { location.replace(pairedDestination(location.search)); return; }
    setError(result.error);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-app px-5 py-12 text-ink" data-pair-page>
      <div className="absolute left-3 top-3 max-w-[260px]"><DesktopWorkspaceSwitcher /></div>
      <div className="w-full max-w-[368px]">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <img src="/app-icon.svg" alt="" width={32} height={32} className="size-8" />
          <span className="text-[16px] font-semibold tracking-tight">{productName()}</span>
        </div>
        <section className="rounded-2xl border border-hairline/60 bg-panel p-6 shadow-sm sm:p-7" aria-labelledby="pair-title">
          <h1 id="pair-title" className="text-[18px] font-semibold tracking-tight">{t(connected ? "pair.compact.ready" : "pair.compact.title")}</h1>
          <p className="mt-1.5 text-[13px] leading-5 text-ink-secondary">{t(connected ? "pair.alreadyConnected" : "pair.compact.subtitle")}</p>
          {where && unencryptedPublic(where) && <p role="alert" className="mt-4 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[12px] leading-5 text-warning">{t("pair.notEncrypted")}</p>}
          {notice && !connected && <p className="mt-3 text-[12px] leading-5 text-ink-secondary">{notice}</p>}
          {opening ? <p role="status" className="mt-5 flex items-center gap-2 text-[13px] text-ink-secondary"><Loader2 size={15} className="animate-spin motion-reduce:animate-none" />{t("pair.connecting")}</p>
            : connected ? <a href={pairedDestination(where?.search ?? "")} className="ui-button ui-button-primary mt-5 flex h-9 w-full items-center justify-center gap-2 text-[13px]">{t("pair.openApp")}<ArrowRight size={14} /></a>
            : <>
              <form onSubmit={submitCode} className="mt-5">
                <label htmlFor="pair-code" className="block text-[12px] font-medium text-ink-secondary">{t("pair.compact.code")}</label>
                <input id="pair-code" value={code} onChange={event => { setCode(event.target.value); setAttemptId(newAttemptId()); setError(null); }}
                  placeholder="XXXX-XXXX-XXXX" autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} disabled={busy}
                  aria-invalid={Boolean(problem)} aria-describedby={problem ? "pair-error" : initialCode && code === initialCode ? "pair-code-from-link" : undefined}
                  className="mt-2 h-11 w-full rounded-lg border border-hairline bg-inset px-3 font-mono text-[16px] tracking-[0.08em] text-ink outline-none transition-colors placeholder:text-ink-tertiary focus:border-accent-border focus:ring-2 focus:ring-accent/10 disabled:opacity-50" />
                {initialCode && code === initialCode && <p id="pair-code-from-link" className="mt-2 text-[12px] leading-5 text-ink-secondary">{t("pair.compact.fromLink")}</p>}
                {problem && <p id="pair-error" role="alert" className="mt-2 text-[12px] leading-5 text-danger">{problem}</p>}
                <button type="submit" disabled={busy || !codeReady(code)} className="ui-button ui-button-primary mt-4 flex h-9 w-full items-center justify-center gap-2 text-[13px]">
                  {t(busy ? "pair.connecting" : "pair.connect")}{busy ? <Loader2 size={14} className="animate-spin motion-reduce:animate-none" /> : <ArrowRight size={14} />}
                </button>
              </form>
              <details className="group mt-5 border-t border-hairline/50 pt-3.5">
                <summary className="flex cursor-pointer list-none items-center gap-1 text-[12px] text-ink-secondary hover:text-ink [&::-webkit-details-marker]:hidden">
                  <ChevronRight size={13} className="transition-transform group-open:rotate-90" />{t("pair.compact.help")}
                </summary>
                <div className="pt-3 text-[12px] leading-5 text-ink-secondary">
                  <p>{t("pair.compact.helpText")}</p>
                  <div className="mt-2 flex items-start gap-1 rounded-lg border border-hairline/50 bg-inset p-2">
                    <code className="min-w-0 flex-1 select-all break-all py-1 font-mono text-[11px] leading-5 text-ink">{command}</code>
                    <button type="button" onClick={copied.copy} aria-label={t("pair.compact.copy")} title={t("pair.compact.copy")} className="ui-icon-button size-7 shrink-0">
                      {copied.state === "copied" ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </div>
                  <p role="status" className="mt-2 text-[11px]">{t(copied.state === "failed" ? "pair.compact.copyFailed" : copied.state === "copied" ? "pair.compact.copied" : "pair.compact.expiry")}</p>
                </div>
              </details>
            </>}
        </section>
        <div className="mt-4 flex min-w-0 items-center justify-center gap-1.5 text-[11px] text-ink-tertiary" title={environment ? environment.label + " · " + environment.version + " · " + environment.platform : undefined}>
          <ShieldCheck size={12} className="shrink-0" /><span className="truncate">{where?.host || environment?.label || productName()}</span>
          <span aria-hidden="true">·</span><span className="shrink-0">{t("pair.compact.remember")}</span>
        </div>
      </div>
    </main>
  );
}
