import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { LudoCosmetics } from "../../../hooks/useLudoCosmetics";
import { PLAYER_COLORS, posToWorld, type LudoColor } from "../boardMap";
import type { LudoThemeId } from "../themes";
import { LudoBoardMesh } from "./LudoBoardMesh";
import { LudoPawn } from "./LudoPawn";
import { themeMaterials } from "./themeMaterials";

export type LudoTokenView = {
  id: string;
  color: string;
  index: number;
  pos: number;
};

type Props = {
  tokens: LudoTokenView[];
  validTokenIds: string[];
  onPick: (tokenId: string) => void;
  myColor?: string | null;
  themeId: LudoThemeId;
  cosmetics?: LudoCosmetics;
};

function Lights({ themeId }: { themeId: LudoThemeId }) {
  const mats = themeMaterials(themeId);
  const mobile =
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 720px)").matches;
  const mapSize = mobile ? 1024 : 2048;
  return (
    <>
      <ambientLight intensity={mats.ambient} />
      <directionalLight
        castShadow
        intensity={mats.dirIntensity}
        position={[8, 14, 6]}
        shadow-mapSize={[mapSize, mapSize]}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0002}
      />
      {!mobile ? (
        <hemisphereLight args={["#e3f2fd", "#5d4037", 0.22]} />
      ) : null}
    </>
  );
}

export function LudoScene({
  tokens,
  validTokenIds,
  onPick,
  myColor,
  themeId,
  cosmetics,
}: Props) {
  const mats = themeMaterials(themeId);
  const valid = new Set(validTokenIds);

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [0, 16, 14], fov: 42, near: 0.1, far: 120 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      style={{ width: "100%", height: "100%", touchAction: "none" }}
    >
      <color attach="background" args={[mats.fog]} />
      <fog attach="fog" args={[mats.fog, 28, 55]} />
      <Lights themeId={themeId} />
      <LudoBoardMesh themeId={themeId} boardUrl={cosmetics?.boardUrl} />
      {tokens.map((t) => (
        <LudoPawn
          key={t.id}
          id={t.id}
          color={PLAYER_COLORS[t.color as LudoColor] ?? t.color}
          position={posToWorld(t.color, t.pos, t.index)}
          valid={valid.has(t.id)}
          mine={myColor === t.color}
          onPick={onPick}
          imageUrl={
            cosmetics?.pawnUrls?.[t.color as keyof typeof cosmetics.pawnUrls]
          }
          reduceFx={cosmetics?.reduceFx}
        />
      ))}
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={10}
        maxDistance={28}
        maxPolarAngle={Math.PI / 2.15}
        minPolarAngle={0.35}
        target={[0, 0, 0]}
      />
    </Canvas>
  );
}
