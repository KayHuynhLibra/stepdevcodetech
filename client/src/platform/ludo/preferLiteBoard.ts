/** Mobile / Save-Data → CSS board (skip ~1MB Three.js). */
export function preferLiteBoard(): boolean {
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
  return window.matchMedia("(max-width: 720px), (pointer: coarse)").matches;
}

export function prefetchLudo3D(): void {
  if (preferLiteBoard()) return;
  void import("./r3f/LudoBoard3D");
}
