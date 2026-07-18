import { BottomSheet } from "./BottomSheet";
import { formatXu, type LeaderboardEntry } from "../cards";

interface LeaderboardSheetProps {
  open: boolean;
  rows: LeaderboardEntry[];
  onClose: () => void;
}

export function LeaderboardSheet({
  open,
  rows,
  onClose,
}: LeaderboardSheetProps) {
  return (
    <BottomSheet open={open} title="Cao thủ dự đoán" onClose={onClose}>
      <p className="mb-3 text-center text-[11px] text-white/45">
        Top thắng trong ngày · reset 00:00
      </p>
      {rows.length === 0 && (
        <p className="py-10 text-center text-sm text-white/40">
          Chưa có ai thắng hôm nay — hãy là người đầu tiên!
        </p>
      )}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={`${row.rank}-${row.name}`}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ${
              row.isYou
                ? "bg-[var(--gold)]/15 ring-[var(--gold)]/40"
                : "bg-white/5 ring-white/10"
            }`}
          >
            <span className="w-6 text-center font-display text-sm font-bold text-[var(--gold-soft)]">
              {row.rank}
            </span>
            <img
              src={row.avatar}
              alt=""
              className="h-9 w-9 rounded-full object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {row.name}
                {row.isYou ? " (Bạn)" : ""}
              </p>
              <p className="text-[11px] text-white/55">
                Thưởng hôm nay: {formatXu(row.winToday)} xu
              </p>
            </div>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
