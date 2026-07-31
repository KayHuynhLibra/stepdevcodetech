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
 * Lobby nhẹ — hàng chọn bàn gọn (thumb nhỏ), không cover 16:9 chiếm cả màn.
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
  return (
    <ul className="mt-2 space-y-1.5">
      {games.map((g) => {
        const open = isGameOpen(g);
        const cover = g.coverUrl || "/assets/lobby/soon.svg";
        const href = getPath
          ? getPath(g)
          : user
            ? gamePath(user, g)
            : "#";
        const body = (
          <>
            <div
              className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--wood-deep)]/10 sm:h-14 sm:w-14 ${open ? "" : "opacity-50 grayscale"}`}
            >
              <img
                src={cover}
                alt=""
                width={56}
                height={56}
                loading="lazy"
                decoding="async"
                fetchPriority="low"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1 py-0.5">
              <span className="flex items-center gap-1.5 text-sm font-bold text-[var(--play-ink)]">
                {g.nameVi}
                {!open && (
                  <span className="rounded bg-black/45 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                    Sắp mở
                  </span>
                )}
              </span>
              <span className="mt-0.5 line-clamp-1 block text-[11px] text-[var(--play-muted)]">
                {g.blurb}
              </span>
            </div>
            <span
              className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide ${open ? "text-[var(--wood-deep)]" : "text-[var(--play-muted)]"}`}
            >
              {lobbyCtaLabel(g)}
            </span>
          </>
        );
        if (!open) {
          return (
            <li key={g.id}>
              <div className="form-row form-row--muted flex items-center gap-2.5 px-2 py-1.5">
                {body}
              </div>
            </li>
          );
        }
        return (
          <li key={g.id}>
            <Link
              to={href}
              className="form-row flex items-center gap-2.5 px-2 py-1.5 transition hover:bg-white/90"
              onMouseEnter={() => prefetchGame(g.pathSuffix)}
              onFocus={() => prefetchGame(g.pathSuffix)}
              onTouchStart={() => prefetchGame(g.pathSuffix)}
            >
              {body}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
