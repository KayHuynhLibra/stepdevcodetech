import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import type { Group } from "three";
import type { LudoThemeId } from "../themes";
import { themeMaterials } from "./themeMaterials";

const FLOWER_RING = 18;
const PETAL_COUNT = 28;

function Flower({
  x,
  z,
  scale,
  petal,
  center,
}: {
  x: number;
  z: number;
  scale: number;
  petal: string;
  center: string;
}) {
  return (
    <group position={[x, 0.02, z]} scale={scale}>
      <mesh position={[0, 0.18, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.04, 0.36, 6]} />
        <meshStandardMaterial color="#4caf50" roughness={0.8} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.12, 0.38, Math.sin(a) * 0.12]}
            castShadow
          >
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial color={petal} roughness={0.55} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.4, 0]} castShadow>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial color={center} roughness={0.45} emissive={center} emissiveIntensity={0.15} />
      </mesh>
    </group>
  );
}

function FloatingPetals({
  colors,
  reduceFx,
}: {
  colors: string[];
  reduceFx?: boolean;
}) {
  const group = useRef<Group>(null);
  const seeds = useMemo(
    () =>
      Array.from({ length: PETAL_COUNT }, (_, i) => ({
        x: (Math.sin(i * 2.1) * 0.5 + 0.5) * 22 - 11,
        y: 1.2 + (i % 7) * 0.35,
        z: (Math.cos(i * 1.7) * 0.5 + 0.5) * 22 - 11,
        s: 0.06 + (i % 4) * 0.02,
        speed: 0.25 + (i % 5) * 0.08,
        phase: i * 0.7,
        color: colors[i % colors.length]!,
      })),
    [colors],
  );

  useFrame(({ clock }) => {
    if (reduceFx || !group.current) return;
    const t = clock.getElapsedTime();
    group.current.children.forEach((child, i) => {
      const s = seeds[i]!;
      child.position.y = s.y + Math.sin(t * s.speed + s.phase) * 0.35;
      child.position.x = s.x + Math.cos(t * s.speed * 0.6 + s.phase) * 0.4;
      child.rotation.y = t * s.speed;
      child.rotation.z = Math.sin(t * s.speed + s.phase) * 0.6;
    });
  });

  return (
    <group ref={group}>
      {seeds.map((s, i) => (
        <mesh key={i} position={[s.x, s.y, s.z]} scale={s.s}>
          <sphereGeometry args={[1, 6, 6]} />
          <meshStandardMaterial
            color={s.color}
            roughness={0.5}
            transparent
            opacity={0.85}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Garden / patterned backdrop around the Ludo table. */
export function LudoAtmosphere({
  themeId,
  reduceFx,
}: {
  themeId: LudoThemeId;
  reduceFx?: boolean;
}) {
  const mats = themeMaterials(themeId);
  const flowers = useMemo(() => {
    const petalSets =
      themeId === "arena"
        ? ["#ff6b1a", "#ffd27a", "#c45aff", "#5b8cff"]
        : themeId === "soccer"
          ? ["#fff", "#ffeb3b", "#e53935", "#42a5f5"]
          : ["#ff8a80", "#ffd54f", "#ce93d8", "#81d4fa", "#f8bbd0"];
    const center = themeId === "arena" ? "#ffeb99" : "#fff59d";
    return Array.from({ length: FLOWER_RING }, (_, i) => {
      const a = (i / FLOWER_RING) * Math.PI * 2;
      const r = 10.2 + (i % 3) * 0.55;
      return {
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        scale: 0.75 + (i % 4) * 0.12,
        petal: petalSets[i % petalSets.length]!,
        center,
      };
    });
  }, [themeId]);

  const petalColors =
    themeId === "arena"
      ? ["#ff8a65", "#ffd54f", "#b39ddb"]
      : ["#ffcdd2", "#fff9c4", "#e1bee7", "#bbdefb"];

  return (
    <group>
      {/* Soft ground lawn / patterned floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]} receiveShadow>
        <circleGeometry args={[16, 64]} />
        <meshStandardMaterial color={mats.ground} roughness={0.92} metalness={0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <ringGeometry args={[9.2, 15.5, 64]} />
        <meshStandardMaterial
          color={mats.groundRing}
          roughness={0.9}
          metalness={0.02}
        />
      </mesh>

      {/* Decorative ring pattern under table */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
        <ringGeometry args={[8.4, 8.75, 48]} />
        <meshStandardMaterial
          color={mats.accent}
          roughness={0.6}
          emissive={mats.accent}
          emissiveIntensity={0.12}
        />
      </mesh>

      {flowers.map((f, i) => (
        <Flower key={i} {...f} />
      ))}

      {!reduceFx ? (
        <>
          <FloatingPetals colors={petalColors} reduceFx={reduceFx} />
          <Sparkles
            count={themeId === "arena" ? 48 : 36}
            scale={[22, 6, 22]}
            position={[0, 2.5, 0]}
            size={themeId === "arena" ? 3.2 : 2.4}
            speed={0.35}
            opacity={0.55}
            color={mats.sparkle}
          />
        </>
      ) : null}
    </group>
  );
}
