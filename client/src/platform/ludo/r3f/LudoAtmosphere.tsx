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

function GardenTree({ x, z, scale }: { x: number; z: number; scale: number }) {
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.18, 1.1, 6]} />
        <meshStandardMaterial color="#6d4c41" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.35, 0]} castShadow>
        <sphereGeometry args={[0.72, 10, 10]} />
        <meshStandardMaterial color="#43a047" roughness={0.75} />
      </mesh>
      <mesh position={[0.35, 1.55, 0.2]} castShadow>
        <sphereGeometry args={[0.42, 8, 8]} />
        <meshStandardMaterial color="#66bb6a" roughness={0.7} />
      </mesh>
    </group>
  );
}

function NeonPillar({
  x,
  z,
  color,
}: {
  x: number;
  z: number;
  color: string;
}) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <boxGeometry args={[0.28, 2.2, 0.28]} />
        <meshStandardMaterial
          color="#1a1030"
          emissive={color}
          emissiveIntensity={0.55}
          metalness={0.4}
          roughness={0.35}
        />
      </mesh>
      <mesh position={[0, 2.35, 0]}>
        <sphereGeometry args={[0.18, 10, 10]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.2}
          roughness={0.2}
        />
      </mesh>
    </group>
  );
}

function FrostCrystal({
  x,
  z,
  scale,
}: {
  x: number;
  z: number;
  scale: number;
}) {
  return (
    <group position={[x, 0.05, z]} scale={scale} rotation={[0, x * 0.4, 0.15]}>
      <mesh position={[0, 0.7, 0]} castShadow>
        <octahedronGeometry args={[0.45, 0]} />
        <meshStandardMaterial
          color="#e1f5fe"
          emissive="#81d4fa"
          emissiveIntensity={0.35}
          metalness={0.55}
          roughness={0.2}
          transparent
          opacity={0.88}
        />
      </mesh>
      <mesh position={[0.22, 0.35, 0.1]} rotation={[0.3, 0.5, 0.2]}>
        <octahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial
          color="#b3e5fc"
          emissive="#4fc3f7"
          emissiveIntensity={0.25}
          metalness={0.5}
          roughness={0.25}
          transparent
          opacity={0.8}
        />
      </mesh>
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
          : themeId === "garden"
            ? ["#81c784", "#fff176", "#ff8a65", "#4db6ac"]
            : themeId === "neon"
              ? ["#e040fb", "#00e5ff", "#ffea00", "#7c4dff"]
              : themeId === "frost"
                ? ["#e3f2fd", "#90caf9", "#ffffff", "#b3e5fc"]
                : ["#ff8a80", "#ffd54f", "#ce93d8", "#81d4fa", "#f8bbd0"];
    const center =
      themeId === "arena"
        ? "#ffeb99"
        : themeId === "neon"
          ? "#00e5ff"
          : themeId === "frost"
            ? "#e1f5fe"
            : "#fff59d";
    const count = themeId === "garden" ? FLOWER_RING : Math.min(FLOWER_RING, 14);
    return Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2;
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

  const envProps = useMemo(() => {
    if (themeId === "garden") {
      return Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + 0.2;
        const r = 12.2 + (i % 2) * 0.8;
        return { kind: "tree" as const, x: Math.cos(a) * r, z: Math.sin(a) * r, scale: 0.85 + (i % 3) * 0.15 };
      });
    }
    if (themeId === "neon") {
      const colors = ["#e040fb", "#00e5ff", "#ffea00", "#7c4dff"];
      return Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        const r = 11.6;
        return {
          kind: "neon" as const,
          x: Math.cos(a) * r,
          z: Math.sin(a) * r,
          color: colors[i % colors.length]!,
        };
      });
    }
    if (themeId === "frost") {
      return Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2 + 0.15;
        const r = 11.4 + (i % 3) * 0.55;
        return {
          kind: "crystal" as const,
          x: Math.cos(a) * r,
          z: Math.sin(a) * r,
          scale: 0.7 + (i % 4) * 0.18,
        };
      });
    }
    return [] as const;
  }, [themeId]);

  const petalColors =
    themeId === "arena"
      ? ["#ff8a65", "#ffd54f", "#b39ddb"]
      : themeId === "garden"
        ? ["#c5e1a5", "#fff59d", "#ffcc80"]
        : themeId === "neon"
          ? ["#e040fb", "#00e5ff", "#ffea00"]
          : themeId === "frost"
            ? ["#e3f2fd", "#ffffff", "#90caf9"]
            : ["#ffcdd2", "#fff9c4", "#e1bee7", "#bbdefb"];

  const sparkleCount =
    themeId === "arena" || themeId === "neon"
      ? 28
      : themeId === "frost"
        ? 32
        : 20;

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
          emissiveIntensity={themeId === "neon" ? 0.35 : 0.12}
        />
      </mesh>

      {flowers.map((f, i) => (
        <Flower key={i} {...f} />
      ))}

      {envProps.map((p, i) => {
        if (p.kind === "tree") {
          return <GardenTree key={`t${i}`} x={p.x} z={p.z} scale={p.scale} />;
        }
        if (p.kind === "neon") {
          return <NeonPillar key={`n${i}`} x={p.x} z={p.z} color={p.color} />;
        }
        if (p.kind === "crystal") {
          return <FrostCrystal key={`c${i}`} x={p.x} z={p.z} scale={p.scale} />;
        }
        return null;
      })}

      {!reduceFx ? (
        <>
          <FloatingPetals colors={petalColors} reduceFx={reduceFx} />
          <Sparkles
            count={sparkleCount}
            scale={[22, 6, 22]}
            position={[0, 2.5, 0]}
            size={themeId === "arena" || themeId === "neon" ? 3.2 : 2.4}
            speed={themeId === "frost" ? 0.22 : 0.35}
            opacity={themeId === "frost" ? 0.7 : 0.55}
            color={mats.sparkle}
          />
        </>
      ) : null}
    </group>
  );
}
