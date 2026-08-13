import type { LudoViewMode } from "./cosmeticsCatalog";

export type LudoOrbitPose = {
  position: [number, number, number];
  target: [number, number, number];
};

export type LudoOrbitLockState = {
  locked: boolean;
  pose: LudoOrbitPose | null;
};

export const ORBIT_LOCK_EVENT = "ludo-orbit-lock";

const STORAGE_KEY = "ludo_orbit_lock_v1";

function isPose(raw: unknown): raw is LudoOrbitPose {
  if (!raw || typeof raw !== "object") return false;
  const p = raw as LudoOrbitPose;
  return (
    Array.isArray(p.position) &&
    p.position.length === 3 &&
    p.position.every((n) => typeof n === "number" && Number.isFinite(n)) &&
    Array.isArray(p.target) &&
    p.target.length === 3 &&
    p.target.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

export function readOrbitLock(): LudoOrbitLockState {
  if (typeof window === "undefined") {
    return { locked: false, pose: null };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { locked: false, pose: null };
    const j = JSON.parse(raw) as Partial<LudoOrbitLockState>;
    const pose = isPose(j.pose) ? j.pose : null;
    return {
      locked: !!j.locked && !!pose,
      pose,
    };
  } catch {
    return { locked: false, pose: null };
  }
}

export function writeOrbitLock(next: LudoOrbitLockState): void {
  try {
    if (!next.locked && !next.pose) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          locked: !!next.locked && !!next.pose,
          pose: next.pose,
        }),
      );
    }
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(ORBIT_LOCK_EVENT, { detail: next }),
    );
  }
}

export function subscribeOrbitLock(
  onChange: (state: LudoOrbitLockState) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<LudoOrbitLockState>).detail;
    if (detail) onChange(detail);
    else onChange(readOrbitLock());
  };
  window.addEventListener(ORBIT_LOCK_EVENT, handler);
  return () => window.removeEventListener(ORBIT_LOCK_EVENT, handler);
}

/** Lock only applies in free-orbit mode. */
export function orbitLockActive(
  viewMode: LudoViewMode | undefined,
  locked: boolean,
): boolean {
  return viewMode === "orbit" && locked;
}
