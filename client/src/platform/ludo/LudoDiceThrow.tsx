import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  screenCornerForColor,
  type LudoBoardCorner,
} from "./cosmeticsCatalog";

type Props = {
  dice?: number | null;
  faces?: number[] | null;
  throwKey: number;
  fromColor?: string | null;
  facingColor?: string | null;
  diceUrl?: string | null;
  reduceFx?: boolean;
};

type LiveDie = {
  key: number;
  value: number;
  corner: LudoBoardCorner;
  slot: number;
  spin: number;
  path: ThrowPath;
};

type ThrowPath = {
  x0: string;
  y0: string;
  x1: string;
  y1: string;
  x2: string;
  y2: string;
  x3: string;
  y3: string;
  landX: string;
  landY: string;
  delay: string;
};

/** Opposites sum to 7 — front face toward camera when settled. */
const FACE_LAYOUT = {
  front: 1,
  back: 6,
  right: 3,
  left: 4,
  top: 2,
  bottom: 5,
} as const;

/** Rotate model so face N faces the camera. */
const SETTLE: Record<number, { rx: string; ry: string }> = {
  1: { rx: "0deg", ry: "0deg" },
  2: { rx: "-90deg", ry: "0deg" },
  3: { rx: "0deg", ry: "-90deg" },
  4: { rx: "0deg", ry: "90deg" },
  5: { rx: "90deg", ry: "0deg" },
  6: { rx: "0deg", ry: "180deg" },
};

const CORNER_START: Record<LudoBoardCorner, [number, number]> = {
  tl: [8, 8],
  tr: [92, 8],
  bl: [8, 92],
  br: [92, 92],
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function pct(n: number) {
  return `${n.toFixed(1)}%`;
}

/**
 * Build a corner→center arc. Dual dice get opposite side bias so they
 * fly apart; each throw randomizes midpoints so direction changes.
 */
function makeThrowPath(
  corner: LudoBoardCorner,
  slot: number,
  dual: boolean,
): ThrowPath {
  const [sx0, sy0] = CORNER_START[corner];
  const towardX = 50 - sx0;
  const towardY = 50 - sy0;
  const len = Math.hypot(towardX, towardY) || 1;
  const ux = towardX / len;
  const uy = towardY / len;
  /* Perpendicular for side spread */
  const px = -uy;
  const py = ux;

  const side =
    dual
      ? (slot === 0 ? -1 : 1) * (10 + Math.random() * 14)
      : (Math.random() - 0.5) * 18;
  const wobble = (Math.random() - 0.5) * 16;
  const arc = 6 + Math.random() * 14;
  const startNudge = (Math.random() - 0.5) * (dual ? 8 : 4);

  const x0 = clamp(sx0 + px * startNudge + ux * (Math.random() * 2), 2, 98);
  const y0 = clamp(sy0 + py * startNudge + uy * (Math.random() * 2), 2, 98);

  const x1 = clamp(
    sx0 + towardX * 0.35 + px * (side + wobble * 0.4) + ux * arc * 0.15,
    4,
    96,
  );
  const y1 = clamp(
    sy0 + towardY * 0.35 + py * (side + wobble * 0.4) + uy * arc * 0.15,
    4,
    96,
  );

  const x2 = clamp(
    sx0 + towardX * 0.72 + px * (side * 0.55 - wobble * 0.5),
    8,
    92,
  );
  const y2 = clamp(
    sy0 + towardY * 0.72 + py * (side * 0.55 - wobble * 0.5) - arc * 0.35,
    8,
    92,
  );

  const landSpread = dual ? (slot === 0 ? -1 : 1) * (1.6 + Math.random() * 1.1) : 0;
  const landYJitter = dual ? (Math.random() - 0.5) * 1.2 : 0;
  const x3 = clamp(50 + px * landSpread * 3 + (Math.random() - 0.5) * 4, 42, 58);
  const y3 = clamp(50 + landYJitter * 3 + (Math.random() - 0.5) * 3, 44, 56);

  return {
    x0: pct(x0),
    y0: pct(y0),
    x1: pct(x1),
    y1: pct(y1),
    x2: pct(x2),
    y2: pct(y2),
    x3: pct(x3),
    y3: pct(y3),
    landX: `${landSpread.toFixed(2)}rem`,
    landY: `${landYJitter.toFixed(2)}rem`,
    delay: dual && slot === 1 ? `${0.1 + Math.random() * 0.12}s` : "0s",
  };
}

function DiePips({ n }: { n: number }) {
  return (
    <span className={`ludo-die-pips ludo-die-pips--${n}`}>
      {Array.from({ length: n }, (_, i) => (
        <i key={i} className="ludo-die-pips__dot" />
      ))}
    </span>
  );
}

function DieCubeMesh({ art }: { art?: string }) {
  const sides = (
    Object.entries(FACE_LAYOUT) as [keyof typeof FACE_LAYOUT, number][]
  ).map(([side, n]) => (
    <div
      key={side}
      className={`ludo-dice-throw__side ludo-dice-throw__side--${side} ${
        n === 1 || n === 6 ? "is-accent" : ""
      } ${art ? "has-art" : ""}`}
      style={
        art
          ? {
              backgroundImage: `url(${art})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      {art ? (
        <span className="ludo-dice-throw__num">{n}</span>
      ) : (
        <DiePips n={n} />
      )}
    </div>
  ));

  return <div className="ludo-dice-throw__mesh">{sides}</div>;
}

/**
 * CSS 3D cube throw — corner→center like WebGL die: perspective, tumble, settle.
 * Dual mode: smaller dice, randomized divergent flight paths each throw.
 */
export function LudoDiceThrow({
  dice,
  faces,
  throwKey,
  fromColor,
  facingColor,
  diceUrl,
  reduceFx,
}: Props) {
  const [live, setLive] = useState<LiveDie[]>([]);
  const startedKey = useRef(0);

  useEffect(() => {
    if (reduceFx) {
      setLive([]);
      startedKey.current = 0;
      return;
    }
    const resolved = (
      faces?.length
        ? faces
        : dice != null
          ? [dice]
          : []
    ).filter((f) => f >= 1 && f <= 6);
    if (throwKey <= 0 || !resolved.length) return;
    if (startedKey.current === throwKey) return;
    startedKey.current = throwKey;

    const corner = screenCornerForColor(fromColor, facingColor);
    const dual = resolved.length > 1;
    setLive(
      resolved.map((value, slot) => ({
        key: throwKey,
        value,
        corner,
        slot,
        spin: Math.floor(Math.random() * 4),
        path: makeThrowPath(corner, slot, dual),
      })),
    );

    const done = window.setTimeout(() => {
      setLive((cur) => (cur.some((d) => d.key === throwKey) ? [] : cur));
    }, 1750);

    return () => {
      window.clearTimeout(done);
    };
  }, [throwKey, dice, faces, fromColor, facingColor, reduceFx]);

  if (!live.length) return null;

  const art = (diceUrl || "").trim();
  const dual = live.length > 1;

  return (
    <div
      className={`ludo-dice-throw ludo-dice-throw--cube3d ludo-dice-throw--fly-var${
        dual ? " ludo-dice-throw--dual" : ""
      }`}
      aria-hidden
    >
      {dual ? (
        <span className="ludo-dice-throw__pair-tag">2 xúc</span>
      ) : null}
      {live.map((d) => {
        const settle = SETTLE[d.value] ?? SETTLE[1]!;
        const p = d.path;
        return (
          <div
            key={`${d.key}-${d.slot}`}
            className={`ludo-dice-throw__scene ludo-dice-throw__cube--slot-${d.slot}`}
            style={
              {
                "--settle-rx": settle.rx,
                "--settle-ry": settle.ry,
                "--fx0": p.x0,
                "--fy0": p.y0,
                "--fx1": p.x1,
                "--fy1": p.y1,
                "--fx2": p.x2,
                "--fy2": p.y2,
                "--fx3": p.x3,
                "--fy3": p.y3,
                "--ludo-dice-land-x": p.landX,
                "--ludo-dice-land-y": p.landY,
                "--fly-delay": p.delay,
              } as CSSProperties
            }
          >
            <span
              className="ludo-dice-throw__shadow"
              style={{ animationDelay: p.delay } as CSSProperties}
            />
            <div
              className={`ludo-dice-throw__spin ludo-dice-throw__spin--${d.spin}`}
              style={{ animationDelay: p.delay } as CSSProperties}
            >
              <DieCubeMesh art={art || undefined} />
            </div>
            <span className="ludo-dice-throw__glow" />
          </div>
        );
      })}
    </div>
  );
}
