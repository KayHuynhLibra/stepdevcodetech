import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import type { AuthUser } from "../auth";
import { GameMark } from "../components/GameMark";
import {
  gamePath,
  isGameOpen,
  lobbyCtaLabel,
  type GameManifest,
} from "./games";
import { gameTone } from "./gameTones";
import { prefetchGame } from "./lazyGames";

/**
 * Lobby chọn trò chơi — GameMark mặc định; coverUrl tùy chọn nếu có.
 */
export function GameLobby({
  user,
  games,
  getPath,
}: {
  user?: AuthUser | null;
  games: GameManifest[];
  getPath?: (game: GameManifest) => string;
}) {
  const sorted = [...games].sort((a, b) => a.sort - b.sort);

  return (
    <ul className="game-lobby-grid">
      {sorted.map((g) => {
        const open = isGameOpen(g);
        const href = getPath
          ? getPath(g)
          : user
            ? gamePath(user, g)
            : "#";
        const tone = gameTone(g.id);
        const style = {
          "--card-accent": tone.accent,
          "--card-ink": tone.ink,
          "--card-soft": tone.soft,
          "--card-deep": tone.deep,
          "--card-on": tone.onDeep,
        } as CSSProperties;
        const cover = g.coverUrl?.trim();

        const inner = (
          <>
            <div
              className={`game-lobby-card__art game-lobby-card__art--${g.id} ${
                open ? "" : "is-soon"
              }`}
              aria-hidden
            >
              {cover ? (
                <img
                  src={cover}
                  alt=""
                  className="game-lobby-card__cover"
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : null}
              <GameMark gameId={g.id} className="game-mark--hero" />
              <span className="game-lobby-card__watermark">{g.nameVi}</span>
            </div>
            <div className="game-lobby-card__meta">
              <span
                className={`game-lobby-card__name ${
                  tone.display === "serif" ? "is-serif" : ""
                }`}
              >
                {g.nameVi}
                {!open ? (
                  <span className="game-lobby-card__badge">Sắp mở</span>
                ) : null}
              </span>
              <span className="game-lobby-card__blurb">{g.blurb}</span>
              <span
                className={`game-lobby-card__cta ${open ? "is-open" : ""}`}
              >
                {lobbyCtaLabel(g)}
              </span>
            </div>
          </>
        );
        if (!open) {
          return (
            <li key={g.id}>
              <div
                className={`game-lobby-card game-lobby-card--muted game-lobby-card--${g.id}`}
                style={style}
              >
                {inner}
              </div>
            </li>
          );
        }
        return (
          <li key={g.id}>
            <Link
              to={href}
              className={`game-lobby-card game-lobby-card--${g.id}`}
              style={style}
              onMouseEnter={() => prefetchGame(g.pathSuffix)}
              onFocus={() => prefetchGame(g.pathSuffix)}
              onTouchStart={() => prefetchGame(g.pathSuffix)}
            >
              {inner}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
