import { formatXu, type BalanceLeaderboardEntry } from "../cards";
import { normalizeAvatar } from "../avatars";

interface BalanceLeaderboardSheetProps {
  open: boolean;
  rows: BalanceLeaderboardEntry[];
  onClose: () => void;
  onOpenPlayer?: (row: BalanceLeaderboardEntry) => void;
}

/**
 * Popup nhỏ neo phía trên — không phải zone full-width dưới bàn.
 * Không đụng BXH Cao thủ dự đoán.
 */
export function BalanceLeaderboardSheet({
  open,
  rows,
  onClose,
  onOpenPlayer,
}: BalanceLeaderboardSheetProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/45 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
      role="dialog"
      aria-modal="true"
      aria-label="Đại gia"
      onClick={onClose}
    >
      <div
        className="mt-1 w-full max-w-sm overflow-hidden rounded-2xl bg-[#1a120c] shadow-2xl ring-1 ring-[var(--gold)]/35"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5">
          <div className="min-w-0">
            <p className="play-heading truncate text-sm !text-[var(--gold-soft)]">
              Đại gia
            </p>
            <p className="text-[10px] text-white/45">Top xu đang cầm · điểm ảo</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/80"
          >
            Đóng
          </button>
        </div>

        <ul className="max-h-[min(52vh,22rem)] space-y-1 overflow-y-auto p-2">
          {rows.length === 0 && (
            <li className="py-8 text-center text-[11px] text-white/40">
              Chưa có dữ liệu.
            </li>
          )}
          {rows.slice(0, 15).map((row) => (
            <li
              key={`${row.rank}-${row.userId ?? row.name}`}
              className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${
                row.isYou
                  ? "bg-[var(--jade)]/20 ring-1 ring-[var(--jade-soft)]/40"
                  : "bg-white/5"
              }`}
            >
              <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-[var(--gold-soft)]">
                {row.rank}
              </span>
              <button
                type="button"
                className="shrink-0"
                title="Xem thông tin"
                onClick={() => onOpenPlayer?.(row)}
              >
                <img
                  src={normalizeAvatar(row.avatar)}
                  alt=""
                  className="h-8 w-8 rounded-full object-cover ring-1 ring-[var(--gold)]/35"
                  onError={(e) => {
                    const el = e.currentTarget;
                    if (el.src.includes("avatar-default")) return;
                    el.src = "/assets/ui/avatar-default.png";
                  }}
                />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-white">
                  {row.name}
                  {row.isYou ? " · Bạn" : ""}
                </p>
                <p className="flex items-center gap-1 text-[11px] font-semibold tabular-nums text-amber-300/90">
                  <img
                    src="/assets/ui/icon-coin-xu.png"
                    alt=""
                    className="h-3 w-3 rounded-full object-cover"
                  />
                  {formatXu(row.balance)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
