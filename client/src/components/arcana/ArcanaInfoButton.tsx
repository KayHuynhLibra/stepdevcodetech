import type { ReactNode } from "react";

export function ArcanaInfoButton({
  children,
  onClick,
  ariaLabel,
}: {
  children: ReactNode;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="arcana-info-btn shrink-0 rounded-md bg-white/70 px-1.5 py-0.5 text-[10px] font-bold text-[var(--wood-deep)] ring-1 ring-[var(--wood-deep)]/20 hover:bg-white"
    >
      {children}
    </button>
  );
}
