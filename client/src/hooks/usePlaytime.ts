import { useCallback, useEffect, useRef, useState } from "react";
import {
  addVisibleMs,
  loadPlaytime,
  markNudgeShown,
  nextNudge,
  type PlaytimeNudgeInfo,
  type PlaytimePersisted,
} from "../playtime";

const TICK_MS = 15_000;

export interface UsePlaytimeResult {
  sessionMs: number;
  dayMs: number;
  nudge: PlaytimeNudgeInfo | null;
  dismissNudge: () => void;
}

/**
 * Tracks visible playtime while GamePage is mounted.
 * Pauses when the tab is hidden.
 */
export function usePlaytime(): UsePlaytimeResult {
  const [persisted, setPersisted] = useState<PlaytimePersisted>(() =>
    loadPlaytime(),
  );
  const [sessionMs, setSessionMs] = useState(0);
  const [nudge, setNudge] = useState<PlaytimeNudgeInfo | null>(null);

  const sessionMsRef = useRef(0);
  const persistedRef = useRef(persisted);
  const lastVisibleAtRef = useRef<number | null>(
    typeof document !== "undefined" && document.visibilityState === "visible"
      ? Date.now()
      : null,
  );
  const nudgeOpenRef = useRef(false);

  useEffect(() => {
    persistedRef.current = persisted;
  }, [persisted]);

  const flushVisible = useCallback(() => {
    const last = lastVisibleAtRef.current;
    if (last == null) return;
    if (document.visibilityState !== "visible") return;
    const now = Date.now();
    const delta = Math.max(0, Math.min(now - last, TICK_MS * 2));
    lastVisibleAtRef.current = now;
    if (delta <= 0) return;

    sessionMsRef.current += delta;
    setSessionMs(sessionMsRef.current);

    const next = addVisibleMs(persistedRef.current, delta);
    persistedRef.current = next;
    setPersisted(next);

    if (!nudgeOpenRef.current) {
      const pending = nextNudge(next, sessionMsRef.current, next.dayMs);
      if (pending) {
        nudgeOpenRef.current = true;
        setNudge(pending);
      }
    }
  }, []);

  const dismissNudge = useCallback(() => {
    const current = nudge;
    setNudge(null);
    nudgeOpenRef.current = false;
    if (!current) return;
    const next = markNudgeShown(
      persistedRef.current,
      current.kind,
      current.minutes,
    );
    persistedRef.current = next;
    setPersisted(next);
    // Immediately surface the next milestone if already past it
    const pending = nextNudge(next, sessionMsRef.current, next.dayMs);
    if (pending) {
      nudgeOpenRef.current = true;
      setNudge(pending);
    }
  }, [nudge]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        lastVisibleAtRef.current = Date.now();
      } else {
        flushVisible();
        lastVisibleAtRef.current = null;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    const id = window.setInterval(flushVisible, TICK_MS);
    // First check shortly after mount
    const boot = window.setTimeout(flushVisible, 2_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(id);
      window.clearTimeout(boot);
      flushVisible();
    };
  }, [flushVisible]);

  return {
    sessionMs,
    dayMs: persisted.dayMs,
    nudge,
    dismissNudge,
  };
}
