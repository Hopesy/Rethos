import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { api, useStore } from "@/state/store";
import { APP_REPOSITORY } from "@/lib/app-links";
import { track } from "@/lib/analytics";
import { brandStatus } from "@/lib/brand";
import { cornerPopupWaits, firstChatQuiet, firstReplyPending } from "@/lib/corner-popup";
import { dismissNotice, GROK_MOVE_NOTICE, launchNotice, markLaunchNotice, nextNotice, noticeSeen, SIMPLE_MODE_NOTICE, STAR_NOTICE, TWO_PLACES_NOTICE, usedBefore } from "@/lib/notices";
import { useTwoPlaces } from "@/lib/two-places";
import { useSimpleModePromptSeen } from "@/lib/simple-mode-prompt";
import { welcomeFinishedThisLaunch, type WelcomeViewer } from "@/lib/onboarding";
import { launchDialogShown, markLaunchDialog } from "@/lib/launch-dialogs";
import { useUpdaterState } from "@/lib/updater";
import { t } from "@/lib/i18n";
import { useMoveQuiet } from "./CloudSendStrip";
import { GrokMovePopup, reportGrokMovePopup, type GrokMovePopupAction } from "./GrokMovePopup";
import { GrokMoveDialog } from "./lazy-screens";
import { LinkButton, NoticeCard, NotNowButton } from "./NoticeCard";
import { useDesktopNotices, useOtherDialogOpen } from "./notice-dialogs";
import { localDesktopPage } from "./onboarding/WelcomeGate";
import { useMausBotWelcomeDue } from "./MausBotWelcome";
import { reportSimpleModePrompt, SimpleModePrompt } from "./SimpleModePrompt";
import { TwoPlacesCard } from "./TwoPlacesCard";

function StarCard({ onDismiss }: { onDismiss: () => void }) {
  return <NoticeCard titleId="github-star-title" notice="github-star" icon={Star} title={t("star.title")} onDismiss={onDismiss}>
    <p className="mb-3 mt-1 text-[13px] text-ink-secondary">{t("star.body")}</p>
    <div className="flex flex-wrap items-center gap-3">
      <LinkButton url={APP_REPOSITORY} label={t("star.button")} onOpened={onDismiss} />
      <NotNowButton onClick={onDismiss} />
    </div>
  </NoticeCard>;
}

export function AppNotices({ quiet = false, viewer = null, now = Date.now }: { quiet?: boolean; viewer?: WelcomeViewer | null; now?: () => number }) {
  const { state, dispatch } = useStore();
  const remote = window.ogb?.remoteClient?.active === true;
  const local = localDesktopPage();
  const desktop = remote ? undefined : window.ogb?.desktopNotices;
  const desktopState = useDesktopNotices(desktop);
  const [closed, setClosed] = useState(false);
  const [simpleShown, setSimpleShown] = useState(false);
  const [grokShown, setGrokShown] = useState(false);
  const [grokOpen, setGrokOpen] = useState(false);
  const [grokLanded, setGrokLanded] = useState(false);
  const updater = useUpdaterState();
  const moving = useMoveQuiet(now);
  const mausBot = useMausBotWelcomeDue(viewer);
  const two = useTwoPlaces();
  const twoFact = !local || two.suggest === null ? false : two.suggest === undefined ? null : true;
  const record = state.config?.onboarding;
  const simpleDue = !useSimpleModePromptSeen();
  const liveCall = Boolean(state.liveCall && state.liveCall.status !== "ended");
  const simpleBlocked = useOtherDialogOpen(simpleDue) || liveCall;
  const waits = cornerPopupWaits(state, updater, { quiet, idle: true, viewer, duringFirstChat: true });
  const firstChat = firstReplyPending(state);
  const afterWelcome = welcomeFinishedThisLaunch() || launchDialogShown() === "mausbot" || firstChat;
  const grokDue = !remote && viewer?.canSave !== false && !state.config?.team && brandStatus().source !== "file" && moving !== true
    && launchDialogShown() !== "mausbot" && !noticeSeen(record, GROK_MOVE_NOTICE) && !desktopState?.seen.includes(GROK_MOVE_NOTICE);
  const grokBlocked = useOtherDialogOpen(grokDue) || liveCall;
  const grokLanding = welcomeFinishedThisLaunch() && !grokLanded;
  useEffect(() => {
    if (!grokDue || !grokLanding || waits) return;
    const timer = setTimeout(() => setGrokLanded(true), 6_000);
    return () => clearTimeout(timer);
  }, [grokDue, grokLanding, waits]);
  const grokNow = !grokDue ? false
    : !viewer || (desktop && !desktopState) || firstChat === null || mausBot.due || moving === null || grokLanding || grokBlocked ? null : true;
  const launch = launchNotice();
  const notice = waits || closed ? null
    : firstChatQuiet(state) ? (grokNow === true && (launch === null || launch === GROK_MOVE_NOTICE) ? GROK_MOVE_NOTICE : null)
      : nextNotice({
        [GROK_MOVE_NOTICE]: grokNow,
        [SIMPLE_MODE_NOTICE]: !simpleDue || afterWelcome === true ? false : afterWelcome === null || mausBot.due || simpleBlocked ? null : true,
        [TWO_PLACES_NOTICE]: twoFact,
        [STAR_NOTICE]: !local || moving || brandStatus().source === "file" || !usedBefore(state.bots) ? false : moving === null ? null : true,
      }, id => id === STAR_NOTICE && noticeSeen(record, id), launch);
  useEffect(() => {
    if (!notice) return;
    markLaunchNotice(notice);
    if (notice === GROK_MOVE_NOTICE || notice === SIMPLE_MODE_NOTICE) markLaunchDialog("notices");
    if (notice === SIMPLE_MODE_NOTICE && !simpleShown) { setSimpleShown(true); reportSimpleModePrompt("shown"); }
    if (notice === GROK_MOVE_NOTICE && !grokShown) { setGrokShown(true); reportGrokMovePopup("shown"); }
  }, [notice]);
  const save = (id: string) => {
    const patch = dismissNotice(record, id);
    if (patch) void api("/api/config", { method: "PUT", body: JSON.stringify(patch) })
      .then(config => dispatch({ type: "configStatus", config })).catch(() => {});
  };
  const close = () => setClosed(true);
  if (grokOpen) return <GrokMoveDialog onClose={() => setGrokOpen(false)} />;
  if (notice === GROK_MOVE_NOTICE) {
    const done = (action: GrokMovePopupAction) => {
      reportGrokMovePopup(action); close(); save(GROK_MOVE_NOTICE);
      void desktop?.seen(GROK_MOVE_NOTICE).catch(() => {});
      if (action === "start") setGrokOpen(true);
    };
    return <GrokMovePopup onDone={done} />;
  }
  if (notice === SIMPLE_MODE_NOTICE) return <SimpleModePrompt onClose={close} />;
  if (notice === TWO_PLACES_NOTICE && two.suggest) {
    const { key, kind } = two.suggest;
    return <TwoPlacesCard key={key} suggest={two.suggest}
      onBring={() => { track("two_places_card", { action: "bring", kind }); return two.accept(key).then(close); }}
      onDismiss={() => { track("two_places_card", { action: "not_now", kind }); two.dismiss(key); close(); }} />;
  }
  return notice === STAR_NOTICE ? <StarCard onDismiss={() => { close(); save(STAR_NOTICE); }} /> : null;
}
