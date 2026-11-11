import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { mobileBackTarget, registerMobileBackTarget, subscribeMobileBack } from "@/lib/mobile-back-targets";

const ENTRY_KEY = "rethosMobileOverlay";

export function useMobileBackDismiss(open: boolean, onDismiss: () => void, priority = 0) {
  const latest = useRef(onDismiss);
  latest.current = onDismiss;
  useEffect(() => {
    if (open) return registerMobileBackTarget(() => latest.current(), priority);
  }, [open, priority]);
}

export function useMobileBackNavigation() {
  const target = useSyncExternalStore(subscribeMobileBack, mobileBackTarget, () => null);
  useMobileBackHistory(target !== null, () => mobileBackTarget()?.dismiss());
}

function useMobileBackHistory(open: boolean, onDismiss: () => void) {
  const prefix = useId();
  const sequence = useRef(0);
  const latest = useRef(onDismiss);
  latest.current = onDismiss;
  const entry = useRef<{ id: string; returning: boolean } | null>(null);
  const mounted = useRef(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    mounted.current = true;
    const onPop = () => {
      const previous = entry.current;
      if (previous && window.history.state?.[ENTRY_KEY] === previous.id) return;
      entry.current = null;
      if (previous && !previous.returning) latest.current();
      setRevision((value) => value + 1);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      mounted.current = false;
      window.removeEventListener("popstate", onPop);
      queueMicrotask(() => {
        if (mounted.current) return;
        const previous = entry.current;
        if (previous && !previous.returning && window.history.state?.[ENTRY_KEY] === previous.id) window.history.back();
        entry.current = null;
      });
    };
  }, []);

  useEffect(() => {
    const existing = window.history.state?.[ENTRY_KEY];
    if (!entry.current && typeof existing === "string") entry.current = { id: existing, returning: false };
    if (open && !entry.current) {
      const id = `${prefix}:${++sequence.current}`;
      window.history.pushState({ ...window.history.state, [ENTRY_KEY]: id }, "");
      entry.current = { id, returning: false };
    } else if (!open && entry.current && !entry.current.returning) {
      if (window.history.state?.[ENTRY_KEY] === entry.current.id) {
        entry.current.returning = true;
        window.history.back();
      } else entry.current = null;
    }
  }, [open, prefix, revision]);
}
