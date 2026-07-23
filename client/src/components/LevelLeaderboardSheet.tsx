import { BottomSheet } from "./BottomSheet";
import { normalizeAvatar } from "../avatars";
import { playLevelTitle } from "../playLevel";

export type LevelLeaderboardEntry = {
  rank: number;
  name: string;
  avatar: string;
  playLevel: number;
  roundsPlayed: number;
  isYou?: boolean;
  userId?: string;
  code?: string;
  isVip?: boolean;
};

interface LevelLeaderboardSheetProps {
  open: boolean;
  rows: LevelLeaderboardEntry[];
  onClose: () => void;
  onOpenPlayer?: (row: LevelLeaderboardEntry) => void;
}

export function LevelLeaderboardSheet({
  open,
  rows,
  onClose,
  onOpenPlayer,
}: LevelLeaderboardSheetProps) {
  return (
    <BottomSheet open={open} title="Cấp độ" onClose={onClose}>
      <p className="mb-3 text-center text-[11px] text-white/45">
        Top cấp theo số ván đã chơi
      </p>
      {rows.length === 0 && (
        <p className="py-10 text-center text-sm text-white/40">
          Chưa có dữ liệu cấp độ
        </p>
      )}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={`${row.rank}-${row.userId ?? row.name}`}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ${
              row.isYou
                ? "bg-[var(--jade)]/15 ring-[var(--jade-soft)]/40"
                : "bg-white/5 ring-white/10"
            }`}
          >
            <span className="w-6 text-center font-display text-sm font-bold text-[var(--gold-soft)] tabular-nums">
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
                className="h-9 w-9 rounded-full object-cover ring-1 ring-[var(--gold)]/35"
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
                {row.isYou ? " · Bạn" : ""}
                {row.isVip ? " · VIP" : ""}
              </p>
              <p className="text-[11px] text-amber-200/90 tabular-nums">
                Lv.{row.playLevel} · {playLevelTitle(row.playLevel)} ·{" "}
                {row.roundsPlayed.toLocaleString("vi-VN")} ván
              </p>
            </div>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
