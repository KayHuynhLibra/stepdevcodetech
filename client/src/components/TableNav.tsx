import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { type AuthUser } from "../auth";
import { guestGamePath } from "../guest";
import {
  fetchPlatformGames,
  gamePath,
  getCachedPlatformGames,
  isGameOpen,
  type GameManifest,
} from "../platform/games";

/** Shell điều hướng bàn chơi — đọc Game Registry (login hoặc guest). */
export function TableNav({
  user,
  guestCode,
  active,
  compact,
}: {
  user?: AuthUser | null;
  guestCode?: string | null;
  active?: string;
  compact?: boolean;
}) {
  const [games, setGames] = useState<GameManifest[]>(() =>
    getCachedPlatformGames().filter(
      (g) => g.enabled && (g.status === "live" || g.status === "beta"),
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

  if (!user && !guestCode) return null;

  const hrefFor = (g: GameManifest) =>
    guestCode
      ? guestGamePath(guestCode, g.pathSuffix)
      : user
        ? gamePath(user, g)
        : "#";

  return (
    <nav
      className={`table-nav form-tabs ${compact ? "table-nav--compact" : ""}`}
      aria-label="Chọn bàn"
    >
      {games.map((g) => {
        const open = isGameOpen(g);
        const on = active === g.id;
        const cover = g.coverUrl || "/assets/lobby/soon.svg";
        if (!open) {
          return (
            <span
              key={g.id}
              className="form-tab form-tab--disabled form-tab--game"
              title={g.blurb}
            >
              <img src={cover} alt="" className="form-tab__icon" />
              {g.nameVi}
            </span>
          );
        }
        return (
          <Link
            key={g.id}
            to={hrefFor(g)}
            className={`form-tab form-tab--game ${on ? "is-on" : ""}`}
            title={g.blurb}
          >
            <img src={cover} alt="" className="form-tab__icon" />
            {g.nameVi}
          </Link>
        );
      })}
    </nav>
  );
}
