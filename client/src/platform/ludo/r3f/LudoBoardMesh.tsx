import { useMemo } from "react";
import { Text } from "@react-three/drei";
import { BufferAttribute, BufferGeometry, DoubleSide } from "three";
import {
  BASE_PLATFORMS,
  CELL,
  GRID,
  PLAYER_COLORS,
  SUIT_MARKS,
  gridToWorld,
  homeColumnColor,
  isBoardTile,
  startTileColor,
  type LudoColor,
} from "../boardMap";
import type { LudoThemeId } from "../themes";
import { themeMaterials } from "./themeMaterials";

const TILE_H = 0.12;
const TILE_Y = 0.08;
const YARD_PADS: [number, number][] = [
  [1.5, 1.5],
  [3.5, 1.5],
  [1.5, 3.5],
  [3.5, 3.5],
];

function TrackTile({
  col,
  row,
  trackColor,
}: {
  col: number;
  row: number;
  trackColor: string;
}) {
  const [x, , z] = gridToWorld(col, row, TILE_Y);
  const start = startTileColor(col, row);
  const home = homeColumnColor(col, row);
  const color = start
    ? PLAYER_COLORS[start]
    : home
      ? PLAYER_COLORS[home]
      : trackColor;
  const size = CELL * 0.92;
  return (
    <mesh position={[x, TILE_Y, z]} castShadow receiveShadow>
      <boxGeometry args={[size, TILE_H, size]} />
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} />
    </mesh>
  );
}

function BasePlatform({
  color,
}: {
  color: LudoColor;
}) {
  const b = BASE_PLATFORMS[color];
  const [x, , z] = gridToWorld(b.col0 + 2.5, b.row0 + 2.5, 0);
  const w = 6 * CELL * 0.98;
  const h = 0.18;
  return (
    <group>
      <mesh position={[x, h / 2, z]} castShadow receiveShadow>
        <boxGeometry args={[w, h, w]} />
        <meshStandardMaterial
          color={PLAYER_COLORS[color]}
          roughness={0.5}
          metalness={0.08}
        />
      </mesh>
      <mesh position={[x, h + 0.02, z]} receiveShadow>
        <boxGeometry args={[w * 0.72, 0.04, w * 0.72]} />
        <meshStandardMaterial color="#eceff1" roughness={0.7} />
      </mesh>
      {YARD_PADS.map(([dc, dr], i) => {
        const [px, , pz] = gridToWorld(
          b.col0 + dc,
          b.row0 + dr,
          h + 0.06,
        );
        return (
          <mesh key={i} position={[px, h + 0.06, pz]} receiveShadow castShadow>
            <cylinderGeometry args={[0.32, 0.36, 0.1, 24]} />
            <meshStandardMaterial
              color={PLAYER_COLORS[color]}
              roughness={0.4}
              metalness={0.1}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function HomeWedge({
  color,
  rotY,
  half,
  tipY,
}: {
  color: string;
  rotY: number;
  half: number;
  tipY: number;
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
        roughness={0.4}
        metalness={0.12}
        flatShading
      />
    </mesh>
  );
}

function CenterHome({ woodDark }: { woodDark: string }) {
  const [x, , z] = gridToWorld(7, 7, 0);
  const size = 3 * CELL * 0.95;
  const half = size / 2;
  const tipY = 0.42;
  const wedges = [
    { color: PLAYER_COLORS.red, rotY: Math.PI / 2 },
    { color: PLAYER_COLORS.green, rotY: 0 },
    { color: PLAYER_COLORS.yellow, rotY: -Math.PI / 2 },
    { color: PLAYER_COLORS.blue, rotY: Math.PI },
  ];
  return (
    <group position={[x, 0.12, z]}>
      <mesh position={[0, 0.03, 0]} receiveShadow castShadow>
        <boxGeometry args={[size, 0.06, size]} />
        <meshStandardMaterial color={woodDark} roughness={0.6} />
      </mesh>
      {wedges.map((w) => (
        <HomeWedge
          key={w.color}
          color={w.color}
          rotY={w.rotY}
          half={half}
          tipY={tipY}
        />
      ))}
      <mesh position={[0, tipY + 0.02, 0]} castShadow>
        <octahedronGeometry args={[0.16, 0]} />
        <meshStandardMaterial
          color="#fff8e1"
          emissive="#ffecb3"
          emissiveIntensity={0.3}
        />
      </mesh>
    </group>
  );
}

export function LudoBoardMesh({ themeId }: { themeId: LudoThemeId }) {
  const mats = themeMaterials(themeId);
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
  const colors = Object.keys(BASE_PLATFORMS) as LudoColor[];

  return (
    <group>
      <mesh position={[0, -0.08, 0]} receiveShadow castShadow>
        <boxGeometry args={[boardSize, 0.2, boardSize]} />
        <meshStandardMaterial color={mats.wood} roughness={0.75} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[boardSize + 0.35, 0.06, boardSize + 0.35]} />
        <meshStandardMaterial color={mats.woodDark} roughness={0.8} />
      </mesh>

      {colors.map((c) => (
        <BasePlatform key={c} color={c} />
      ))}

      {tiles.map(({ col, row }) => (
        <TrackTile
          key={`${col}-${row}`}
          col={col}
          row={row}
          trackColor={mats.track}
        />
      ))}

      <CenterHome woodDark={mats.woodDark} />

      {SUIT_MARKS.map((m, i) => {
        const [x, , z] = gridToWorld(m.col, m.row, TILE_Y + TILE_H / 2 + 0.06);
        return (
          <Text
            key={i}
            position={[x, TILE_Y + TILE_H / 2 + 0.06, z]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.4}
            color={m.color}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#00000055"
          >
            {m.symbol}
          </Text>
        );
      })}
    </group>
  );
}
