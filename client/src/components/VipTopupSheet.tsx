import { formatXu } from "../cards";

export interface TopupRow {
  rank: number;
  userId: string;
  name: string;
  avatar: string;
  code: string | null;
  totalAmount: number;
  redeemCount: number;
  lastAt: number;
}

interface VipTopupSheetProps {
  open: boolean;
  loading?: boolean;
  totalXu: number;
  rows: TopupRow[];
  onClose: () => void;
  onSelect?: (row: TopupRow) => void;
}

export function VipTopupSheet({
  open,
  loading,
  totalXu,
  rows,
  onClose,
  onSelect,
}: VipTopupSheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div className="sheet-shell relative z-10 mb-0 flex max-h-[75vh] w-full max-w-md flex-col rounded-t-2xl px-4 pb-5 pt-4 shadow-xl ring-1 ring-[var(--jade)]/40 sm:mb-0 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display text-base text-[var(--jade-soft)]">
              Người đã nạp xu
            </p>
            <p className="text-[11px] text-white/50">
              Tổng đã nạp{" "}
              <span className="font-semibold text-amber-200/90 tabular-nums">
                {formatXu(totalXu)}
              </span>{" "}
              xu
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-[var(--cream)]/55 ring-1 ring-white/10"
          >
            Đóng
          </button>
        </div>

        <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
          {loading && (
            <li className="py-8 text-center text-sm text-white/40">
              Đang tải…
            </li>
          )}
          {!loading && rows.length === 0 && (
            <li className="py-8 text-center text-sm text-white/40">
              Chưa có ai nạp xu
            </li>
          )}
          {!loading &&
            rows.map((row) => (
              <li key={row.userId}>
                <button
                  type="button"
                  onClick={() => onSelect?.(row)}
                  className="flex w-full items-center gap-2.5 rounded-xl bg-white/5 px-2.5 py-2 text-left ring-1 ring-white/8 transition active:scale-[0.99]"
                >
                  <span className="font-play w-5 shrink-0 text-center text-xs font-bold text-[var(--gold-soft)] tabular-nums">
                    {row.rank}
                  </span>
                  <img
                    src={row.avatar || "/assets/ui/avatar-default.png"}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-[var(--gold)]/35"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white/95">
                      {row.name}
                    </p>
                    <p className="text-[10px] text-white/45">
                      {row.redeemCount} lần nạp
                      {row.code ? ` · ID ${row.code}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 font-play text-xs font-bold text-amber-200 tabular-nums">
                    {formatXu(row.totalAmount)}
                  </span>
                </button>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
