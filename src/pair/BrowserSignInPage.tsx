import { useState } from "react";
import { ArrowRight, Loader2, Smartphone } from "lucide-react";

import { newAttemptId, signInWithBrowserGrant } from "../lib/session";
import { t } from "../lib/i18n";
import { LoginShell } from "./LoginShell";

/** Nothing is redeemed until the person continues, so a sent link never signs this browser in unseen; the credential is never shown. */
export function BrowserSignInPage({ credential, owner }: { credential: string; owner: string }) {
  const [attemptId] = useState(() => newAttemptId());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function continueSignIn() {
    setBusy(true);
    setError(null);
    const result = await signInWithBrowserGrant(credential, attemptId);
    if (result.ok) {
      location.replace("/");
      return;
    }
    setBusy(false);
    setError(result.error);
  }

  return (
    <LoginShell>
        <div className="mb-5 flex size-11 items-center justify-center rounded-xl bg-accent/10 text-accent"><Smartphone size={22} /></div>
        <h1>{t("login.qr.title")}</h1>
        <p className="mt-2 text-[13px] leading-6 text-ink-secondary">{t("login.qr.subtitle")}</p>
        <div className="mt-5 rounded-lg border border-hairline/50 bg-inset px-3 py-2.5 text-[13px] text-ink">{owner}</div>
        {error ? <p role="alert" className="mt-3 text-[13px] text-danger">{error}</p> : null}
        <button type="button" onClick={() => void continueSignIn()} disabled={busy}
          className="login-submit mt-5">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}{t(busy ? "pair.signingIn" : "login.submit")}
        </button>
        <p className="mt-3 text-center text-[11px] text-ink-tertiary">{t("login.remember")}</p>
    </LoginShell>
  );
}
