/** Board render mode — persisted for mobile opt-in to 3D. */
export type LudoBoardMode = "auto" | "lite" | "3d";

const STORAGE_KEY = "ludo_board_mode_v1";

export function readLudoBoardMode(): LudoBoardMode {
  if (typeof window === "undefined") return "auto";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "lite" || v === "3d" || v === "auto") return v;
  } catch {
    /* ignore */
  }
  return "auto";
}

export function writeLudoBoardMode(mode: LudoBoardMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

/** Heuristic: weak network → CSS lite (unless user forced 3d). Desktop auto → 3D. */
export function preferLiteBoard(mode: LudoBoardMode = "auto"): boolean {
  if (mode === "lite") return true;
  if (mode === "3d") return false;
  if (typeof window === "undefined") return true;
  try {
    const conn = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    if (conn?.saveData) return true;
    if (conn?.effectiveType === "2g" || conn?.effectiveType === "slow-2g") {
      return true;
    }
  } catch {
    /* ignore */
  }
  /* Phone / coarse pointer still prefer lite for battery; tablet+ desktop → 3D */
  const narrow = window.matchMedia("(max-width: 520px)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  if (narrow && coarse) return true;
  return false;
}

export function prefetchLudo3D(mode?: LudoBoardMode): void {
  const m = mode ?? readLudoBoardMode();
  if (preferLiteBoard(m)) return;
  void import("./r3f/LudoBoard3D");
}
