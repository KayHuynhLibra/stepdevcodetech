/** Playtime tracking — responsible gaming nudges (client-only). */

import { brandLsGet, brandLsSet } from "./brand";

const STORAGE_KEY = "sofia_playtime_v1";

/** Session milestones (minutes) */
export const SESSION_MILESTONES_MIN = [30, 60, 90] as const;
/** Daily milestones (minutes) */
export const DAY_MILESTONES_MIN = [60, 120, 180] as const;

export type NudgeKind = "session" | "day";

export interface PlaytimeNudgeInfo {
  kind: NudgeKind;
  minutes: number;
  sessionMs: number;
  dayMs: number;
  title: string;
  message: string;
}

export interface PlaytimePersisted {
  dayKey: string;
  /** Accumulated visible play ms today (across sessions) */
  dayMs: number;
  /** Session milestones (minutes) already shown today */
  shownSession: number[];
  /** Day milestones (minutes) already shown today */
  shownDay: number[];
}

function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function emptyState(dayKey = todayKey()): PlaytimePersisted {
  return {
    dayKey,
    dayMs: 0,
    shownSession: [],
    shownDay: [],
  };
}

export function loadPlaytime(): PlaytimePersisted {
  try {
    const raw = brandLsGet(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<PlaytimePersisted>;
    const key = todayKey();
    if (parsed.dayKey !== key) return emptyState(key);
    return {
      dayKey: key,
      dayMs: Math.max(0, Number(parsed.dayMs) || 0),
      shownSession: Array.isArray(parsed.shownSession)
        ? parsed.shownSession.filter((n) => typeof n === "number")
        : [],
      shownDay: Array.isArray(parsed.shownDay)
        ? parsed.shownDay.filter((n) => typeof n === "number")
        : [],
    };
  } catch {
    return emptyState();
  }
}

export function savePlaytime(state: PlaytimePersisted): void {
  try {
    brandLsSet(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

/** Compact duration: 32p · 1h05 */
export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}p`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function nudgeCopy(kind: NudgeKind, minutes: number): { title: string; message: string } {
  if (kind === "session") {
    return {
      title: `Bạn đã ngồi bàn ${minutes} phút`,
      message:
        "Nên nghỉ mắt, uống nước hoặc đứng dậy đi lại một chút trước khi tiếp tục chơi.",
    };
  }
  return {
    title: `Hôm nay bạn đã chơi ${minutes} phút`,
    message:
      "Chơi lâu có thể gây mệt và ghiền. Hãy cân nhắc tạm dừng và quay lại sau.",
  };
}

/**
 * Returns the next unshown milestone for this day, if any.
 * Prefers session milestones, then day milestones.
 */
export function nextNudge(
  state: PlaytimePersisted,
  sessionMs: number,
  dayMs: number,
): PlaytimeNudgeInfo | null {
  for (const minutes of SESSION_MILESTONES_MIN) {
    if (sessionMs >= minutes * 60_000 && !state.shownSession.includes(minutes)) {
      const copy = nudgeCopy("session", minutes);
      return {
        kind: "session",
        minutes,
        sessionMs,
        dayMs,
        ...copy,
      };
    }
  }
  for (const minutes of DAY_MILESTONES_MIN) {
    if (dayMs >= minutes * 60_000 && !state.shownDay.includes(minutes)) {
      const copy = nudgeCopy("day", minutes);
      return {
        kind: "day",
        minutes,
        sessionMs,
        dayMs,
        ...copy,
      };
    }
  }
  return null;
}

export function markNudgeShown(
  state: PlaytimePersisted,
  kind: NudgeKind,
  minutes: number,
): PlaytimePersisted {
  const next = { ...state };
  if (kind === "session") {
    if (!next.shownSession.includes(minutes)) {
      next.shownSession = [...next.shownSession, minutes];
    }
  } else if (!next.shownDay.includes(minutes)) {
    next.shownDay = [...next.shownDay, minutes];
  }
  savePlaytime(next);
  return next;
}

/**
 * Add visible delta ms to day total; rollover day if needed.
 * Returns updated persisted state.
 */
export function addVisibleMs(
  state: PlaytimePersisted,
  deltaMs: number,
): PlaytimePersisted {
  const key = todayKey();
  let next = state;
  if (state.dayKey !== key) {
    next = emptyState(key);
  }
  if (deltaMs <= 0) {
    if (next !== state) savePlaytime(next);
    return next;
  }
  next = {
    ...next,
    dayMs: next.dayMs + deltaMs,
  };
  savePlaytime(next);
  return next;
}
