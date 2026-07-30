import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { homePath, userDisplayName, type AuthUser } from "../auth";
import { formatXu } from "../cards";
import { AppShell } from "./AppShell";
import { SocialBar, type SocialBarAction } from "./SocialBar";

function playOf(user: AuthUser): number {
  return user.balances?.play ?? user.balance ?? 0;
}

function socialOf(user: AuthUser): number {
  return user.balances?.social ?? 0;
}

/** Shell nền tảng: brand + 2 làn xu + MXH mỏng. */
export function PlatformShell({
  user,
  children,
  maxWidth = "md",
  showSocial = true,
  onSocial,
  subtitle,
}: {
  user: AuthUser;
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg";
  showSocial?: boolean;
  onSocial?: (action: SocialBarAction) => void;
  subtitle?: string;
}) {
  const play = playOf(user);
  const social = socialOf(user);

  return (
    <AppShell maxWidth={maxWidth}>
      <header className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              to={homePath(user)}
              className="play-heading block text-lg tracking-wide text-[var(--wood-deep)]"
            >
              SOFIAORE
            </Link>
            <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
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
            <p className="truncate text-xs font-bold text-[var(--play-ink)]">
              {userDisplayName(user)}
            </p>
            <p className="text-[10px] text-[var(--play-muted)]">ID {user.code}</p>
          </Link>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/80 px-3 py-2 ring-1 ring-[var(--wood-deep)]/12">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--play-muted)]">
              Xu chơi
            </p>
            <p className="text-sm font-bold text-[var(--wood-deep)]">
              {formatXu(play)}
            </p>
          </div>
          <div className="rounded-xl bg-white/80 px-3 py-2 ring-1 ring-[var(--wood-deep)]/12">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--play-muted)]">
              Xu quà
            </p>
            <p className="text-sm font-bold text-[var(--wood-deep)]">
              {formatXu(social)}
            </p>
          </div>
        </div>

        {showSocial && (
          <div className="mt-3">
            <SocialBar
              compact
              onAction={(a) => {
                if (a === "profile") onSocial?.(a);
                else onSocial?.(a);
              }}
            />
          </div>
        )}
      </header>
      {children}
    </AppShell>
  );
}
