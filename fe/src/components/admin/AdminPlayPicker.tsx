import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import type { AuthUser } from "../../auth";
import {
  gamePath,
  isGameOpen,
  lobbyCtaLabel,
  type GameManifest,
} from "../../platform/games";
import { gameTone } from "../../platform/gameTones";
import { prefetchGame } from "../../platform/lazyGames";
import { GameMark } from "../GameMark";
import { AdminModal } from "./AdminModal";

/** Popup chọn bàn — danh sách dọc, vào nhanh từ quản trị. */
export function AdminPlayPicker({
  open,
  onClose,
  user,
  games,
}: {
  open: boolean;
  onClose: () => void;
  user: AuthUser;
  games: GameManifest[];
}) {
  const sorted = [...games].sort((a, b) => a.sort - b.sort);
  const openGames = sorted.filter(isGameOpen);
  const soonGames = sorted.filter((g) => !isGameOpen(g));

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      title="Vào bàn"
      subtitle="Chọn game · vào nhanh"
      maxWidthClass="max-w-sm"
    >
      <ul className="admin-play-list">
        {openGames.map((g) => {
          const tone = gameTone(g.id);
          const style = {
            "--pick-accent": tone.accent,
            "--pick-ink": tone.ink,
            "--pick-soft": tone.soft,
            "--pick-deep": tone.deep,
          } as CSSProperties;
          return (
            <li key={g.id}>
              <Link
                to={gamePath(user, g)}
                className={`admin-play-row admin-play-row--${g.id}`}
                style={style}
                onClick={onClose}
                onMouseEnter={() => prefetchGame(g.pathSuffix)}
                onFocus={() => prefetchGame(g.pathSuffix)}
                onTouchStart={() => prefetchGame(g.pathSuffix)}
              >
                <GameMark gameId={g.id} className="game-mark--hero admin-play-row__mark" />
                <span className="admin-play-row__meta">
                  <span
                    className={`admin-play-row__name ${
                      tone.display === "serif" ? "is-serif" : ""
                    }`}
                  >
                    {g.nameVi}
                  </span>
                  <span className="admin-play-row__blurb">{g.blurb}</span>
                </span>
                <span className="admin-play-row__cta">{lobbyCtaLabel(g)}</span>
              </Link>
            </li>
          );
        })}
        {soonGames.map((g) => {
          const tone = gameTone(g.id);
          const style = {
            "--pick-accent": tone.accent,
            "--pick-ink": tone.ink,
            "--pick-soft": tone.soft,
          } as CSSProperties;
          return (
            <li key={g.id}>
              <div
                className="admin-play-row admin-play-row--muted"
                style={style}
                title={g.blurb}
              >
                <GameMark gameId={g.id} />
                <span className="admin-play-row__meta">
                  <span className="admin-play-row__name">{g.nameVi}</span>
                  <span className="admin-play-row__blurb">Sắp mở</span>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </AdminModal>
  );
}
