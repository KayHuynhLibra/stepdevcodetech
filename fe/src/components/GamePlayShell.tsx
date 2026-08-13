import type { ReactNode } from "react";
import type { AuthUser } from "../auth";
import { GameChrome } from "./GameChrome";
import { VirtualPlayFooter } from "./VirtualPlayFooter";

/**
 * Shell mỏng cho bàn chơi: GameChrome + nội dung + footer compliance.
 * Không thay AppShell / atmosphere riêng của từng game.
 */
export function GamePlayShell({
  title,
  active,
  user,
  guestCode,
  playBalance,
  socialBalance,
  tools,
  banner,
  showNav = false,
  footerCompact = false,
  footerClassName = "mt-3 px-3 pb-3",
  children,
}: {
  title: string;
  active?: string;
  user?: AuthUser | null;
  guestCode?: string | null;
  playBalance?: number | null;
  socialBalance?: number | null;
  tools?: ReactNode;
  banner?: ReactNode;
  showNav?: boolean;
  footerCompact?: boolean;
  footerClassName?: string;
  children: ReactNode;
}) {
  return (
    <>
      <GameChrome
        title={title}
        active={active}
        user={user}
        guestCode={guestCode}
        playBalance={playBalance}
        socialBalance={socialBalance}
        tools={tools}
        banner={banner}
        showNav={showNav}
      />
      {children}
      <VirtualPlayFooter
        className={footerClassName}
        compact={footerCompact}
      />
    </>
  );
}
