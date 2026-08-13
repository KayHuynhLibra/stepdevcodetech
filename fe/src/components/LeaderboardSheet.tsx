import { BottomSheet } from "./BottomSheet";
import { formatXu, type LeaderboardEntry } from "../cards";
import { RankBadge, sheetRowClass } from "./RankBadge";

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
            className={sheetRowClass(row.rank, row.isYou)}
          >
            <RankBadge rank={row.rank} />
            <img
              src={row.avatar}
              alt=""
              className="h-9 w-9 rounded-full object-cover ring-1 ring-[var(--gold)]/40"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {row.name}
                {row.isYou ? " (Bạn)" : ""}
              </p>
              <p className="lb-sheet-meta">
                Thưởng hôm nay: {formatXu(row.winToday)} xu
              </p>
            </div>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
