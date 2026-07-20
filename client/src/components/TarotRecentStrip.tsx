import type { ReactNode } from "react";

export interface TarotRecentStripItem {
  key: string;
  image: string;
  badge: string | number;
  title?: string;
  /** Tailwind ring classes, e.g. ring-[var(--gold)]/35 */
  ringClass?: string;
}

interface TarotRecentStripProps {
  title?: string;
  items: TarotRecentStripItem[];
  emptyText: string;
  headerExtra?: ReactNode;
  className?: string;
}

/** Dải lá kết quả gần đây — cùng khung `game-task` như bàn Tarot. */
export function TarotRecentStrip({
  title = "Kết quả gần đây",
  items,
  emptyText,
  headerExtra,
  className = "mt-3",
}: TarotRecentStripProps) {
  return (
    <section
      className={`game-task tarot-recent-strip w-full overflow-hidden px-2 py-2 ${className}`}
    >
      <div className="mb-1 flex items-center gap-2 px-1">
        <p className="play-section-title mb-0 flex-1">{title}</p>
        {headerExtra}
      </div>
      <div className="tarot-recent-strip__scroll flex gap-1.5 overflow-x-auto pb-1">
        {items.length === 0 && (
          <span className="px-1 text-xs text-[var(--play-muted)]">{emptyText}</span>
        )}
        {items.map((item) => (
          <span
            key={item.key}
            className={`relative h-12 w-9 shrink-0 overflow-hidden rounded shadow ring-1 ${
              item.ringClass ?? "ring-[var(--gold)]/35"
            }`}
            title={item.title}
          >
            <img
              src={item.image}
              alt=""
              className="h-full w-full object-cover object-center"
            />
            <span className="font-play absolute left-0.5 top-0.5 z-[1] rounded bg-[var(--wood-deep)]/92 px-1 text-[9px] font-bold leading-tight text-[var(--gold-soft)] tabular-nums shadow-sm">
              {item.badge}
            </span>
          </span>
        ))}
      </div>
    </section>
  );
}
