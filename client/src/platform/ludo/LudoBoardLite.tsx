import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  resolvePlayerColors,
  type LudoCosmetics,
} from "../../hooks/useLudoCosmetics";
import {
  BASE_CR,
  BASE_PLATFORMS,
  GRID,
  SAFE_VISUAL,
  homeColumnColor,
  isCenter,
  isInBase,
  isOnCross,
  posToXy,
  startTileColor,
  trackCell,
  type LudoColor,
} from "./boardMap";
import {
  seatFacingRotationDeg,
  type LudoPlayerColors,
} from "./cosmeticsCatalog";

export type LudoTokenView = {
  id: string;
  color: string;
  index: number;
  pos: number;
};

/** Cream track — matches common mobile Ludo 2D top-down. */
const TRACK_CREAM = "#f3efe6";

type CellPaint = {
  col: number;
  row: number;
  bg: string;
  kind: "base" | "track" | "start" | "home" | "center" | "empty";
};

function buildCells(colors: LudoPlayerColors): CellPaint[] {
  const list: CellPaint[] = [];
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const base = isInBase(col, row);
      if (base) {
        list.push({ col, row, bg: colors[base], kind: "base" });
        continue;
      }
      if (isCenter(col, row)) {
        list.push({ col, row, bg: "transparent", kind: "center" });
        continue;
      }
      const start = startTileColor(col, row);
      if (start) {
        list.push({ col, row, bg: colors[start], kind: "start" });
        continue;
      }
      const home = homeColumnColor(col, row);
      if (home) {
        list.push({ col, row, bg: colors[home], kind: "home" });
        continue;
      }
      if (isOnCross(col, row)) {
        list.push({ col, row, bg: TRACK_CREAM, kind: "track" });
        continue;
      }
      let onTrack = false;
      for (let i = 0; i < 52; i++) {
        const cr = trackCell(i);
        if (cr && cr[0] === col && cr[1] === row) {
          onTrack = true;
          break;
        }
      }
      list.push(
        onTrack
          ? { col, row, bg: TRACK_CREAM, kind: "track" }
          : { col, row, bg: "transparent", kind: "empty" },
      );
    }
  }
  return list;
}

function cellPct(n: number) {
  return `${(n / GRID) * 100}%`;
}

/** CSS board — flat top-down like mobile Ludo reference. */
export function LudoBoardLite({
  tokens,
  validTokenIds,
  onPick,
  myColor,
  cosmetics,
}: {
  tokens: LudoTokenView[];
  validTokenIds: string[];
  onPick: (tokenId: string) => void;
  myColor?: string | null;
  cosmetics?: LudoCosmetics;
}) {
  const valid = new Set(validTokenIds);
  const [hopIds, setHopIds] = useState<Set<string>>(() => new Set());
  const prevPos = useRef<Record<string, number>>({});

  useEffect(() => {
    const next: Record<string, number> = {};
    const hops = new Set<string>();
    for (const t of tokens) {
      next[t.id] = t.pos;
      const prev = prevPos.current[t.id];
      if (prev !== undefined && prev !== t.pos && !cosmetics?.reduceFx) {
        hops.add(t.id);
      }
    }
    prevPos.current = next;
    if (!hops.size) return;
    setHopIds(hops);
    const t = window.setTimeout(() => setHopIds(new Set()), 420);
    return () => window.clearTimeout(t);
  }, [tokens, cosmetics?.reduceFx]);

  const boardUrl = cosmetics?.boardUrl?.trim() || "";
  const colors = useMemo(
    () => resolvePlayerColors(cosmetics),
    [cosmetics],
  );
  const cells = useMemo(() => buildCells(colors), [colors]);
  const facingDeg = seatFacingRotationDeg(myColor);
  const faceStyle = {
    ...(boardUrl
      ? {
          backgroundImage: `url(${boardUrl})`,
          backgroundSize: "cover" as const,
          backgroundPosition: "center" as const,
        }
      : {}),
    ["--ludo-red" as string]: colors.red,
    ["--ludo-green" as string]: colors.green,
    ["--ludo-yellow" as string]: colors.yellow,
    ["--ludo-blue" as string]: colors.blue,
    ["--ludo-facing" as string]: `${facingDeg}deg`,
    ["--ludo-facing-inv" as string]: `${-facingDeg}deg`,
    transform: `rotate(${facingDeg}deg)`,
  };

  const yardPads = useMemo(() => {
    const pads: { key: string; x: number; y: number }[] = [];
    for (const c of Object.keys(BASE_PLATFORMS) as LudoColor[]) {
      for (let i = 0; i < 4; i++) {
        const cr = BASE_CR[c]![i]!;
        pads.push({
          key: `${c}-${i}`,
          x: ((cr[0] + 0.5) / GRID) * 100,
          y: ((cr[1] + 0.5) / GRID) * 100,
        });
      }
    }
    return pads;
  }, []);

  const yardInsets = useMemo(() => {
    return (Object.keys(BASE_PLATFORMS) as LudoColor[]).map((c) => {
      const b = BASE_PLATFORMS[c];
      return {
        key: c,
        left: cellPct(b.col0 + 0.85),
        top: cellPct(b.row0 + 0.85),
        width: cellPct(4.3),
        height: cellPct(4.3),
        color: colors[c],
      };
    });
  }, [colors]);

  return (
    <div
      className="ludo-board ludo-board--topdown ludo-board--ref2d"
      aria-label="Bàn Ludo"
      data-facing={myColor || "red"}
    >
      <div className="ludo-board__garden" aria-hidden>
        {Array.from({ length: 16 }, (_, i) => (
          <span
            key={i}
            className={`ludo-flower ludo-flower--${(i % 5) + 1}`}
            style={{ "--i": i } as CSSProperties}
          />
        ))}
      </div>
      <div
        className={`ludo-board__face ${boardUrl ? "has-art" : ""}`}
        style={faceStyle}
      >
        {!boardUrl ? (
          <>
            <div className="ludo-board__motif" aria-hidden />
            <div className="ludo-board__grid" aria-hidden>
              {cells.map((cell) => (
                <span
                  key={`${cell.col}-${cell.row}`}
                  className={`ludo-cell ludo-cell--${cell.kind}`}
                  style={{
                    gridColumn: cell.col + 1,
                    gridRow: cell.row + 1,
                    backgroundColor:
                      cell.kind === "center" || cell.kind === "empty"
                        ? undefined
                        : cell.bg,
                  }}
                />
              ))}
            </div>
            {yardInsets.map((y) => (
              <span
                key={`inset-${y.key}`}
                className="ludo-yard-inset"
                style={{
                  left: y.left,
                  top: y.top,
                  width: y.width,
                  height: y.height,
                  background: `color-mix(in srgb, ${y.color} 22%, #f7f4ee)`,
                }}
              />
            ))}
            <div className="ludo-board__home" aria-hidden />
            <div className="ludo-board__grid-lines" aria-hidden />
            {yardPads.map((p) => (
              <span
                key={p.key}
                className="ludo-yard-pad"
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
              />
            ))}
          </>
        ) : null}
        {Array.from(SAFE_VISUAL).map((i) => {
          const xy = posToXy("red", i, 0);
          return (
            <span
              key={`safe-${i}`}
              className="ludo-safe"
              style={{ left: `${xy.x}%`, top: `${xy.y}%` }}
              aria-hidden
            >
              ★
            </span>
          );
        })}
        {tokens.map((t) => {
          const xy = posToXy(t.color, t.pos, t.index);
          const can = valid.has(t.id);
          const pawnUrl =
            cosmetics?.pawnUrls?.[
              t.color as keyof typeof cosmetics.pawnUrls
            ];
          const hex = colors[t.color as LudoColor] ?? colors.red;
          return (
            <button
              key={t.id}
              type="button"
              className={`ludo-token ludo-token--${t.color} ${can ? "is-valid" : ""} ${
                myColor === t.color ? "is-mine" : ""
              } ${hopIds.has(t.id) ? "is-hop" : ""} ${pawnUrl ? "has-art" : ""}`}
              style={{
                left: `${xy.x}%`,
                top: `${xy.y}%`,
                ...(pawnUrl
                  ? {
                      backgroundImage: `url(${pawnUrl})`,
                      backgroundSize: "contain",
                      backgroundPosition: "center",
                      backgroundRepeat: "no-repeat",
                    }
                  : {
                      background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.5), transparent 48%), ${hex}`,
                    }),
              }}
              disabled={!can}
              onClick={() => onPick(t.id)}
              title={t.id}
            >
              {pawnUrl ? "" : t.index + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
