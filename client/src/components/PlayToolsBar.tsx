import { useEffect, useRef, useState } from "react";

interface PlayToolsBarProps {
  muted: boolean;
  showBalance?: boolean;
  jackpotLabel?: string;
  /** Giải thích minh bạch cơ chế hũ */
  jackpotHint?: string;
  voiceLabel?: string;
  voiceLive?: boolean;
  onRules: () => void;
  onGift: () => void;
  onRing: () => void;
  onBalance?: () => void;
  onToggleMute: () => void;
  onVoice?: () => void;
}

/** Nút «Công cụ» → bar popup (Luật / Quà / Nhẫn / Đại gia / Âm / Hũ / Room). */
export function PlayToolsBar({
  muted,
  showBalance = false,
  jackpotLabel,
  jackpotHint,
  voiceLabel,
  voiceLive = false,
  onRules,
  onGift,
  onRing,
  onBalance,
  onToggleMute,
  onVoice,
}: PlayToolsBarProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false);
      }
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

  const run = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  return (
    <div className="play-tools-bar" ref={rootRef}>
      <button
        type="button"
        className={`play-tools-bar__trigger ${open ? "is-open" : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Công cụ bàn chơi"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="play-tools-bar__trigger-dots" aria-hidden>
          ···
        </span>
        <span className="play-tools-bar__trigger-label">Công cụ</span>
      </button>

      {open && (
        <div
          className="play-tools-bar__popup"
          role="dialog"
          aria-label="Công cụ bàn chơi"
        >
          <div className="play-tools-bar__rail">
            <button
              type="button"
              className="play-tools-bar__pill"
              onClick={() => run(onRules)}
            >
              Luật
            </button>
            <button
              type="button"
              className="play-tools-bar__pill play-tools-bar__pill--gift"
              onClick={() => run(onGift)}
            >
              Quà
            </button>
            <button
              type="button"
              className="play-tools-bar__pill play-tools-bar__pill--ring"
              onClick={() => run(onRing)}
            >
              Nhẫn
            </button>
            {showBalance && onBalance && (
              <button
                type="button"
                className="play-tools-bar__pill play-tools-bar__pill--whale"
                onClick={() => run(onBalance)}
              >
                Đại gia
              </button>
            )}
            <button
              type="button"
              className={`play-tools-bar__pill play-tools-bar__pill--audio ${
                muted ? "is-muted" : ""
              }`}
              title={muted ? "Bật tiếng" : "Tắt tiếng"}
              onClick={() => {
                onToggleMute();
              }}
            >
              {muted ? "Tắt" : "Âm"}
            </button>
            {jackpotLabel && (
              <span
                className="play-tools-bar__pill play-tools-bar__pill--pot"
                title={jackpotHint || "Quỹ hũ Tarot"}
              >
                {jackpotLabel}
              </span>
            )}
            {onVoice && (
              <button
                type="button"
                className={`play-tools-bar__pill play-tools-bar__pill--voice ${
                  voiceLive ? "is-live" : ""
                }`}
                onClick={() => run(onVoice)}
              >
                {voiceLabel || "Room"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
