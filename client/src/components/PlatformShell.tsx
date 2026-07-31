import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  homePath,
  isStaff,
  userDisplayName,
  type AuthUser,
} from "../auth";
import { formatXu } from "../cards";
import { AppShell } from "./AppShell";
import { SocialBar, type SocialBarAction } from "./SocialBar";

function playOf(user: AuthUser): number {
  return user.balances?.play ?? user.balance ?? 0;
}

function socialOf(user: AuthUser): number {
  return user.balances?.social ?? 0;
}

function roleShort(user: AuthUser): string {
  if (user.role === "admin" || user.role === "mainadmin") return "Admin";
  if (user.role === "mod") return "Mod";
  if (user.role === "deal") return "Deal";
  if (user.role === "tutien") return "Tu tiên";
  if (user.role === "eco") return "Eco";
  if (user.role === "audit") return "Audit";
  if (user.role === "sgift") return "SGift";
  if (user.role === "ring") return "Ring";
  if (user.role === "pm") return "P+M";
  return "Player";
}

/** Shell nền tảng: brand + 2 làn xu trong 1 khung form. */
export function PlatformShell({
  user,
  children,
  maxWidth = "md",
  showSocial = true,
  dense = false,
  onSocial,
  subtitle,
  onExit,
  staffHref,
}: {
  user: AuthUser;
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg";
  showSocial?: boolean;
  /** Header gọn trong 1 khung form */
  dense?: boolean;
  onSocial?: (action: SocialBarAction) => void;
  subtitle?: string;
  onExit?: () => void;
  /** Link vào panel quản trị (admin/mod/…) */
  staffHref?: string | null;
}) {
  const play = playOf(user);
  const social = socialOf(user);
  const staff = isStaff(user);
  const showMxh = showSocial && !dense && !staff;

  return (
    <AppShell maxWidth={maxWidth}>
      <header className={dense ? "mb-2" : "mb-4"}>
        {dense ? (
          <div className="platform-head app-frame px-2.5 py-2">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <Link
                  to={homePath(user)}
                  className="play-heading block text-base tracking-wide text-[var(--wood-deep)]"
                >
                  SOFIAORE
                </Link>
                <p className="mt-0.5 truncate text-[10px] text-[var(--play-muted)]">
                  <span className="font-bold text-[var(--play-ink)]">
                    {userDisplayName(user)}
                  </span>
                  <span className="mx-1 opacity-40">·</span>
                  <span
                    className={
                      staff
                        ? "font-bold text-[var(--wood-deep)]"
                        : "text-[var(--play-muted)]"
                    }
                  >
                    {roleShort(user)}
                  </span>
                  <span className="mx-1 opacity-40">·</span>
                  ID {user.code}
                </p>
              </div>
              <div className="platform-head__xu shrink-0">
                <div className="platform-head__xu-cell">
                  <span>Chơi</span>
                  <strong>{formatXu(play)}</strong>
                </div>
                <div className="platform-head__xu-cell">
                  <span>Quà</span>
                  <strong>{formatXu(social)}</strong>
                </div>
              </div>
            </div>
            <div className="platform-head__actions mt-1.5">
              {staffHref ? (
                <Link to={staffHref} className="form-tab is-on text-[10px]">
                  Quản trị
                </Link>
              ) : null}
              <Link
                to={homePath(user)}
                className="form-tab text-[10px]"
                onClick={(e) => {
                  if (onSocial) {
                    e.preventDefault();
                    onSocial("profile");
                  }
                }}
              >
                Hồ sơ
              </Link>
              {onExit ? (
                <button
                  type="button"
                  className="form-tab text-[10px]"
                  onClick={onExit}
                >
                  Thoát
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  to={homePath(user)}
                  className="play-heading block text-lg tracking-wide text-[var(--cream)]"
                >
                  SOFIAORE
                </Link>
                <p className="mt-0.5 text-[11px] text-[var(--cream)]/70">
                  {subtitle ?? "Nền tảng giải trí / học tập · xu ảo"}
                </p>
              </div>
              <Link
                to={homePath(user)}
                className="shrink-0 text-right"
                title="Hồ sơ"
                onClick={(e) => {
                  if (onSocial) {
                    e.preventDefault();
                    onSocial("profile");
                  }
                }}
              >
                <p className="truncate text-xs font-bold text-[var(--cream)]">
                  {userDisplayName(user)}
                </p>
                <p className="text-[10px] text-[var(--cream)]/65">
                  ID {user.code}
                </p>
              </Link>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white/80 px-3 py-2 ring-1 ring-[var(--gold)]/40">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--play-muted)]">
                  Xu chơi
                </p>
                <p className="text-sm font-bold text-[var(--wood-deep)]">
                  {formatXu(play)}
                </p>
              </div>
              <div className="rounded-xl bg-white/80 px-3 py-2 ring-1 ring-[var(--gold)]/40">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--play-muted)]">
                  Xu quà
                </p>
                <p className="text-sm font-bold text-[var(--wood-deep)]">
                  {formatXu(social)}
                </p>
              </div>
            </div>

            {showMxh && (
              <div className="mt-3">
                <SocialBar
                  compact
                  onAction={(a) => {
                    onSocial?.(a);
                  }}
                />
              </div>
            )}
          </>
        )}
      </header>
      {children}
    </AppShell>
  );
}
