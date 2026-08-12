import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { homePath, type AuthUser } from "../auth";
import { formatXu } from "../cards";
import { formatGem } from "../gem";
import {
  ensureGuestCode,
  getGuestCode,
  guestHomePath,
} from "../guest";
import { TableNav } from "./TableNav";

/**
 * Header bàn chơi dùng chung — play-first mobile:
 * Lobby · tên bàn · xu · gem · (tools) · TableNav.
 */
export function GameChrome({
  title,
  active,
  user,
  guestCode,
  playBalance,
  socialBalance,
  gemBalance,
  tools,
  banner,
  showNav = false,
}: {
  title: string;
  active?: string;
  user?: AuthUser | null;
  guestCode?: string | null;
  playBalance?: number | null;
  socialBalance?: number | null;
  gemBalance?: number | null;
  tools?: ReactNode;
  banner?: ReactNode;
  showNav?: boolean;
}) {
  const gCode =
    guestCode ?? (!user ? getGuestCode() || ensureGuestCode() : null);
  const lobbyTo = user ? homePath(user) : guestHomePath(gCode);
  const play =
    playBalance ??
    user?.balances?.play ??
    user?.balance ??
    null;
  const social = socialBalance ?? user?.balances?.social ?? null;
  const gem = gemBalance ?? user?.gemBalance ?? null;

  return (
    <header className="game-chrome">
      <div className="game-chrome__row">
        <Link to={lobbyTo} className="game-chrome__lobby">
          <span className="game-chrome__lobby-arrow" aria-hidden>
            ←
          </span>
          Lobby
        </Link>
        <div className="game-chrome__title min-w-0 flex-1">
          <p className="play-heading truncate text-sm leading-tight sm:text-base">
            {title}
          </p>
          {play != null && (
            <p className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] font-semibold tabular-nums text-[var(--play-muted)]">
              <span>
                Chơi{" "}
                <span className="text-[var(--wood-deep)]">{formatXu(play)}</span>
              </span>
              {social != null && user ? (
                <span className="game-chrome__social">
                  Quà{" "}
                  <span className="text-[var(--wood-deep)]">
                    {formatXu(social)}
                  </span>
                </span>
              ) : null}
              {gem != null && user ? (
                <span className="game-chrome__gem">
                  Gem{" "}
                  <span className="text-[var(--wood-deep)]">{formatGem(gem)}</span>
                </span>
              ) : null}
            </p>
          )}
        </div>
        {tools ? (
          <div className="game-chrome__tools shrink-0">{tools}</div>
        ) : null}
      </div>

      {showNav && (user || gCode) ? (
        <div className="game-chrome__nav">
          <TableNav
            user={user}
            guestCode={gCode}
            active={active}
            compact
          />
        </div>
      ) : null}

      {banner}
    </header>
  );
}
