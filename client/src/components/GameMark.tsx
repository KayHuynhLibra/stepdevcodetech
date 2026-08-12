import type { CSSProperties } from "react";
import { gameTone } from "../platform/gameTones";

/** Mark CSS thuần — không request ảnh lobby. */
export function GameMark({
  gameId,
  className = "",
}: {
  gameId: string;
  className?: string;
}) {
  const tone = gameTone(gameId);
  return (
    <span
      className={`game-mark game-mark--${gameId} ${className}`.trim()}
      style={
        {
          "--gm-accent": tone.accent,
          "--gm-ink": tone.ink,
          "--gm-soft": tone.soft,
          "--gm-deep": tone.deep,
          "--gm-on": tone.onDeep,
        } as CSSProperties
      }
      aria-hidden
    >
      {gameId === "ludo" ? (
        <span className="game-mark__ludo" />
      ) : (
        <span className="game-mark__glyph">{tone.glyph}</span>
      )}
    </span>
  );
}
