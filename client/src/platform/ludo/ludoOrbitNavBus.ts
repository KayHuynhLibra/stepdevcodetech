import type { LudoOrbitPose } from "./ludoOrbitLock";

export type LudoOrbitNudge = {
  yaw?: number;
  pitch?: number;
  zoom?: number;
};

export type LudoOrbitNavApi = {
  nudge: (delta: LudoOrbitNudge) => LudoOrbitPose | null;
  capture: () => LudoOrbitPose | null;
};

let api: LudoOrbitNavApi | null = null;

/** Scene registers while Canvas is mounted (orbit mode). */
export function registerOrbitNav(next: LudoOrbitNavApi | null): void {
  api = next;
}

export function nudgeOrbit(delta: LudoOrbitNudge): LudoOrbitPose | null {
  return api?.nudge(delta) ?? null;
}

export function captureOrbitPose(): LudoOrbitPose | null {
  return api?.capture() ?? null;
}

export function hasOrbitNav(): boolean {
  return !!api;
}
