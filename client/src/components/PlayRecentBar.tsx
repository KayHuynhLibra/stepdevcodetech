import { useEffect, useRef, useState } from "react";

export interface PlayRecentItem {
  key: string;
  image?: string;
  badge: string | number;
  title?: string;
}

interface PlayRecentBarProps {
  items: PlayRecentItem[];
  onOpenFull: () => void;
  emptyText?: string;
  /** Preview count on trigger */
  previewCount?: number;
}

/** Trigger gọn → popup bar kết quả gần đây (không chiếm chỗ bàn Tarot). */
export function PlayRecentBar({
  items,
  onOpenFull,
  emptyText = "Chưa có kết quả",
  previewCount = 5,
}: PlayRecentBarProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const preview = items.slice(0, previewCount);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="play-recent-bar" ref={rootRef}>
      <button
        type="button"
        className={`play-recent-bar__trigger ${open ? "is-open" : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Kết quả gần đây"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="play-recent-bar__trigger-label">KQ gần đây</span>
        <span className="play-recent-bar__preview" aria-hidden>
          {preview.length === 0 ? (
            <span className="play-recent-bar__empty-hint">—</span>
          ) : (
            preview.map((it) => (
              <span key={it.key} className="play-recent-bar__dot">
                {it.badge}
              </span>
            ))
          )}
        </span>
        <span className="play-recent-bar__chev" aria-hidden>
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <div
          className="play-recent-bar__popup"
          role="dialog"
          aria-label="Kết quả gần đây"
        >
          <div className="play-recent-bar__head">
            <p className="play-section-title mb-0">Kết quả gần đây</p>
            <button
              type="button"
              className="play-recent-bar__full"
              onClick={() => {
                setOpen(false);
                onOpenFull();
              }}
            >
              Chi tiết ›
            </button>
          </div>
          <div className="play-recent-bar__rail">
            {items.length === 0 && (
              <span className="px-1 text-xs text-[var(--play-muted)]">
                {emptyText}
              </span>
            )}
            {items.map((item) => (
              <span
                key={item.key}
                className="relative h-12 w-9 shrink-0 overflow-hidden rounded shadow ring-1 ring-[var(--gold)]/35"
                title={item.title}
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt=""
                    decoding="async"
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : null}
                <span className="font-play absolute left-0.5 top-0.5 z-[1] rounded bg-[var(--wood-deep)]/92 px-1 text-[9px] font-bold leading-tight text-[var(--gold-soft)] tabular-nums shadow-sm">
                  {item.badge}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
