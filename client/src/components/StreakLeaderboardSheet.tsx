import { BottomSheet } from "./BottomSheet";

export type StreakHighlightRow = {
  name: string;
  streak: number;
  at: number;
};

interface StreakLeaderboardSheetProps {
  open: boolean;
  rows: StreakHighlightRow[];
  onClose: () => void;
}

export function StreakLeaderboardSheet({
  open,
  rows,
  onClose,
}: StreakLeaderboardSheetProps) {
  return (
    <BottomSheet open={open} title="Chuỗi thắng" onClose={onClose}>
      <p className="mb-3 text-center text-[11px] text-white/45">
        Thắng liên tiếp gần đây trên bàn
      </p>
      {rows.length === 0 && (
        <p className="py-10 text-center text-sm text-white/40">
          Chưa có chuỗi thắng nổi bật
        </p>
      )}
      <ul className="space-y-2">
        {rows.map((row, i) => (
          <li
            key={`${row.at}-${row.name}-${row.streak}`}
            className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/10"
          >
            <span className="w-6 text-center font-display text-sm font-bold text-[var(--jade-soft)] tabular-nums">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {row.name}
              </p>
              <p className="text-[11px] text-amber-200/90 tabular-nums">
                {row.streak} ván liên tiếp
              </p>
            </div>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
