import { useMemo } from "react";
import { BufferAttribute, BufferGeometry, DoubleSide } from "three";
import {
  BASE_CR,
  BASE_PLATFORMS,
  CELL,
  GRID,
  PLAYER_COLORS,
  SUIT_MARKS,
  TRACK_TILE_GAP,
  TRACK_TILE_HEIGHT,
  gridToWorld,
  homeColumnColor,
  isBoardTile,
  startTileColor,
  type LudoColor,
} from "../boardMap";
import type { LudoPlayerColors } from "../cosmeticsCatalog";
import type { LudoThemeId } from "../themes";
import { themeMaterials, type BoardThemeMats } from "./themeMaterials";

const TILE_H = TRACK_TILE_HEIGHT;
const TILE_Y = 0.1;
const TILE_GAP = TRACK_TILE_GAP;

function SuitMark({
  col,
  row,
  color,
}: {
  col: number;
  row: number;
  color: string;
}) {
  const [x, , z] = gridToWorld(col, row, TILE_Y + TILE_H / 2 + 0.05);
  return (
    <mesh position={[x, TILE_Y + TILE_H / 2 + 0.05, z]} castShadow>
      <cylinderGeometry args={[0.14, 0.16, 0.06, 10]} />
      <meshStandardMaterial
        color={color}
        roughness={0.35}
        metalness={0.15}
        emissive={color}
        emissiveIntensity={0.12}
      />
    </mesh>
  );
}

function TrackTile({
  col,
  row,
  mats,
  colors,
  themeId,
}: {
  col: number;
  row: number;
  mats: BoardThemeMats;
  colors: LudoPlayerColors;
  themeId: LudoThemeId;
}) {
  const [x, , z] = gridToWorld(col, row, TILE_Y);
  const start = startTileColor(col, row);
  const home = homeColumnColor(col, row);
  const accent = start || home;
  const checker = (col + row) % 2 === 0;
  const base =
    accent
      ? colors[accent]
      : checker
        ? mats.track
        : mats.trackAlt;
  const size = CELL * (1 - TILE_GAP);
  const h = accent ? TILE_H * 1.2 : TILE_H;
  const lift =
    themeId === "garden"
      ? checker
        ? 0.012
        : 0
      : themeId === "frost"
        ? accent
          ? 0.02
          : 0.008
        : 0;
  const emit =
    themeId === "neon"
      ? accent
        ? 0.55
        : mats.tileEmit
      : themeId === "frost" && accent
        ? 0.25
        : accent && themeId === "arena"
          ? 0.18
          : mats.tileEmit;

  return (
    <group position={[x, TILE_Y + lift, z]}>
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[size, h, size]} />
        <meshStandardMaterial
          color={base}
          roughness={mats.tileRough}
          metalness={mats.tileMetal}
          emissive={accent ? base : mats.tileEmissive}
          emissiveIntensity={emit}
        />
      </mesh>
      {/* Bevel lip — 3D slab edge */}
      <mesh position={[0, h / 2 + 0.012, 0]} receiveShadow>
        <boxGeometry args={[size * 0.92, 0.024, size * 0.92]} />
        <meshStandardMaterial
          color={accent ? base : mats.accent}
          roughness={Math.max(0.2, mats.tileRough - 0.15)}
          metalness={Math.min(0.85, mats.tileMetal + 0.15)}
          emissive={themeId === "neon" ? mats.rim : mats.tileEmissive}
          emissiveIntensity={themeId === "neon" ? 0.45 : themeId === "frost" ? 0.15 : 0}
        />
      </mesh>
    </group>
  );
}

function BasePlatform({
  color,
  colors,
  mats,
  themeId,
}: {
  color: LudoColor;
  colors: LudoPlayerColors;
  mats: BoardThemeMats;
  themeId: LudoThemeId;
}) {
  const b = BASE_PLATFORMS[color];
  const [x, , z] = gridToWorld(b.col0 + 2.5, b.row0 + 2.5, 0);
  const w = 6 * CELL * 0.98;
  const h = 0.2;
  const hex = colors[color];
  /** Match `posToWorld` yard slots (`BASE_CR`) — same centers as pawns. */
  const padSize = 0.92;
  const padY = h + 0.1;
  const padSlots = BASE_CR[color];

  return (
    <group>
      {/* Outer yard block — seat color */}
      <mesh position={[x, h / 2, z]} castShadow receiveShadow>
        <boxGeometry args={[w, h, w]} />
        <meshStandardMaterial
          color={hex}
          roughness={mats.tileRough}
          metalness={mats.tileMetal}
          emissive={themeId === "neon" ? hex : "#000000"}
          emissiveIntensity={themeId === "neon" ? 0.28 : 0}
        />
      </mesh>
      {/* Inner floor slab */}
      <mesh position={[x, h + 0.03, z]} receiveShadow castShadow>
        <boxGeometry args={[w * 0.78, 0.06, w * 0.78]} />
        <meshStandardMaterial
          color={mats.yardFloor}
          roughness={mats.tileRough + 0.1}
          metalness={mats.tileMetal * 0.5}
        />
      </mesh>
      {/* Yard pads under each token — layered pedestal aligned to BASE_CR */}
      {padSlots.map(([col, row], i) => {
        const [px, , pz] = gridToWorld(col, row, 0);
        return (
          <group key={i} position={[px, padY, pz]}>
            {/* Soft shadow plate */}
            <mesh position={[0, -0.025, 0]} receiveShadow>
              <boxGeometry args={[1.2, 0.04, 1.2]} />
              <meshStandardMaterial
                color="#1a1208"
                roughness={1}
                metalness={0}
                transparent
                opacity={0.32}
              />
            </mesh>
            {/* Bronze rim — matches corner avatar frame vibe */}
            <mesh position={[0, 0.01, 0]} castShadow receiveShadow>
              <boxGeometry args={[1.14, 0.07, 1.14]} />
              <meshStandardMaterial
                color="#c9a227"
                roughness={0.38}
                metalness={0.72}
                emissive={themeId === "neon" ? "#ffd54f" : "#000"}
                emissiveIntensity={themeId === "neon" ? 0.2 : 0}
              />
            </mesh>
            {/* Seat-color top pad */}
            <mesh position={[0, 0.065, 0]} castShadow receiveShadow>
              <boxGeometry args={[padSize, 0.09, padSize]} />
              <meshStandardMaterial
                color={hex}
                roughness={mats.tileRough * 0.85}
                metalness={Math.min(0.45, mats.tileMetal + 0.15)}
                emissive={
                  themeId === "neon"
                    ? hex
                    : themeId === "frost"
                      ? mats.tileEmissive
                      : "#000"
                }
                emissiveIntensity={
                  themeId === "neon" ? 0.4 : themeId === "frost" ? 0.14 : 0
                }
              />
            </mesh>
            {/* Inner highlight inset */}
            <mesh position={[0, 0.115, 0]}>
              <boxGeometry args={[0.52, 0.02, 0.52]} />
              <meshStandardMaterial
                color="#fff8e7"
                roughness={0.55}
                metalness={0.2}
                transparent
                opacity={0.28}
              />
            </mesh>
          </group>
        );
      })}
      {/* Thin rim on yard */}
      <mesh position={[x, h + 0.01, z]} receiveShadow>
        <boxGeometry args={[w * 0.98, 0.03, w * 0.98]} />
        <meshStandardMaterial
          color={mats.rim}
          roughness={0.4}
          metalness={0.25}
          transparent
          opacity={0.55}
        />
      </mesh>
    </group>
  );
}

function HomeWedge({
  color,
  rotY,
  half,
  tipY,
  themeId,
}: {
  color: string;
  rotY: number;
  half: number;
  tipY: number;
  themeId: LudoThemeId;
}) {
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute(
      "position",
      new BufferAttribute(
        new Float32Array([-half, 0.02, half, half, 0.02, half, 0, tipY, 0]),
        3,
      ),
    );
    g.computeVertexNormals();
    return g;
  }, [half, tipY]);

  return (
    <mesh geometry={geometry} rotation={[0, rotY, 0]} castShadow receiveShadow>
      <meshStandardMaterial
        color={color}
        side={DoubleSide}
        roughness={themeId === "neon" ? 0.25 : 0.4}
        metalness={themeId === "neon" ? 0.55 : 0.12}
        emissive={themeId === "neon" || themeId === "frost" ? color : "#000"}
        emissiveIntensity={themeId === "neon" ? 0.35 : themeId === "frost" ? 0.12 : 0}
        flatShading
      />
    </mesh>
  );
}

function CenterHome({
  woodDark,
  colors,
  themeId,
}: {
  woodDark: string;
  colors: LudoPlayerColors;
  themeId: LudoThemeId;
}) {
  const [x, , z] = gridToWorld(7, 7, 0);
  const size = 3 * CELL * 0.95;
  const half = size / 2;
  const tipY = 0.48;
  const wedges = [
    { color: colors.red, rotY: 0 },
    { color: colors.green, rotY: -Math.PI / 2 },
    { color: colors.yellow, rotY: Math.PI },
    { color: colors.blue, rotY: Math.PI / 2 },
  ];
  return (
    <group position={[x, 0.12, z]}>
      <mesh position={[0, 0.04, 0]} receiveShadow castShadow>
        <boxGeometry args={[size, 0.08, size]} />
        <meshStandardMaterial color={woodDark} roughness={0.55} metalness={0.1} />
      </mesh>
      {wedges.map((w, i) => (
        <HomeWedge
          key={i}
          color={w.color}
          rotY={w.rotY}
          half={half}
          tipY={tipY}
          themeId={themeId}
        />
      ))}
      <mesh position={[0, tipY + 0.04, 0]} castShadow>
        <octahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial
          color="#fff8e1"
          emissive="#ffecb3"
          emissiveIntensity={0.4}
          metalness={0.3}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}

/** Procedural 3D slab board — never a flat picture texture. */
export function LudoBoardMesh({
  themeId,
  playerColors,
}: {
  themeId: LudoThemeId;
  boardUrl?: string;
  boardModelUrl?: string | null;
  playerColors?: LudoPlayerColors;
}) {
  const mats = themeMaterials(themeId);
  const colors = playerColors ?? PLAYER_COLORS;
  const tiles = useMemo(() => {
    const list: { col: number; row: number }[] = [];
    for (let row = 0; row < GRID; row++) {
      for (let col = 0; col < GRID; col++) {
        if (isBoardTile(col, row)) list.push({ col, row });
      }
    }
    return list;
  }, []);

  const boardSize = GRID * CELL + 0.6;
  const seatColors = Object.keys(BASE_PLATFORMS) as LudoColor[];

  return (
    <group>
      {/* Table base + frame as 3D blocks */}
      <mesh position={[0, -0.1, 0]} receiveShadow castShadow>
        <boxGeometry args={[boardSize + 0.15, 0.24, boardSize + 0.15]} />
        <meshStandardMaterial color={mats.wood} roughness={0.55} metalness={0.08} />
      </mesh>
      <mesh position={[0, 0.04, 0]} receiveShadow castShadow>
        <boxGeometry args={[boardSize + 0.45, 0.08, boardSize + 0.45]} />
        <meshStandardMaterial color={mats.woodDark} roughness={0.6} metalness={0.1} />
      </mesh>
      {/* Accent rim strip */}
      <mesh position={[0, 0.09, 0]} receiveShadow>
        <boxGeometry args={[boardSize + 0.55, 0.035, boardSize + 0.55]} />
        <meshStandardMaterial
          color={mats.rim}
          roughness={0.35}
          metalness={0.4}
          emissive={themeId === "neon" ? mats.rim : "#000"}
          emissiveIntensity={themeId === "neon" ? 0.5 : 0}
        />
      </mesh>

      {seatColors.map((c) => (
        <BasePlatform
          key={c}
          color={c}
          colors={colors}
          mats={mats}
          themeId={themeId}
        />
      ))}

      {tiles.map(({ col, row }) => (
        <TrackTile
          key={`${col}-${row}`}
          col={col}
          row={row}
          mats={mats}
          colors={colors}
          themeId={themeId}
        />
      ))}

      <CenterHome
        woodDark={mats.woodDark}
        colors={colors}
        themeId={themeId}
      />

      {SUIT_MARKS.map((m, i) => (
        <SuitMark key={i} col={m.col} row={m.row} color={m.color} />
      ))}
    </group>
  );
}
