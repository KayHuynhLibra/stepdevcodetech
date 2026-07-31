import { Link } from "react-router-dom";
import type { AuthUser } from "../auth";
import {
  gamePath,
  isGameOpen,
  lobbyCtaLabel,
  type GameManifest,
} from "./games";
import { prefetchGame } from "./lazyGames";

/**
 * Lobby chọn bàn — lưới card rõ ràng (mobile + desktop), thấy hết game đang mở.
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
        const cover = g.coverUrl || "/assets/lobby/soon.svg";
        const href = getPath
          ? getPath(g)
          : user
            ? gamePath(user, g)
            : "#";
        const inner = (
          <>
            <div
              className={`game-lobby-card__art ${open ? "" : "is-soon"}`}
            >
              <img
                src={cover}
                alt=""
                width={96}
                height={96}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="game-lobby-card__meta">
              <span className="game-lobby-card__name">
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
              <div className="game-lobby-card game-lobby-card--muted">{inner}</div>
            </li>
          );
        }
        return (
          <li key={g.id}>
            <Link
              to={href}
              className="game-lobby-card"
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
