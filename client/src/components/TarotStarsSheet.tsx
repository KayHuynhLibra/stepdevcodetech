import { BottomSheet } from "./BottomSheet";
import { formatXu, type TarotStarEntry } from "../cards";
import { RankBadge, sheetRowClass } from "./RankBadge";

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
              <p className="lb-sheet-meta flex items-center gap-1">
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
