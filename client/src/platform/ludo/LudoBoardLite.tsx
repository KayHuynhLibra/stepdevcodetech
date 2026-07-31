import { useEffect, useRef, useState } from "react";
import { posToXy, SAFE_VISUAL } from "./boardMap";
import type { LudoCosmetics } from "../../hooks/useLudoCosmetics";

export type LudoTokenView = {
  id: string;
  color: string;
  index: number;
  pos: number;
};

/** CSS board — no Three.js (mobile / slow network). */
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
  const faceStyle = boardUrl
    ? {
        backgroundImage: `url(${boardUrl})`,
        backgroundSize: "cover" as const,
        backgroundPosition: "center" as const,
      }
    : undefined;

  return (
    <div className="ludo-board" aria-label="Bàn Ludo">
      <div
        className={`ludo-board__face ${boardUrl ? "has-art" : ""}`}
        style={faceStyle}
      >
        {!boardUrl ? (
          <>
            <div className="ludo-board__quad ludo-board__quad--red" />
            <div className="ludo-board__quad ludo-board__quad--green" />
            <div className="ludo-board__quad ludo-board__quad--yellow" />
            <div className="ludo-board__quad ludo-board__quad--blue" />
            <div className="ludo-board__cross" />
          </>
        ) : null}
        {Array.from(SAFE_VISUAL).map((i) => {
          const xy = posToXy("red", i, 0);
          return (
            <span
              key={`safe-${i}`}
              className="ludo-safe"
              style={{ left: `${xy.x}%`, top: `${xy.y}%` }}
            />
          );
        })}
        {tokens.map((t) => {
          const xy = posToXy(t.color, t.pos, t.index);
          const can = valid.has(t.id);
          const pawnUrl = cosmetics?.pawnUrls?.[t.color as keyof typeof cosmetics.pawnUrls];
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
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : {}),
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
