/** Thanh MXH mỏng — gift / ring / voice / noti (callbacks mở sheet sẵn có). */

export type SocialBarAction = "gift" | "ring" | "voice" | "noti" | "profile";

export function SocialBar({
  onAction,
  compact,
}: {
  onAction?: (action: SocialBarAction) => void;
  compact?: boolean;
}) {
  const items: { id: SocialBarAction; label: string }[] = [
    { id: "gift", label: "Quà" },
    { id: "ring", label: "Nhẫn" },
    { id: "voice", label: "Voice" },
    { id: "noti", label: "Thông báo" },
  ];

  return (
    <nav
      className={`social-bar flex flex-wrap gap-1.5 ${compact ? "justify-center" : ""}`}
      aria-label="MXH"
    >
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          onClick={() => onAction?.(it.id)}
          className="rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-bold text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/15 transition hover:bg-white"
        >
          {it.label}
        </button>
      ))}
    </nav>
  );
}
