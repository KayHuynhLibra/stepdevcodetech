import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CanvasTexture,
  type Group,
  SRGBColorSpace,
} from "three";
import { gridToWorld, type LudoColor } from "../boardMap";

const DICE_SIZE = 0.9;
const CENTER_Y = 1.2;

/** Near each color’s yard / corner avatar. */
const CORNER_START: Record<LudoColor, [number, number, number]> = {
  green: gridToWorld(1.2, 1.2, 1.8),
  yellow: gridToWorld(13.8, 1.2, 1.8),
  red: gridToWorld(1.2, 13.8, 1.8),
  blue: gridToWorld(13.8, 13.8, 1.8),
};

/**
 * Box face material order: +X, -X, +Y, -Y, +Z, -Z
 * Opposites sum to 7: 3/4, 1/6, 2/5
 */
const FACE_MAT_INDEX = [3, 4, 1, 6, 2, 5] as const;

/** Euler to put face N on +Y (up). */
const FACE_UP: Record<number, [number, number, number]> = {
  1: [0, 0, 0],
  2: [-Math.PI / 2, 0, 0],
  3: [0, 0, Math.PI / 2],
  4: [0, 0, -Math.PI / 2],
  5: [Math.PI / 2, 0, 0],
  6: [Math.PI, 0, 0],
};

function pipPositions(n: number): [number, number][] {
  const c = 0;
  const d = 0.28;
  switch (n) {
    case 1:
      return [[c, c]];
    case 2:
      return [
        [-d, -d],
        [d, d],
      ];
    case 3:
      return [
        [-d, -d],
        [c, c],
        [d, d],
      ];
    case 4:
      return [
        [-d, -d],
        [-d, d],
        [d, -d],
        [d, d],
      ];
    case 5:
      return [
        [-d, -d],
        [-d, d],
        [c, c],
        [d, -d],
        [d, d],
      ];
    case 6:
      return [
        [-d, -d],
        [-d, c],
        [-d, d],
        [d, -d],
        [d, c],
        [d, d],
      ];
    default:
      return [];
  }
}

function makeFaceTexture(n: number, accent = "#1a1208"): CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, "#fffef6");
  g.addColorStop(1, "#f0e0c0");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(90, 60, 30, 0.35)";
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, size - 8, size - 8);

  ctx.fillStyle = n === 1 || n === 6 ? "#b71c1c" : accent;
  const r = size * 0.09;
  for (const [px, py] of pipPositions(n)) {
    const x = size * (0.5 + px);
    const y = size * (0.5 + py);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

type DieAnim = {
  active: boolean;
  t: number;
  duration: number;
  delay: number;
  from: [number, number, number];
  to: [number, number, number];
  spin: [number, number, number];
  face: number;
  settle: [number, number, number];
  key: number;
  hasLanded: boolean;
};

function DieMesh({
  face,
  throwKey,
  fromColor,
  reduceFx,
  slot,
  slotCount,
  textures,
}: {
  face: number;
  throwKey: number;
  fromColor?: string | null;
  reduceFx?: boolean;
  slot: number;
  slotCount: number;
  textures: CanvasTexture[];
}) {
  const group = useRef<Group>(null);
  const xOff = slotCount > 1 ? (slot === 0 ? -1.15 : 1.15) : 0;

  const anim = useRef<DieAnim>({
    active: false,
    t: 0,
    duration: 1.1,
    delay: 0,
    from: [0, CENTER_Y, 0],
    to: [0, CENTER_Y, 0],
    spin: [0, 0, 0],
    face: 1,
    settle: FACE_UP[1]! as [number, number, number],
    key: 0,
    hasLanded: false,
  });

  useEffect(() => {
    if (reduceFx || throwKey <= 0 || face < 1 || face > 6) return;
    if (anim.current.key === throwKey) return;
    const color = (fromColor || "red") as LudoColor;
    const startBase = CORNER_START[color] || CORNER_START.red;
    const to: [number, number, number] = [xOff, CENTER_Y, 0];
    const start: [number, number, number] = [
      startBase[0] + (slotCount > 1 ? (slot === 0 ? -0.55 : 0.55) : 0),
      startBase[1],
      startBase[2],
    ];
    anim.current = {
      active: true,
      t: 0,
      duration: 1.05 + slot * 0.14,
      delay: slot * 0.14,
      from: [...start],
      to: [...to],
      spin: [
        (8 + Math.random() * 6) * Math.PI,
        (6 + Math.random() * 5) * Math.PI,
        (4 + Math.random() * 4) * Math.PI,
      ],
      face,
      settle: (FACE_UP[face] ?? FACE_UP[1]!) as [number, number, number],
      key: throwKey,
      hasLanded: false,
    };
    const g = group.current;
    if (g) {
      g.visible = true;
      g.position.set(...start);
      g.scale.setScalar(0.85);
    }
  }, [throwKey, face, fromColor, reduceFx, slot, slotCount, xOff]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;

    if (reduceFx) {
      g.visible = false;
      return;
    }

    const showFace = face >= 1 && face <= 6 ? face : anim.current.face;
    const hasFace = showFace >= 1 && showFace <= 6;
    if (!hasFace && !anim.current.active) {
      g.visible = false;
      return;
    }
    g.visible = true;

    if (anim.current.active) {
      const a = anim.current;
      if (a.delay > 0) {
        a.delay = Math.max(0, a.delay - dt);
        g.position.set(...a.from);
        return;
      }
      a.t = Math.min(1, a.t + dt / a.duration);
      const p = a.t;
      const e = 1 - Math.pow(1 - p, 3);
      const x = a.from[0] + (a.to[0] - a.from[0]) * e;
      const z = a.from[2] + (a.to[2] - a.from[2]) * e;
      const arc = Math.sin(p * Math.PI) * 2.6;
      const y = a.from[1] + (a.to[1] - a.from[1]) * e + arc;
      g.position.set(x, y, z);

      if (p < 0.8) {
        g.rotation.x = a.spin[0] * p;
        g.rotation.y = a.spin[1] * p;
        g.rotation.z = a.spin[2] * p;
        g.scale.setScalar(0.9 + Math.sin(p * Math.PI) * 0.2);
      } else {
        const s = (p - 0.8) / 0.2;
        const sm = s * s * (3 - 2 * s);
        g.rotation.x = a.spin[0] * 0.8 + (a.settle[0] - a.spin[0] * 0.8) * sm;
        g.rotation.y = a.spin[1] * 0.8 + (a.settle[1] - a.spin[1] * 0.8) * sm;
        g.rotation.z = a.spin[2] * 0.8 + (a.settle[2] - a.spin[2] * 0.8) * sm;
        const squash = 1 - Math.sin(sm * Math.PI) * 0.2;
        g.scale.set(1.05 / squash, squash, 1.05 / squash);
      }

      if (p >= 1) {
        a.active = false;
        a.hasLanded = true;
        g.position.set(...a.to);
        g.rotation.set(...a.settle);
        g.scale.set(1, 1, 1);
      }
      return;
    }

    if (hasFace) {
      const settle = (FACE_UP[showFace] ?? FACE_UP[1]!) as [
        number,
        number,
        number,
      ];
      g.rotation.set(...settle);
      const bob = Math.sin(performance.now() * 0.0028 + slot) * 0.05;
      g.position.set(xOff, CENTER_Y + bob, 0);
      g.scale.setScalar(1);
    }
  });

  if (reduceFx) return null;

  return (
    <group ref={group} position={[xOff, CENTER_Y, 0]}>
      <mesh castShadow>
        <boxGeometry args={[DICE_SIZE, DICE_SIZE, DICE_SIZE]} />
        {textures.map((map, i) => (
          <meshStandardMaterial
            key={i}
            attach={`material-${i}`}
            map={map}
            roughness={0.32}
            metalness={0.1}
          />
        ))}
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.05, 0]}>
        <circleGeometry args={[0.55, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.25} />
      </mesh>
    </group>
  );
}

type Props = {
  dice?: number | null;
  faces?: number[] | null;
  throwKey: number;
  fromColor?: string | null;
  reduceFx?: boolean;
};

export function LudoDice3D({
  dice,
  faces,
  throwKey,
  fromColor,
  reduceFx,
}: Props) {
  const textures = useMemo(
    () => FACE_MAT_INDEX.map((n) => makeFaceTexture(n)),
    [],
  );

  useEffect(() => {
    return () => {
      for (const t of textures) t.dispose();
    };
  }, [textures]);

  const resolved = (
    faces?.length ? faces : dice != null ? [dice] : []
  ).filter((f) => f >= 1 && f <= 6);

  if (reduceFx || !resolved.length) return null;

  return (
    <group>
      {resolved.map((face, slot) => (
        <DieMesh
          key={`die-${slot}`}
          face={face}
          throwKey={throwKey}
          fromColor={fromColor}
          reduceFx={reduceFx}
          slot={slot}
          slotCount={resolved.length}
          textures={textures}
        />
      ))}
    </group>
  );
}
