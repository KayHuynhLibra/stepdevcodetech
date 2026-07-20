import type { GameState } from "../cards";

function arrEq(a: number[] | undefined, b: number[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function historyHeadSame(prev: GameState, next: GameState): boolean {
  const ph = prev.history;
  const nh = next.history;
  if (ph === nh) return true;
  if (ph.length !== nh.length) return false;
  if (ph.length === 0) return true;
  return ph[0]?.round === nh[0]?.round && ph[0]?.win === nh[0]?.win;
}

function chatSame(prev: GameState, next: GameState): boolean {
  const a = prev.chatLines;
  const b = next.chatLines;
  if (a === b) return true;
  if (!a || !b) return a === b;
  if (a.length !== b.length) return false;
  if (a.length === 0) return true;
  const la = a[a.length - 1]!;
  const lb = b[b.length - 1]!;
  return la.at === lb.at && la.text === lb.text && la.name === lb.name;
}

function onlinePlayersSame(
  prev: GameState | null,
  next: GameState,
): boolean {
  const a = prev?.onlinePlayers;
  const b = next.onlinePlayers;
  if (a === b) return true;
  if (!a && !b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i]!.id !== b[i]!.id || a[i]!.balance !== b[i]!.balance) {
      return false;
    }
  }
  return true;
}

function viewerAuthSame(prev: GameState | null, next: GameState): boolean {
  const a = prev?.viewerAuth;
  const b = next.viewerAuth;
  if (a === b) return true;
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.code === b.code &&
    a.isVip === b.isVip &&
    a.roundsPlayed === b.roundsPlayed &&
    a.vipGranted === b.vipGranted
  );
}

/** Gộp state socket — tránh re-render khi chỉ serverTime/vipPool jitter. */
export function mergeGameState(
  prev: GameState | null,
  next: GameState,
  opts?: { trackOnlinePlayers?: boolean },
): GameState {
  if (!prev) return next;

  const trackOnline = opts?.trackOnlinePlayers ?? false;

  const coreSame =
    prev.phase === next.phase &&
    prev.phaseEndsAt === next.phaseEndsAt &&
    prev.roundNumber === next.roundNumber &&
    prev.winningCard === next.winningCard &&
    prev.yourBalance === next.yourBalance &&
    arrEq(prev.yourBets, next.yourBets) &&
    arrEq(prev.displayBets, next.displayBets) &&
    arrEq(prev.playerCounts, next.playerCounts) &&
    historyHeadSame(prev, next) &&
    chatSame(prev, next) &&
    viewerAuthSame(prev, next) &&
    prev.onlineDisplay === next.onlineDisplay &&
    (!trackOnline || onlinePlayersSame(prev, next));

  if (!coreSame) return next;

  const vipDelta = Math.abs((prev.vipPool ?? 0) - (next.vipPool ?? 0));
  const timeDelta = Math.abs(prev.serverTime - next.serverTime);
  if (vipDelta < 1 && timeDelta < 900) {
    return prev;
  }

  return {
    ...prev,
    serverTime: next.serverTime,
    vipPool: next.vipPool,
  };
}
