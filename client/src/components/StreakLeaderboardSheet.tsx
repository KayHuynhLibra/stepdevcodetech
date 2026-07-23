import { BottomSheet } from "./BottomSheet";
import { RankBadge, sheetRowClass } from "./RankBadge";

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
        {rows.map((row, i) => {
          const rank = i + 1;
          return (
            <li key={`${row.at}-${row.name}-${row.streak}`} className={sheetRowClass(rank)}>
              <RankBadge rank={rank} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {row.name}
                </p>
                <p className="lb-sheet-meta">
                  {row.streak} ván liên tiếp
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}
