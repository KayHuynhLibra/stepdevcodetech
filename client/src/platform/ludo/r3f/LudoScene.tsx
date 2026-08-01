import { useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import type { LudoCosmetics } from "../../../hooks/useLudoCosmetics";
import {
  resolveBoardModelUrl,
  resolvePawnModelUrl,
  resolvePlayerColors,
} from "../../../hooks/useLudoCosmetics";
import { BOARD_WORLD_SIZE, posToWorld, type LudoColor } from "../boardMap";
import type { LudoViewMode } from "../cosmeticsCatalog";
import type { LudoThemeId } from "../themes";
import { computeFitCam } from "./fitBoardCamera";
import { LudoAtmosphere } from "./LudoAtmosphere";
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
  viewMode?: LudoViewMode;
};

type ControlsApi = {
  target: { set: (x: number, y: number, z: number) => void };
  minDistance: number;
  maxDistance: number;
  minPolarAngle: number;
  maxPolarAngle: number;
  enableRotate: boolean;
  update: () => void;
};

const BOARD_SHADOW_SCALE = BOARD_WORLD_SIZE * 1.55;

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

/** Keep frustum tight to board corners — no clipped edges at near angle. */
function FitBoardRig({
  viewMode,
  myColor,
  controlsRef,
}: {
  viewMode: LudoViewMode;
  myColor?: string | null;
  controlsRef: RefObject<ControlsApi | null>;
}) {
  const { camera, size } = useThree();

  useLayoutEffect(() => {
    const aspect = size.width / Math.max(size.height, 1);
    const fit = computeFitCam(viewMode, myColor, aspect);
    const persp = camera as typeof camera & {
      fov?: number;
      updateProjectionMatrix?: () => void;
    };
    if (typeof persp.fov === "number" && persp.updateProjectionMatrix) {
      persp.fov = fit.fov;
      persp.updateProjectionMatrix();
    }
    camera.position.set(...fit.position);
    camera.lookAt(...fit.target);

    const ctrl = controlsRef.current;
    if (ctrl) {
      ctrl.target.set(...fit.target);
      ctrl.minDistance = fit.minDist;
      ctrl.maxDistance = fit.maxDist;
      ctrl.minPolarAngle = fit.minPolar;
      ctrl.maxPolarAngle = fit.maxPolar;
      ctrl.enableRotate = fit.rotate;
      ctrl.update();
    }
  }, [camera, size.width, size.height, viewMode, myColor, controlsRef]);

  return null;
}

function SceneInner({
  tokens,
  validTokenIds,
  onPick,
  myColor,
  themeId,
  cosmetics,
  viewMode,
}: Props & { viewMode: LudoViewMode }) {
  const mats = themeMaterials(themeId);
  const valid = new Set(validTokenIds);
  const colors = useMemo(
    () => resolvePlayerColors(cosmetics),
    [cosmetics],
  );
  const pawnModel = resolvePawnModelUrl(cosmetics);
  const boardModel = resolveBoardModelUrl(cosmetics);
  const controlsRef = useRef<ControlsApi | null>(null);
  const framed = viewMode === "screen" || viewMode === "cinema";

  const seed = useMemo(
    () => computeFitCam(viewMode, myColor, 1),
    [viewMode, myColor],
  );

  return (
    <>
      <color attach="background" args={[mats.sky]} />
      <fog
        attach="fog"
        args={[mats.fog, framed ? 20 : 26, framed ? 44 : 56]}
      />
      <Lights themeId={themeId} />
      <LudoAtmosphere
        themeId={themeId}
        reduceFx={cosmetics?.reduceFx}
      />
      <LudoBoardMesh
        themeId={themeId}
        boardUrl={cosmetics?.boardUrl}
        boardModelUrl={boardModel}
        playerColors={colors}
      />
      {tokens.map((t) => (
        <LudoPawn
          key={t.id}
          id={t.id}
          color={colors[t.color as LudoColor] ?? t.color}
          position={posToWorld(t.color, t.pos, t.index)}
          valid={valid.has(t.id)}
          mine={myColor === t.color}
          onPick={onPick}
          imageUrl={
            cosmetics?.pawnUrls?.[t.color as keyof typeof cosmetics.pawnUrls]
          }
          modelUrl={pawnModel}
          reduceFx={cosmetics?.reduceFx}
        />
      ))}
      {viewMode === "cinema" ? (
        <ContactShadows
          position={[0, 0.02, 0]}
          opacity={0.4}
          scale={BOARD_SHADOW_SCALE}
          blur={2.2}
          far={14}
        />
      ) : null}
      <FitBoardRig
        viewMode={viewMode}
        myColor={myColor}
        controlsRef={controlsRef}
      />
      <OrbitControls
        ref={controlsRef as never}
        makeDefault
        enablePan={false}
        enableRotate={seed.rotate}
        minDistance={seed.minDist}
        maxDistance={seed.maxDist}
        minPolarAngle={seed.minPolar}
        maxPolarAngle={seed.maxPolar}
        target={seed.target}
      />
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
  viewMode = "orbit",
}: Props) {
  const seed = useMemo(
    () => computeFitCam(viewMode, myColor, 1),
    [viewMode, myColor],
  );

  return (
    <Canvas
      key={`${viewMode}-${myColor ?? "none"}`}
      shadows
      dpr={[1, 1.5]}
      camera={{
        position: seed.position,
        fov: seed.fov,
        near: 0.1,
        far: 120,
      }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      style={{ width: "100%", height: "100%", touchAction: "none" }}
    >
      <SceneInner
        tokens={tokens}
        validTokenIds={validTokenIds}
        onPick={onPick}
        myColor={myColor}
        themeId={themeId}
        cosmetics={cosmetics}
        viewMode={viewMode}
      />
    </Canvas>
  );
}
