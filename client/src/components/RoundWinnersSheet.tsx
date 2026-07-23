import { BottomSheet } from "./BottomSheet";
import { formatXu, type RoundTopWinner } from "../cards";
import { normalizeAvatar } from "../avatars";
import { RankBadge, sheetRowClass } from "./RankBadge";

interface RoundWinnersSheetProps {
  open: boolean;
  rows: RoundTopWinner[];
  onClose: () => void;
  onOpenPlayer?: (row: RoundTopWinner) => void;
}

export function RoundWinnersSheet({
  open,
  rows,
  onClose,
  onOpenPlayer,
}: RoundWinnersSheetProps) {
  return (
    <BottomSheet open={open} title="Top ván vừa" onClose={onClose}>
      <p className="mb-3 text-center text-[11px] text-white/45">
        Lợi nhuận cao nhất ván vừa rồi
      </p>
      {rows.length === 0 && (
        <p className="py-10 text-center text-sm text-white/40">
          Chưa có top ván này
        </p>
      )}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={`${row.rank}-${row.name}`}
            className={sheetRowClass(row.rank, row.isYou)}
          >
            <RankBadge rank={row.rank} />
            <button
              type="button"
              className="shrink-0"
              title="Xem thông tin"
              onClick={() => onOpenPlayer?.(row)}
            >
              <img
                src={normalizeAvatar(row.avatar)}
                alt=""
                className="h-9 w-9 rounded-full object-cover ring-1 ring-[var(--gold)]/40"
                onError={(e) => {
                  const el = e.currentTarget;
                  if (el.src.includes("avatar-default")) return;
                  el.src = "/assets/ui/avatar-default.png";
                }}
              />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {row.name}
                {row.isYou ? " (Bạn)" : ""}
              </p>
              <p className="lb-sheet-meta">+{formatXu(row.profit)} xu</p>
            </div>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
