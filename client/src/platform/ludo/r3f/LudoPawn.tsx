import { Suspense, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useCursor, useTexture } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import type { Group } from "three";
import { SRGBColorSpace } from "three";
import type { WorldPos } from "../boardMap";

type Props = {
  id: string;
  color: string;
  position: WorldPos;
  valid: boolean;
  mine: boolean;
  onPick: (id: string) => void;
  imageUrl?: string;
  reduceFx?: boolean;
};

function PawnSprite({ url }: { url: string }) {
  const tex = useTexture(url);
  tex.colorSpace = SRGBColorSpace;
  return (
    <mesh position={[0, 0.45, 0]} castShadow>
      <planeGeometry args={[0.55, 0.7]} />
      <meshStandardMaterial map={tex} transparent roughness={0.5} />
    </mesh>
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
  reduceFx,
}: Props) {
  const group = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const hopRef = useRef(0);
  const prevTarget = useRef(position);
  useCursor(hovered && valid);

  useEffect(() => {
    const [px, , pz] = prevTarget.current;
    const [tx, , tz] = position;
    if (
      !reduceFx &&
      (Math.abs(px - tx) > 0.01 || Math.abs(pz - tz) > 0.01)
    ) {
      hopRef.current = 1;
    }
    prevTarget.current = position;
  }, [position, reduceFx]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const [tx, ty, tz] = position;
    const k = 1 - Math.exp(-12 * dt);
    g.position.x += (tx - g.position.x) * k;
    g.position.z += (tz - g.position.z) * k;
    if (hopRef.current > 0) {
      hopRef.current = Math.max(0, hopRef.current - dt * 2.4);
      const hop = Math.sin(hopRef.current * Math.PI) * 0.35;
      g.position.y = ty + hop;
    } else {
      g.position.y += (ty - g.position.y) * k;
    }
    const target = hovered && valid ? 1.1 : valid ? 1.05 : 1;
    const s = g.scale.x + (target - g.scale.x) * k;
    g.scale.setScalar(s);
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

  return (
    <group
      ref={group}
      position={position}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      onClick={onClick}
    >
      {art ? (
        <Suspense fallback={null}>
          <PawnSprite url={art} />
        </Suspense>
      ) : (
        <>
          <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.22, 0.28, 0.24, 16]} />
            <meshStandardMaterial
              color={color}
              roughness={0.45}
              metalness={0.15}
              emissive={valid ? color : "#000000"}
              emissiveIntensity={valid ? 0.35 : mine ? 0.08 : 0}
            />
          </mesh>
          <mesh position={[0, 0.32, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.18, 0.22, 12]} />
            <meshStandardMaterial color={color} roughness={0.45} metalness={0.15} />
          </mesh>
          <mesh position={[0, 0.52, 0]} castShadow>
            <sphereGeometry args={[0.18, 20, 16]} />
            <meshStandardMaterial color={color} roughness={0.35} metalness={0.2} />
          </mesh>
        </>
      )}
    </group>
  );
}
