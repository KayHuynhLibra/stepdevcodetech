import { BottomSheet } from "./BottomSheet";
import { formatXu, type TarotStarEntry } from "../cards";

interface TarotStarsSheetProps {
  open: boolean;
  rows: TarotStarEntry[];
  onClose: () => void;
}

export function TarotStarsSheet({ open, rows, onClose }: TarotStarsSheetProps) {
  return (
    <BottomSheet open={open} title="Sao bài Tarot" onClose={onClose}>
      <p className="mb-3 text-center text-[11px] text-[var(--cream)]/55">
        Xếp hạng theo số xu dùng dự đoán mỗi tuần
      </p>
      {rows.length === 0 && (
        <p className="py-10 text-center text-sm text-white/40">
          Chưa có ai đặt xu tuần này — hãy là người đầu tiên!
        </p>
      )}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={`${row.rank}-${row.name}`}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ${
              row.isYou
                ? "bg-[var(--jade)]/25 ring-[var(--jade-soft)]/50"
                : "bg-white/5 ring-white/10"
            }`}
          >
            <span className="w-6 text-center font-display text-sm font-bold text-[var(--jade-soft)] tabular-nums">
              {row.rank}
            </span>
            <img
              src={row.avatar}
              alt=""
              className="h-9 w-9 rounded-full object-cover ring-1 ring-[var(--jade)]/40"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {row.name}
                {row.isYou ? " (Bạn)" : ""}
              </p>
              <p className="flex items-center gap-1 text-[11px] text-amber-200/90 tabular-nums">
                <img
                  src="/assets/ui/icon-coin-xu.png"
                  alt=""
                  className="h-3.5 w-3.5 rounded-full object-cover"
                />
                {formatXu(row.stakeWeek)} xu
              </p>
            </div>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
