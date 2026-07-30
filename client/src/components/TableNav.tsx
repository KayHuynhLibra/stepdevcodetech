import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { type AuthUser } from "../auth";
import {
  fetchPlatformGames,
  gamePath,
  getCachedPlatformGames,
  isGameOpen,
  type GameManifest,
} from "../platform/games";

/** Shell điều hướng bàn chơi — đọc Game Registry. */
export function TableNav({
  user,
  active,
  compact,
}: {
  user: AuthUser | null | undefined;
  active?: string;
  compact?: boolean;
}) {
  const [games, setGames] = useState<GameManifest[]>(() =>
    getCachedPlatformGames().filter(
      (g) => g.status === "live" || g.status === "beta",
    ),
  );

  useEffect(() => {
    void fetchPlatformGames().then((list) => {
      setGames(
        list.filter(
          (g) =>
            g.enabled && (g.status === "live" || g.status === "beta"),
        ),
      );
    });
  }, []);

  if (!user) return null;

  return (
    <nav
      className={`table-nav flex flex-wrap gap-1.5 ${compact ? "justify-center" : ""}`}
      aria-label="Chọn bàn"
    >
      {games.map((g) => {
        const open = isGameOpen(g);
        const on = active === g.id;
        if (!open) {
          return (
            <span
              key={g.id}
              className="rounded-full bg-white/50 px-3 py-1.5 text-[11px] font-bold text-[var(--play-muted)] ring-1 ring-[var(--wood-deep)]/10"
              title={g.blurb}
            >
              {g.nameVi}
            </span>
          );
        }
        return (
          <Link
            key={g.id}
            to={gamePath(user, g)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
              on
                ? "bg-[var(--wood-deep)] text-[var(--cream)]"
                : "bg-white/80 text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/15 hover:bg-white"
            }`}
          >
            {g.nameVi}
          </Link>
        );
      })}
    </nav>
  );
}
