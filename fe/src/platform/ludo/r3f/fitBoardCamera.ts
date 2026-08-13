import { BOARD_WORLD_SIZE } from "../boardMap";
import { seatFacingAzimuth, type LudoViewMode } from "../cosmeticsCatalog";

const HALF = BOARD_WORLD_SIZE / 2;

/** Four outer corners of the play slab (XZ), y≈table. */
const CORNERS: readonly [number, number, number][] = [
  [-HALF, 0.08, -HALF],
  [HALF, 0.08, -HALF],
  [-HALF, 0.08, HALF],
  [HALF, 0.08, HALF],
];

export type FitCamResult = {
  position: [number, number, number];
  target: [number, number, number];
  dist: number;
  fov: number;
  elev: number;
  az: number;
  minDist: number;
  maxDist: number;
  minPolar: number;
  maxPolar: number;
  rotate: boolean;
};

type ModeTune = {
  elev: number;
  yawBias: number;
  fov: number;
  /** >1 pulls camera back so opposite corners stay inside frame */
  margin: number;
  rotate: boolean;
  polarPad: number;
};

function modeTune(viewMode: LudoViewMode): ModeTune {
  switch (viewMode) {
    case "screen":
      // Near-orthographic top-down — match 2D reference framing
      return {
        elev: 1.18,
        yawBias: 0,
        fov: 34,
        margin: 1.04,
        rotate: false,
        polarPad: 0.05,
      };
    case "cinema":
      // Dramatic 3/4 tilt — slabs & pawn height read clearly
      return {
        elev: 0.62,
        yawBias: 0.38,
        fov: 34,
        margin: 1.1,
        rotate: false,
        polarPad: 0.1,
      };
    default:
      // Orbit: wide tilt + zoom so players can inspect sides / pull back
      return {
        elev: 0.72,
        yawBias: 0.12,
        fov: 44,
        margin: 1.1,
        rotate: true,
        polarPad: 0.72,
      };
  }
}

/**
 * Smallest camera distance that keeps all 4 board corners inside the frustum
 * (fits the two farthest opposite edges/corners — near as possible without clipping).
 */
export function fitBoardDistance(
  fovDeg: number,
  aspect: number,
  elev: number,
  az: number,
  margin: number,
): number {
  const vFov = (fovDeg * Math.PI) / 180;
  const tanV = Math.tan(vFov / 2);
  const tanH = tanV * Math.max(aspect, 0.35);

  let lo = 6;
  let hi = 52;
  for (let i = 0; i < 28; i++) {
    const d = (lo + hi) / 2;
    const camX = Math.sin(az) * Math.cos(elev) * d;
    const camY = Math.sin(elev) * d;
    const camZ = Math.cos(az) * Math.cos(elev) * d;

    const fl = Math.hypot(camX, camY, camZ) || 1;
    const fx = -camX / fl;
    const fy = -camY / fl;
    const fz = -camZ / fl;

    // right = normalize(forward × worldUp)
    let rx = -fz;
    let ry = 0;
    let rz = fx;
    const rl = Math.hypot(rx, ry, rz) || 1;
    rx /= rl;
    ry /= rl;
    rz /= rl;

    // up = right × forward
    const ux = ry * fz - rz * fy;
    const uy = rz * fx - rx * fz;
    const uz = rx * fy - ry * fx;

    let ok = true;
    for (const [cx, cy, cz] of CORNERS) {
      const vx = cx - camX;
      const vy = cy - camY;
      const vz = cz - camZ;
      const zCam = vx * fx + vy * fy + vz * fz;
      if (zCam <= 0.15) {
        ok = false;
        break;
      }
      const xCam = vx * rx + vy * ry + vz * rz;
      const yCam = vx * ux + vy * uy + vz * uz;
      if (
        Math.abs(xCam) > tanH * zCam * margin ||
        Math.abs(yCam) > tanV * zCam * margin
      ) {
        ok = false;
        break;
      }
    }
    if (ok) hi = d;
    else lo = d;
  }
  return hi;
}

export function computeFitCam(
  viewMode: LudoViewMode,
  myColor: string | null | undefined,
  aspect: number,
): FitCamResult {
  const tune = modeTune(viewMode);
  const az = seatFacingAzimuth(myColor) + tune.yawBias;
  const dist = fitBoardDistance(
    tune.fov,
    aspect,
    tune.elev,
    az,
    tune.margin,
  );
  const x = Math.sin(az) * Math.cos(tune.elev) * dist;
  const y = Math.sin(tune.elev) * dist;
  const z = Math.cos(az) * Math.cos(tune.elev) * dist;
  const target: [number, number, number] = [0, 0.12, 0];

  const orbit = viewMode === "orbit";
  const minPolar = orbit
    ? 0.12 // gần nhìn từ trên
    : Math.max(0.25, tune.elev - tune.polarPad);
  const maxPolar = orbit
    ? Math.PI / 2 - 0.08 // sát ngang bàn, chưa chui xuống dưới
    : Math.min(Math.PI / 2.05, tune.elev + tune.polarPad);

  return {
    position: [x, y, z],
    target,
    dist,
    fov: tune.fov,
    elev: tune.elev,
    az,
    minDist: orbit ? dist * 0.55 : dist * 0.96,
    maxDist: orbit ? dist * 2.35 : dist * 1.12,
    minPolar,
    maxPolar,
    rotate: tune.rotate,
  };
}
