import { useMemo, type CSSProperties } from "react";
import {
  resolveBoardPlayerColors,
  type LudoCosmetics,
} from "../../hooks/useLudoCosmetics";
import {
  BASE_PLATFORMS,
  GRID,
  SAFE_VISUAL,
  homeColumnColor,
  isCenter,
  isInBase,
  isOnCross,
  posToXy,
  buildTokenStackMap,
  startTileColor,
  trackCell,
  type LudoColor,
} from "./boardMap";
import {
  seatFacingRotationDeg,
  type LudoPlayerColors,
} from "./cosmeticsCatalog";
import {
  LudoCornerAvatars,
  type LudoCornerDie,
  type LudoCornerPlayer,
} from "./LudoCornerAvatars";
import { pawnDecorClass, pawnDecorGlyph } from "./pawnDecorVisual";
import { LudoDiceThrow } from "./LudoDiceThrow";
import { themeTrackColor, type LudoThemeId } from "./themes";
import {
  useAnimatedTokens,
  type LudoTokenView,
} from "./useAnimatedTokens";

export type { LudoTokenView };

/** Cream track — overridden per theme via themeTrackColor(). */
const TRACK_CREAM = "#f3efe6";

type CellPaint = {
  col: number;
  row: number;
  bg: string;
  kind: "base" | "track" | "start" | "home" | "center" | "empty";
};

function buildCells(
  colors: LudoPlayerColors,
  trackFill: string = TRACK_CREAM,
): CellPaint[] {
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
        list.push({ col, row, bg: trackFill, kind: "track" });
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
          ? { col, row, bg: trackFill, kind: "track" }
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
  themeId = "classic",
  players,
  mySeat,
  turnSeat,
  dice,
  diceFaces,
  diceThrowKey = 0,
  diceThrowColor,
  turnDice,
  selectedDieIndex = null,
  diceSelectable = false,
  onSelectDie,
  onSelectPlayer,
}: {
  tokens: LudoTokenView[];
  validTokenIds: string[];
  onPick: (tokenId: string) => void;
  myColor?: string | null;
  cosmetics?: LudoCosmetics;
  themeId?: LudoThemeId;
  players?: LudoCornerPlayer[];
  mySeat?: number | null;
  turnSeat?: number | null;
  dice?: number | null;
  diceFaces?: number[] | null;
  diceThrowKey?: number;
  diceThrowColor?: string | null;
  turnDice?: LudoCornerDie[] | null;
  selectedDieIndex?: number | null;
  diceSelectable?: boolean;
  onSelectDie?: (dieIndex: number) => void;
  onSelectPlayer?: (player: LudoCornerPlayer) => void;
}) {
  const valid = new Set(validTokenIds);
  const animated = useAnimatedTokens(tokens, cosmetics?.reduceFx);
  const stackMap = useMemo(() => buildTokenStackMap(animated), [animated]);

  const colors = useMemo(
    () => resolveBoardPlayerColors(themeId, cosmetics),
    [themeId, cosmetics],
  );
  const trackFill = useMemo(() => themeTrackColor(themeId), [themeId]);
  const cells = useMemo(
    () => buildCells(colors, trackFill),
    [colors, trackFill],
  );
  const facingDeg = seatFacingRotationDeg(myColor);
  const faceStyle = {
    background: "var(--ludo-board-bg)",
    ["--ludo-red" as string]: colors.red,
    ["--ludo-green" as string]: colors.green,
    ["--ludo-yellow" as string]: colors.yellow,
    ["--ludo-blue" as string]: colors.blue,
    ["--ludo-facing" as string]: `${facingDeg}deg`,
    ["--ludo-facing-inv" as string]: `${-facingDeg}deg`,
    transform: `rotate(${facingDeg}deg)`,
  };

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

  const pawnDecorByColor = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of players || []) {
      if (p.color && p.pawnDecorId) m[p.color] = p.pawnDecorId;
    }
    return m;
  }, [players]);

  return (
    <div
      className="ludo-board ludo-board--topdown ludo-board--ref2d"
      aria-label="Bàn Ludo"
      data-facing={myColor || "red"}
      data-theme={themeId}
    >
      {players?.length ? (
        <LudoCornerAvatars
          players={players}
          mySeat={mySeat}
          turnSeat={turnSeat}
          facingColor={myColor}
          turnDice={turnDice}
          selectedDieIndex={selectedDieIndex}
          diceSelectable={diceSelectable}
          onSelectDie={onSelectDie}
          onSelectPlayer={onSelectPlayer}
        />
      ) : null}
      <LudoDiceThrow
        dice={dice}
        faces={diceFaces}
        throwKey={diceThrowKey}
        fromColor={diceThrowColor}
        facingColor={myColor}
        diceUrl={cosmetics?.diceUrl}
        reduceFx={cosmetics?.reduceFx}
      />
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
        className="ludo-board__face"
        style={faceStyle}
      >
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
                  background: `linear-gradient(145deg, color-mix(in srgb, ${y.color} 72%, #fff), color-mix(in srgb, ${y.color} 55%, #0003))`,
                  boxShadow: `inset 0 0 0 2px color-mix(in srgb, ${y.color} 40%, transparent)`,
                }}
              />
            ))}
            <div className="ludo-board__home" aria-hidden />
            <div className="ludo-board__grid-lines" aria-hidden />
        </>
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
        {animated.map((t) => {
          const stack = stackMap.get(t.id);
          const xy = posToXy(t.color, t.pos, t.index, stack);
          const can = valid.has(t.id) && !t.moving;
          const decorId = pawnDecorByColor[t.color] || "pawn-classic";
          const shopDecor = decorId !== "pawn-classic";
          /* Shop decor beats demo/admin pawn art so equip is visible. */
          const pawnUrl = shopDecor
            ? undefined
            : cosmetics?.pawnUrls?.[
                t.color as keyof typeof cosmetics.pawnUrls
              ];
          const hex = colors[t.color as LudoColor] ?? colors.red;
          const decorCls = pawnDecorClass(decorId);
          const glyph = pawnDecorGlyph(decorId);
          const hopClass =
            t.hopTick > 0 ? "is-hop" : can ? "is-idle" : "";
          const stackZ =
            3 + (stack ? stack.slot : t.index) + (can ? 2 : 0);
          return (
            <button
              key={t.id}
              type="button"
              className={`ludo-token ludo-token--${t.color} ${decorCls} ${can ? "is-valid" : ""} ${
                myColor === t.color ? "is-mine" : ""
              } ${t.moving ? "is-moving" : ""} ${pawnUrl ? "has-art" : ""} ${
                stack && stack.count > 1 ? "is-stacked" : ""
              } ${t.pos === -1 ? "is-yard" : ""}`}
              data-decor={decorId}
              style={{
                left: `${xy.x}%`,
                top: `${xy.y}%`,
                zIndex: t.moving ? 8 : stackZ,
                ...(pawnUrl
                  ? {
                      backgroundImage: "none",
                    }
                  : {
                      background: "transparent",
                    }),
              }}
              disabled={!can}
              onClick={() => onPick(t.id)}
              title={`${t.id} · ${decorId}`}
            >
              <span className="ludo-token__shadow" aria-hidden />
              <span
                key={t.hopTick}
                className={`ludo-token__bob ${hopClass}`}
                onAnimationEnd={(e) => {
                  if (e.animationName !== "ludo-hop-bounce") return;
                  e.currentTarget.classList.remove("is-hop");
                  if (can) e.currentTarget.classList.add("is-idle");
                }}
                style={
                  pawnUrl
                    ? {
                        backgroundImage: `url(${pawnUrl})`,
                        backgroundSize: "contain",
                        backgroundPosition: "center",
                        backgroundRepeat: "no-repeat",
                      }
                    : ({
                        ["--token-fill" as string]: hex,
                      } as CSSProperties)
                }
              >
                {pawnUrl ? null : (
                  <span className="ludo-token__face">
                    {glyph ? (
                      <span className="ludo-token__glyph" aria-hidden>
                        {glyph}
                      </span>
                    ) : (
                      <span className="ludo-token__num">{t.index + 1}</span>
                    )}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
