import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { type AuthUser } from "../auth";
import { guestGamePath } from "../guest";
import {
  fetchPlatformGames,
  gamePath,
  getCachedPlatformGames,
  isGameOpen,
  LOBBY_PICK_TITLE,
  type GameManifest,
} from "../platform/games";
import { gameTone } from "../platform/gameTones";
import { GameMark } from "./GameMark";

/** Shell điều hướng bàn chơi — CSS mark + tone, không ảnh cover. */
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
      className={`table-nav form-tabs ${compact ? "table-nav--compact table-nav--stack-mobile" : ""}`}
      aria-label={LOBBY_PICK_TITLE}
    >
      {games.map((g) => {
        const open = isGameOpen(g);
        const on = active === g.id;
        const tone = gameTone(g.id);
        const cls = [
          "form-tab",
          "form-tab--game",
          `form-tab--${g.id}`,
          on ? "is-on" : "",
          open ? "" : "form-tab--disabled",
        ]
          .filter(Boolean)
          .join(" ");
        const style = {
          "--tab-accent": tone.accent,
          "--tab-ink": tone.ink,
          "--tab-soft": tone.soft,
          "--tab-deep": tone.deep,
          "--tab-on": tone.onDeep,
          fontFamily:
            tone.display === "serif"
              ? '"Cormorant Garamond", "Nunito", Georgia, serif'
              : '"Nunito", "Be Vietnam Pro", system-ui, sans-serif',
        } as CSSProperties;

        if (!open) {
          return (
            <span key={g.id} className={cls} style={style} title={g.blurb}>
              <GameMark gameId={g.id} />
              <span className="form-tab__label">{g.nameVi}</span>
            </span>
          );
        }
        return (
          <Link
            key={g.id}
            to={hrefFor(g)}
            className={cls}
            style={style}
            title={g.blurb}
            aria-current={on ? "page" : undefined}
          >
            <GameMark gameId={g.id} />
            <span className="form-tab__label">{g.nameVi}</span>
          </Link>
        );
      })}
    </nav>
  );
}
