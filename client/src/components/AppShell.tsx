import type { ReactNode } from "react";

interface AppShellProps {
  children: ReactNode;
  className?: string;
  /** Căn giữa nội dung (login) */
  center?: boolean;
  maxWidth?: "sm" | "md" | "lg";
}

const MAX: Record<NonNullable<AppShellProps["maxWidth"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

/** Nền sáng + khung an toàn mobile cho mọi trang */
export function AppShell({
  children,
  className = "",
  center = false,
  maxWidth = "md",
}: AppShellProps) {
  return (
    <div
      className={`app-shell relative min-h-dvh overflow-x-hidden ${className}`}
    >
      <div
        className={`app-shell-deco pointer-events-none absolute inset-0`}
        aria-hidden
      />
      <div
        className={`relative z-[1] mx-auto w-full ${MAX[maxWidth]} px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] ${
          center
            ? "flex min-h-dvh flex-col items-center justify-center"
            : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}
