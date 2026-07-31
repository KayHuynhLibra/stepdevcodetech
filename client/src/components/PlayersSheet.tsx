import { useMemo, useState } from "react";
import type { OnlinePlayerPublic } from "../cards";
import { BottomSheet } from "./BottomSheet";
import { CultivationChip } from "./CultivationChip";
import { PlayLevelBadge } from "./PlayLevelBadge";

interface PlayersSheetProps {
  open: boolean;
  players: OnlinePlayerPublic[];
  onClose: () => void;
  onSelectPlayer: (p: OnlinePlayerPublic) => void;
  onGift?: (p: OnlinePlayerPublic) => void;
  onRing?: (p: OnlinePlayerPublic) => void;
  onMention?: (p: OnlinePlayerPublic) => void;
}

export function PlayersSheet({
  open,
  players,
  onClose,
  onSelectPlayer,
  onGift,
  onRing,
  onMention,
}: PlayersSheetProps) {
  const [q, setQ] = useState("");

  const humans = useMemo(() => {
    const list = players.filter((p) => !p.isBot);
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((p) =>
      `${p.name} ${p.code ?? ""} ${p.userId ?? ""}`
        .toLowerCase()
        .includes(needle),
    );
  }, [players, q]);

  return (
    <BottomSheet
      open={open}
      title="Người chơi trong phòng"
      onClose={onClose}
      heightClass="max-h-[80vh]"
    >
      <p className="-mt-1 mb-2 text-[11px] text-[var(--jade-soft)]/70">
        {humans.length} người · hồ sơ / quà / nhẫn / @chat
      </p>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Tìm tên / ID…"
        className="form-input mb-2 w-full"
      />

      <ul className="min-h-0 space-y-1.5">
        {humans.length === 0 && (
          <li className="py-8 text-center text-sm text-white/40">
            {q.trim() ? "Không khớp" : "Chưa có ai trong phòng"}
          </li>
        )}
        {humans.map((p) => (
          <li key={p.id} className="form-row form-row--dark">
            <button
              type="button"
              onClick={() => onSelectPlayer(p)}
              className="flex w-full items-center gap-2.5 text-left transition active:scale-[0.99]"
            >
              <img
                src={p.avatar || "/assets/ui/avatar-default.png"}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-[var(--gold)]/35"
              />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1 truncate text-sm font-semibold text-white/95">
                  <span className="truncate">{p.name}</span>
                  {p.isVip ? (
                    <span className="text-[10px] text-amber-300">VIP</span>
                  ) : null}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-1">
                  <span className="text-[10px] text-white/45">
                    {p.code ? `ID ${p.code}` : "Khách"}
                  </span>
                  {p.roundsPlayed != null ? (
                    <PlayLevelBadge rounds={p.roundsPlayed} size="sm" />
                  ) : p.playLevel != null ? (
                    <span className="text-[10px] font-bold text-[var(--gold-soft)]">
                      Lv{p.playLevel}
                    </span>
                  ) : null}
                  {p.cultivationRank ? (
                    <CultivationChip
                      rank={p.cultivationRank}
                      className="!px-1.5 !py-0 !text-[8px]"
                    />
                  ) : null}
                </div>
              </div>
            </button>
            <div className="mt-1.5 flex flex-wrap gap-1">
              <button
                type="button"
                className="form-pill"
                onClick={() => onSelectPlayer(p)}
              >
                Hồ sơ
              </button>
              {onGift && (
                <button
                  type="button"
                  className="form-pill form-pill--jade"
                  onClick={() => onGift(p)}
                >
                  Quà
                </button>
              )}
              {onRing && (
                <button
                  type="button"
                  className="form-pill form-pill--gold"
                  onClick={() => onRing(p)}
                >
                  Nhẫn
                </button>
              )}
              {onMention && (
                <button
                  type="button"
                  className="form-pill"
                  onClick={() => onMention(p)}
                >
                  @Chat
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
