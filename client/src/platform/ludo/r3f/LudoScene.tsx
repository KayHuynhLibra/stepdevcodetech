import {
  useLayoutEffect,
  useMemo,
  useRef,
  type MutableRefObject,
  type RefObject,
} from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import {
  ACESFilmicToneMapping,
  Spherical,
  SRGBColorSpace,
  Vector3,
} from "three";
import type { LudoCosmetics } from "../../../hooks/useLudoCosmetics";
import { resolveBoardPlayerColors } from "../../../hooks/useLudoCosmetics";
import { BOARD_WORLD_SIZE, buildTokenStackMap, posToWorld, type LudoColor } from "../boardMap";
import type { LudoViewMode } from "../cosmeticsCatalog";
import type { LudoOrbitPose } from "../ludoOrbitLock";
import { registerOrbitNav, type LudoOrbitNavApi as BusNavApi } from "../ludoOrbitNavBus";
import type { LudoThemeId } from "../themes";
import {
  useAnimatedTokens,
  type LudoTokenView,
} from "../useAnimatedTokens";
import { computeFitCam } from "./fitBoardCamera";
import { LudoAtmosphere } from "./LudoAtmosphere";
import { LudoBoardMesh } from "./LudoBoardMesh";
import { LudoDice3D } from "./LudoDice3D";
import { LudoPawn } from "./LudoPawn";
import { themeMaterials } from "./themeMaterials";

export type { LudoTokenView };

/** Programmatic orbit nudges from the HTML D-pad. */
export type LudoOrbitNudge = {
  yaw?: number;
  pitch?: number;
  zoom?: number;
};

export type LudoOrbitNavApi = {
  nudge: (delta: LudoOrbitNudge) => LudoOrbitPose | null;
  capture: () => LudoOrbitPose | null;
};

type Props = {
  tokens: LudoTokenView[];
  validTokenIds: string[];
  onPick: (tokenId: string) => void;
  myColor?: string | null;
  themeId: LudoThemeId;
  cosmetics?: LudoCosmetics;
  viewMode?: LudoViewMode;
  /** color → pawnDecorId */
  pawnDecorByColor?: Record<string, string>;
  dice?: number | null;
  diceFaces?: number[] | null;
  diceThrowKey?: number;
  diceThrowColor?: string | null;
  /** Freeze free-orbit at a saved pose (user “khóa góc”). */
  orbitLocked?: boolean;
  orbitPose?: LudoOrbitPose | null;
  /** Filled by scene — parent calls to snapshot current cam for lock. */
  orbitCaptureRef?: MutableRefObject<(() => LudoOrbitPose | null) | null>;
  /** Filled by scene — D-pad yaw/pitch/zoom. */
  orbitNavRef?: MutableRefObject<LudoOrbitNavApi | null>;
  /** After nudge while locked — parent can persist new pose. */
  onOrbitPoseChange?: (pose: LudoOrbitPose) => void;
};

type ControlsApi = {
  target: {
    x: number;
    y: number;
    z: number;
    set: (x: number, y: number, z: number) => void;
  };
  minDistance: number;
  maxDistance: number;
  minPolarAngle: number;
  maxPolarAngle: number;
  enableRotate: boolean;
  update: () => void;
};

const BOARD_SHADOW_SCALE = BOARD_WORLD_SIZE * 1.55;

function ExposureRig({ themeId }: { themeId: LudoThemeId }) {
  const { gl } = useThree();
  useLayoutEffect(() => {
    const mats = themeMaterials(themeId);
    gl.toneMapping = ACESFilmicToneMapping;
    gl.toneMappingExposure = mats.exposure;
    gl.outputColorSpace = SRGBColorSpace;
    gl.setClearColor(mats.sky, 1);
  }, [gl, themeId]);
  return null;
}

function Lights({ themeId }: { themeId: LudoThemeId }) {
  const mats = themeMaterials(themeId);
  const mobile =
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 720px)").matches;
  const mapSize = mobile ? 1024 : 2048;
  return (
    <>
      <ambientLight intensity={mats.ambient} />
      <hemisphereLight
        args={[mats.sky, mats.woodDark, mats.hemiIntensity]}
      />
      <directionalLight
        castShadow
        intensity={mats.dirIntensity}
        position={[7, 16, 5]}
        color="#fff8f0"
        shadow-mapSize={[mapSize, mapSize]}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.00015}
        shadow-normalBias={0.04}
      />
      {/* Soft fill — lifts dark sides / pawns */}
      <directionalLight
        intensity={mats.dirIntensity * 0.35}
        position={[-6, 10, -4]}
        color="#e3f2fd"
      />
      <pointLight
        intensity={0.45}
        position={[0, 6, 0]}
        distance={28}
        decay={2}
        color="#fff3e0"
      />
    </>
  );
}

/** Keep frustum tight to board corners — no clipped edges at near angle. */
function FitBoardRig({
  viewMode,
  myColor,
  controlsRef,
  orbitLocked,
  orbitPose,
  orbitCaptureRef,
  orbitNavRef,
  onOrbitPoseChange,
}: {
  viewMode: LudoViewMode;
  myColor?: string | null;
  controlsRef: RefObject<ControlsApi | null>;
  orbitLocked?: boolean;
  orbitPose?: LudoOrbitPose | null;
  orbitCaptureRef?: MutableRefObject<(() => LudoOrbitPose | null) | null>;
  orbitNavRef?: MutableRefObject<LudoOrbitNavApi | null>;
  onOrbitPoseChange?: (pose: LudoOrbitPose) => void;
}) {
  const { camera, size } = useThree();
  const holdLocked = orbitLocked && viewMode === "orbit" && !!orbitPose;
  const onPoseChangeRef = useRef(onOrbitPoseChange);
  onPoseChangeRef.current = onOrbitPoseChange;
  const seedKey = `${viewMode}|${myColor ?? ""}|${size.width}x${size.height}`;
  const lastSeedKey = useRef("");
  const wasLocked = useRef(false);

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

    const ctrl = controlsRef.current;
    if (ctrl) {
      ctrl.minDistance = fit.minDist;
      ctrl.maxDistance = fit.maxDist;
      ctrl.minPolarAngle = fit.minPolar;
      ctrl.maxPolarAngle = fit.maxPolar;
      ctrl.enableRotate = fit.rotate && !holdLocked;
    }

    if (holdLocked && orbitPose) {
      const needSnap =
        !wasLocked.current || lastSeedKey.current !== seedKey;
      wasLocked.current = true;
      if (needSnap) {
        camera.position.set(...orbitPose.position);
        camera.lookAt(...orbitPose.target);
        if (ctrl) {
          ctrl.target.set(...orbitPose.target);
          ctrl.update();
        }
        lastSeedKey.current = seedKey;
      } else {
        ctrl?.update();
      }
      return;
    }

    wasLocked.current = false;
    if (lastSeedKey.current !== seedKey) {
      lastSeedKey.current = seedKey;
      camera.position.set(...fit.position);
      camera.lookAt(...fit.target);
      if (ctrl) {
        ctrl.target.set(...fit.target);
        ctrl.update();
      }
      return;
    }

    ctrl?.update();
  }, [
    camera,
    size.width,
    size.height,
    viewMode,
    myColor,
    controlsRef,
    holdLocked,
    seedKey,
    orbitPose,
  ]);

  useLayoutEffect(() => {
    const capture = (): LudoOrbitPose | null => {
      const ctrl = controlsRef.current;
      if (!ctrl) return null;
      return {
        position: [
          camera.position.x,
          camera.position.y,
          camera.position.z,
        ] as [number, number, number],
        target: [ctrl.target.x, ctrl.target.y, ctrl.target.z] as [
          number,
          number,
          number,
        ],
      };
    };

    if (orbitCaptureRef) {
      orbitCaptureRef.current = capture;
    }

    if (orbitNavRef) {
      const offset = new Vector3();
      const spherical = new Spherical();
      const navApi: BusNavApi = {
        capture,
        nudge: (delta) => {
          const ctrl = controlsRef.current;
          if (!ctrl) return null;
          const aspect = size.width / Math.max(size.height, 1);
          const fit = computeFitCam(viewMode, myColor, aspect);
          offset.set(
            camera.position.x - ctrl.target.x,
            camera.position.y - ctrl.target.y,
            camera.position.z - ctrl.target.z,
          );
          spherical.setFromVector3(offset);
          if (delta.yaw) spherical.theta += delta.yaw;
          if (delta.pitch) {
            spherical.phi = Math.min(
              fit.maxPolar,
              Math.max(fit.minPolar, spherical.phi + delta.pitch),
            );
          }
          if (delta.zoom) {
            spherical.radius = Math.min(
              fit.maxDist,
              Math.max(fit.minDist, spherical.radius * (1 + delta.zoom)),
            );
          }
          spherical.makeSafe();
          offset.setFromSpherical(spherical);
          camera.position.set(
            ctrl.target.x + offset.x,
            ctrl.target.y + offset.y,
            ctrl.target.z + offset.z,
          );
          camera.lookAt(ctrl.target.x, ctrl.target.y, ctrl.target.z);
          ctrl.update();
          const pose = capture();
          if (pose) onPoseChangeRef.current?.(pose);
          return pose;
        },
      };
      orbitNavRef.current = navApi;
      registerOrbitNav(navApi);
    }

    return () => {
      if (orbitCaptureRef) orbitCaptureRef.current = null;
      if (orbitNavRef) orbitNavRef.current = null;
      registerOrbitNav(null);
    };
  }, [
    camera,
    controlsRef,
    orbitCaptureRef,
    orbitNavRef,
    viewMode,
    myColor,
    size.width,
    size.height,
  ]);

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
  pawnDecorByColor,
  dice,
  diceFaces,
  diceThrowKey = 0,
  diceThrowColor,
  orbitLocked = false,
  orbitPose = null,
  orbitCaptureRef,
  orbitNavRef,
  onOrbitPoseChange,
}: Props & { viewMode: LudoViewMode }) {
  const mats = themeMaterials(themeId);
  const valid = new Set(validTokenIds);
  const animated = useAnimatedTokens(tokens, cosmetics?.reduceFx);
  const stackMap = useMemo(() => buildTokenStackMap(animated), [animated]);
  const colors = useMemo(
    () => resolveBoardPlayerColors(themeId, cosmetics),
    [themeId, cosmetics],
  );
  const controlsRef = useRef<ControlsApi | null>(null);
  const framed = viewMode === "screen" || viewMode === "cinema";
  const holdLocked = orbitLocked && viewMode === "orbit" && !!orbitPose;

  const seed = useMemo(
    () => computeFitCam(viewMode, myColor, 1),
    [viewMode, myColor],
  );

  return (
    <>
      <color attach="background" args={[mats.sky]} />
      <fog
        attach="fog"
        args={[mats.fog, framed ? 28 : 36, framed ? 62 : 78]}
      />
      <ExposureRig themeId={themeId} />
      <Lights themeId={themeId} />
      <LudoAtmosphere
        themeId={themeId}
        reduceFx={cosmetics?.reduceFx}
      />
      <LudoBoardMesh themeId={themeId} playerColors={colors} />
      {animated.map((t) => {
        const decorId = pawnDecorByColor?.[t.color] || "pawn-classic";
        return (
          <LudoPawn
            key={t.id}
            id={t.id}
            color={colors[t.color as LudoColor] ?? t.color}
            position={posToWorld(
              t.color,
              t.pos,
              t.index,
              t.pos === -1 ? 0.4 : undefined,
              stackMap.get(t.id),
            )}
            valid={valid.has(t.id) && !t.moving}
            mine={myColor === t.color}
            onPick={onPick}
            reduceFx={cosmetics?.reduceFx}
            decorId={decorId}
            hopTick={t.hopTick}
            moving={t.moving}
            inYard={t.pos === -1}
          />
        );
      })}
      <LudoDice3D
        dice={dice}
        faces={diceFaces}
        throwKey={diceThrowKey}
        fromColor={diceThrowColor}
        reduceFx={cosmetics?.reduceFx}
      />
      {viewMode === "cinema" ? (
        <ContactShadows
          position={[0, 0.02, 0]}
          opacity={0.28}
          scale={BOARD_SHADOW_SCALE}
          blur={2.4}
          far={14}
        />
      ) : null}
      <FitBoardRig
        viewMode={viewMode}
        myColor={myColor}
        controlsRef={controlsRef}
        orbitLocked={orbitLocked}
        orbitPose={orbitPose}
        orbitCaptureRef={orbitCaptureRef}
        orbitNavRef={orbitNavRef}
        onOrbitPoseChange={onOrbitPoseChange}
      />
      <OrbitControls
        ref={controlsRef as never}
        makeDefault
        enablePan={false}
        enableRotate={seed.rotate && !holdLocked}
        minDistance={seed.minDist}
        maxDistance={seed.maxDist}
        minPolarAngle={seed.minPolar}
        maxPolarAngle={seed.maxPolar}
        target={
          holdLocked && orbitPose ? orbitPose.target : seed.target
        }
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
  pawnDecorByColor,
  dice,
  diceFaces,
  diceThrowKey = 0,
  diceThrowColor,
  orbitLocked = false,
  orbitPose = null,
  orbitCaptureRef,
  orbitNavRef,
  onOrbitPoseChange,
}: Props) {
  const seed = useMemo(
    () => computeFitCam(viewMode, myColor, 1),
    [viewMode, myColor],
  );
  const holdLocked = orbitLocked && viewMode === "orbit" && !!orbitPose;
  const camPos =
    holdLocked && orbitPose ? orbitPose.position : seed.position;

  return (
    <Canvas
      key={`${viewMode}-${myColor ?? "none"}`}
      shadows
      dpr={[1, Math.min(1.75, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1)]}
      frameloop="always"
      camera={{
        position: camPos,
        fov: seed.fov,
        near: 0.15,
        far: 100,
      }}
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        alpha: false,
        stencil: false,
        depth: true,
        toneMapping: ACESFilmicToneMapping,
        outputColorSpace: SRGBColorSpace,
      }}
      onCreated={({ gl }) => {
        gl.shadowMap.enabled = true;
        gl.setClearColor("#1a1208", 1);
      }}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        touchAction: "none",
        display: "block",
      }}
    >
      <SceneInner
        tokens={tokens}
        validTokenIds={validTokenIds}
        onPick={onPick}
        myColor={myColor}
        themeId={themeId}
        cosmetics={cosmetics}
        viewMode={viewMode}
        pawnDecorByColor={pawnDecorByColor}
        dice={dice}
        diceFaces={diceFaces}
        diceThrowKey={diceThrowKey}
        diceThrowColor={diceThrowColor}
        orbitLocked={orbitLocked}
        orbitPose={orbitPose}
        orbitCaptureRef={orbitCaptureRef}
        orbitNavRef={orbitNavRef}
        onOrbitPoseChange={onOrbitPoseChange}
      />
    </Canvas>
  );
}
