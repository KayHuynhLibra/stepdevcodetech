import { Suspense, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, useCursor, useTexture } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import type { Group } from "three";
import { SRGBColorSpace } from "three";
import type { WorldPos } from "../boardMap";
import {
  pawnDecor3dStyle,
  pawnDecorGlyph,
} from "../pawnDecorVisual";
import { LudoGltfModel } from "./LudoGltfModel";

type Props = {
  id: string;
  color: string;
  position: WorldPos;
  valid: boolean;
  mine: boolean;
  onPick: (id: string) => void;
  imageUrl?: string;
  modelUrl?: string | null;
  reduceFx?: boolean;
  decorId?: string | null;
  hopTick?: number;
  moving?: boolean;
  /** In home yard — slightly larger piece, open floor (no pad rings). */
  inYard?: boolean;
};

function PawnSprite({ url }: { url: string }) {
  const tex = useTexture(url);
  tex.colorSpace = SRGBColorSpace;
  return (
    <Billboard follow position={[0, 0.85, 0]}>
      <mesh castShadow>
        <planeGeometry args={[0.95, 1.25]} />
        <meshStandardMaterial
          map={tex}
          transparent
          depthWrite={false}
          roughness={0.55}
          metalness={0}
        />
      </mesh>
    </Billboard>
  );
}

function ProceduralPawn({
  color,
  valid,
  mine,
  decorId,
}: {
  color: string;
  valid: boolean;
  mine: boolean;
  decorId?: string | null;
}) {
  const style = pawnDecor3dStyle(decorId);
  const glyph = pawnDecorGlyph(decorId);
  const em =
    decorId === "pawn-bolt"
      ? "#ffeb3b"
      : decorId === "pawn-gem"
        ? "#80deea"
        : color;
  return (
    <group scale={style.scale * 1.22}>
      {/* Wide foot so piece sits on pad / tile */}
      <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.34, 0.4, 0.16, 20]} />
        <meshStandardMaterial
          color={color}
          roughness={style.roughness}
          metalness={style.metalness}
          emissive={valid ? color : em}
          emissiveIntensity={
            valid
              ? 0.35
              : mine
                ? 0.08 + style.emissiveIntensity * 0.3
                : style.emissiveIntensity
          }
        />
      </mesh>
      <mesh position={[0, 0.28, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.28, 0.28, 14]} />
        <meshStandardMaterial
          color={color}
          roughness={style.roughness}
          metalness={style.metalness}
        />
      </mesh>
      <mesh position={[0, 0.58, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.16, 0.42, 12]} />
        <meshStandardMaterial
          color={color}
          roughness={style.roughness}
          metalness={style.metalness}
        />
      </mesh>
      <mesh position={[0, 0.92, 0]} castShadow>
        {decorId === "pawn-gem" ? (
          <octahedronGeometry args={[0.28, 0]} />
        ) : (
          <sphereGeometry args={[0.26, 22, 18]} />
        )}
        <meshStandardMaterial
          color={decorId === "pawn-gem" ? "#e0f7fa" : color}
          roughness={style.roughness}
          metalness={Math.max(
            style.metalness,
            decorId === "pawn-gem" ? 0.9 : 0,
          )}
          emissive={em}
          emissiveIntensity={style.emissiveIntensity}
        />
      </mesh>
      {glyph && decorId !== "pawn-crown" ? (
        <Billboard follow position={[0, 1.32, 0]}>
          <mesh>
            <circleGeometry args={[0.18, 16]} />
            <meshBasicMaterial color="#fff8e1" />
          </mesh>
        </Billboard>
      ) : null}
      {decorId === "pawn-crown" ? (
        <mesh position={[0, 1.22, 0]} castShadow>
          <coneGeometry args={[0.16, 0.26, 5]} />
          <meshStandardMaterial
            color="#ffd54f"
            metalness={0.7}
            roughness={0.25}
          />
        </mesh>
      ) : null}
      {decorId === "pawn-bolt" ? (
        <mesh position={[0.2, 0.95, 0.12]} rotation={[0, 0, -0.4]}>
          <boxGeometry args={[0.07, 0.36, 0.07]} />
          <meshStandardMaterial
            color="#ffeb3b"
            emissive="#ffeb3b"
            emissiveIntensity={0.8}
          />
        </mesh>
      ) : null}
    </group>
  );
}

export function LudoPawn({
  id,
  color,
  position,
  valid,
  mine,
  onPick,
  imageUrl,
  modelUrl,
  reduceFx,
  decorId,
  hopTick = 0,
  moving = false,
  inYard = false,
}: Props) {
  const group = useRef<Group>(null);
  const mesh = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const hopRef = useRef(0);
  const hopPhase = useRef(0);
  const prevHopTick = useRef(hopTick);
  const prevTarget = useRef(position);
  const bobT = useRef(Math.random() * Math.PI * 2);
  useCursor(hovered && valid);

  useEffect(() => {
    if (reduceFx) return;
    if (hopTick > 0 && hopTick !== prevHopTick.current) {
      hopRef.current = 1;
      hopPhase.current = 0;
    }
    prevHopTick.current = hopTick;
  }, [hopTick, reduceFx]);

  useEffect(() => {
    const [px, , pz] = prevTarget.current;
    const [tx, , tz] = position;
    if (
      !reduceFx &&
      hopTick === prevHopTick.current &&
      (Math.abs(px - tx) > 0.01 || Math.abs(pz - tz) > 0.01)
    ) {
      hopRef.current = 1;
      hopPhase.current = 0;
    }
    prevTarget.current = position;
  }, [position, reduceFx, hopTick]);

  useFrame((_, dt) => {
    const g = group.current;
    const m = mesh.current;
    if (!g) return;
    const [tx, ty, tz] = position;
    const k = 1 - Math.exp(-(moving ? 18 : 12) * dt);
    g.position.x += (tx - g.position.x) * k;
    g.position.z += (tz - g.position.z) * k;

    let hopY = 0;
    let squashY = 1;
    let squashXZ = 1;
    let wobble = 0;

    if (hopRef.current > 0 && !reduceFx) {
      hopPhase.current = Math.min(1, hopPhase.current + dt * 3.2);
      const p = hopPhase.current;
      /* Arc + landing squash */
      hopY = Math.sin(p * Math.PI) * (moving ? 0.55 : 0.38);
      if (p < 0.2) {
        const s = p / 0.2;
        squashY = 1 - 0.18 * (1 - s);
        squashXZ = 1 + 0.16 * (1 - s);
      } else if (p < 0.55) {
        const s = (p - 0.2) / 0.35;
        squashY = 0.82 + 0.28 * s;
        squashXZ = 1.16 - 0.26 * s;
      } else {
        const s = (p - 0.55) / 0.45;
        const land = Math.sin(s * Math.PI);
        squashY = 1 - 0.14 * land;
        squashXZ = 1 + 0.12 * land;
        hopY *= 1 - 0.25 * s;
      }
      wobble = Math.sin(p * Math.PI * 2) * 0.18;
      if (p >= 1) hopRef.current = 0;
    } else {
      g.position.y += (ty - g.position.y) * k;
    }

    if (hopRef.current > 0) {
      g.position.y = ty + hopY;
    }

    bobT.current += dt * (valid ? 3.2 : 1.6);
    const idle =
      !reduceFx && valid && hopRef.current <= 0
        ? Math.sin(bobT.current) * 0.045
        : !reduceFx && hopRef.current <= 0 && mine
          ? Math.sin(bobT.current * 0.7) * 0.02
          : 0;
    if (hopRef.current <= 0) {
      g.position.y = ty + idle;
    }

    const hoverScale = hovered && valid ? 1.12 : valid ? 1.06 : 1;
    const sx = hoverScale * squashXZ;
    const sy = hoverScale * squashY;
    if (m) {
      m.scale.x += (sx - m.scale.x) * (1 - Math.exp(-16 * dt));
      m.scale.y += (sy - m.scale.y) * (1 - Math.exp(-16 * dt));
      m.scale.z += (sx - m.scale.z) * (1 - Math.exp(-16 * dt));
      m.rotation.z += (wobble - m.rotation.z) * (1 - Math.exp(-14 * dt));
      m.rotation.y += dt * (moving ? 2.8 : valid ? 0.35 : 0);
    } else {
      g.scale.setScalar(hoverScale);
    }
  });

  const onPointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
  };
  const onPointerOut = () => setHovered(false);
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (valid) onPick(id);
  };

  const art = (imageUrl || "").trim();
  const model = (modelUrl || "").trim();

  return (
    <group
      ref={group}
      position={position}
      scale={inYard ? 1.22 : 1}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      onClick={onClick}
    >
      <group ref={mesh}>
        {art ? (
          <Suspense fallback={
            <ProceduralPawn
              color={color}
              valid={valid}
              mine={mine}
              decorId={decorId}
            />
          }>
            <PawnSprite url={art} />
          </Suspense>
        ) : model ? (
          <Suspense
            fallback={
              <ProceduralPawn
                color={color}
                valid={valid}
                mine={mine}
                decorId={decorId}
              />
            }
          >
            <LudoGltfModel
              url={model}
              tint={color}
              scale={0.78}
              position={[0, 0, 0]}
            />
          </Suspense>
        ) : (
          <ProceduralPawn
            color={color}
            valid={valid}
            mine={mine}
            decorId={decorId}
          />
        )}
      </group>
    </group>
  );
}
