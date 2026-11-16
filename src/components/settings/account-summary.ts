import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { isConnected, profileForSession, readSessionState, type SessionState } from "@/lib/session";
import { useStore } from "@/state/store";

export interface AccountSummary { signedIn: boolean | null; email: string | null }

export function useAccountSummary(): AccountSummary {
  const { profile, session } = useYou();
  return { signedIn: session === null ? null : isConnected(session), email: profile?.email ?? null };
}

export function useYou(): { profile: { name?: string; email?: string; avatarUrl?: string } | undefined; session: SessionState | null } {
  const { state } = useStore();
  const [session, setSession] = useState<SessionState | null>(null);
  useEffect(() => {
    let alive = true;
    void readSessionState().then(next => { if (alive) setSession(next); });
    return () => { alive = false; };
  }, []);
  return { profile: profileForSession(state.config?.profile, session), session };
}

export function accountLine(summary: AccountSummary, { browser, place }: { browser: boolean; place: string; openSource: boolean }): string {
  if (summary.signedIn === false) return t("settings.account.notSignedIn");
  return summary.email ?? t(browser ? "settings.account.signedInTo" : "settings.account.onThisDevice", { place });
}
