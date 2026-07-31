import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getToken, getStoredUser, homePath } from "../auth";
import { AppShell } from "../components/AppShell";
import {
  ensureGuestCode,
  guestGamePath,
  guestHomePath,
} from "../guest";
import { GameLobby } from "../platform/GameLobby";
import {
  fetchPlatformGames,
  getCachedPlatformGames,
  type GameManifest,
} from "../platform/games";

/** Lobby khách — registry nhẹ, chunk game chỉ tải khi chọn bàn. */
export default function GuestLobbyPage() {
  const { guestCode } = useParams();
  const nav = useNavigate();
  const code = (guestCode || ensureGuestCode()).toUpperCase();
  const [games, setGames] = useState<GameManifest[]>(() =>
    getCachedPlatformGames(),
  );

  useEffect(() => {
    const user = getStoredUser();
    if (getToken() && user) {
      nav(homePath(user), { replace: true });
      return;
    }
    const mine = ensureGuestCode();
    if (code !== mine) {
      nav(guestHomePath(mine), { replace: true });
    }
  }, [code, nav]);

  useEffect(() => {
    void fetchPlatformGames().then(setGames);
  }, []);

  return (
    <AppShell maxWidth="md">
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="play-heading text-base text-[var(--wood-deep)]">
            SOFIAORE
          </p>
          <p className="text-[11px] text-[var(--play-muted)]">
            Chơi nhanh · mã{" "}
            <span className="font-mono font-bold text-[var(--play-ink)]">
              {code}
            </span>
          </p>
        </div>
        <Link
          to="/login"
          className="shrink-0 rounded-xl bg-[var(--wood-deep)] px-3 py-2 text-xs font-bold text-white"
        >
          Đăng nhập
        </Link>
      </header>

      <div className="app-frame px-2.5 py-2.5 sm:px-3 sm:py-3">
        <p className="play-heading text-center text-sm">Chọn bàn</p>
        <GameLobby
          games={games}
          getPath={(g) => guestGamePath(code, g.pathSuffix)}
        />
      </div>
    </AppShell>
  );
}
