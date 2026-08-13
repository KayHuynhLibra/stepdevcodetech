import type { ReactNode } from "react";
import type { AuthUser } from "../../auth";
import { formatXu } from "../../cards";
import { IdentityBadge } from "../IdentityBadge";

/** Header trang quản trị — title gọn, xu, hành động. */
export function AdminChrome({
  user,
  onPlayClick,
  onLogout,
  onAvatarClick,
  extraActions,
}: {
  user: AuthUser;
  /** Mở popup chọn bàn (thay vì link thẳng). */
  onPlayClick: () => void;
  onLogout: () => void;
  onAvatarClick?: () => void;
  extraActions?: ReactNode;
}) {
  const play = user.balances?.play ?? user.balance ?? 0;
  const social = user.balances?.social ?? 0;

  return (
    <header className="admin-chrome app-frame">
      <div className="admin-chrome__top">
        <div className="admin-chrome__brand">
          <p className="admin-chrome__eyebrow">Staff panel</p>
          <h1 className="admin-chrome__title">Quản trị</h1>
          <p className="admin-chrome__lead">Thao tác trong khung form · popup gọn</p>
        </div>
        <div className="admin-chrome__xu">
          <div className="admin-chrome__xu-cell">
            <span>Chơi</span>
            <strong>{formatXu(play)}</strong>
          </div>
          <div className="admin-chrome__xu-cell">
            <span>Quà</span>
            <strong>{formatXu(social)}</strong>
          </div>
        </div>
      </div>

      <div className="admin-chrome__actions">
        <button
          type="button"
          className="admin-chrome__btn admin-chrome__btn--ghost"
          onClick={onPlayClick}
        >
          Vào bàn
        </button>
        {extraActions}
        <button
          type="button"
          className="admin-chrome__btn admin-chrome__btn--muted"
          onClick={onLogout}
        >
          Thoát
        </button>
      </div>

      <div className="admin-chrome__identity">
        <IdentityBadge
          user={user}
          compact
          showPath={false}
          onAvatarClick={onAvatarClick}
        />
      </div>
    </header>
  );
}
