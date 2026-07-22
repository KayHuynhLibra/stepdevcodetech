import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CARDS, formatXu, type StakeEntry } from "../cards";
import { BottomSheet } from "./BottomSheet";

interface MyRoundsSheetProps {
  open: boolean;
  stakes: StakeEntry[];
  loading?: boolean;
  error?: string | null;
  /** Guest / chưa đăng nhập */
  needsLogin?: boolean;
  onClose: () => void;
}

function cardName(id: number) {
  return CARDS.find((c) => c.id === id)?.nameVi ?? `Lá ${id}`;
}

function cardDef(id: number) {
  return CARDS.find((c) => c.id === id);
}

interface RoundGroup {
  key: string;
  round: number;
  at: number;
  winningCardId: number;
  stakes: StakeEntry[];
  profit: number;
  stake: number;
  won: boolean;
}

function groupByRound(stakes: StakeEntry[]): RoundGroup[] {
  const map = new Map<string, RoundGroup>();
  for (const b of stakes) {
    // Cùng ván được ghi cùng timestamp trong recordRoundStakes
    const key = `${b.round}-${b.at}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        round: b.round,
        at: b.at,
        winningCardId: b.winningCardId,
        stakes: [],
        profit: 0,
        stake: 0,
        won: false,
      };
      map.set(key, g);
    }
    g.stakes.push(b);
    g.profit += b.profit;
    g.stake += b.amount;
    if (b.result === "win") g.won = true;
  }
  // Giữ thứ tự lá theo cardId cho dễ nhìn
  for (const g of map.values()) {
    g.stakes.sort((a, b) => a.cardId - b.cardId);
  }
  return [...map.values()].sort((a, b) => b.at - a.at);
}

export function MyRoundsSheet({
  open,
  stakes,
  loading,
  error,
  needsLogin,
  onClose,
}: MyRoundsSheetProps) {
  const wins = stakes.filter((b) => b.result === "win").length;
  const losses = stakes.filter((b) => b.result === "lose").length;
  const profitTotal = stakes.reduce((s, b) => s + b.profit, 0);
  const rounds = useMemo(() => groupByRound(stakes), [stakes]);

  return (
    <BottomSheet
      open={open}
      title="Lịch sử của tôi"
      onClose={onClose}
      heightClass="h-[90vh] max-h-[90vh]"
    >
      <div className="flex flex-col gap-3 pb-4">
        {needsLogin ? (
          <div className="rounded-xl bg-white/8 px-4 py-6 text-center ring-1 ring-white/10">
            <p className="text-sm text-white/80">
              Đăng nhập để lưu và xem lịch sử thắng/thua.
            </p>
            <Link
              to="/login"
              onClick={onClose}
              className="mt-3 inline-block text-sm font-semibold text-[var(--jade-soft)] underline-offset-2 hover:underline"
            >
              Đăng nhập ›
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-white/8 px-3 py-2.5 ring-1 ring-white/10">
              <div className="text-center">
                <p className="text-[10px] text-white/45">Thắng</p>
                <p className="font-play text-base font-bold tabular-nums text-[var(--jade-soft)]">
                  {loading ? "—" : wins}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-white/45">Thua</p>
                <p className="font-play text-base font-bold tabular-nums text-rose-300">
                  {loading ? "—" : losses}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-white/45">Lãi / lỗ</p>
                <p
                  className={`font-play text-base font-bold tabular-nums ${
                    profitTotal >= 0
                      ? "text-[var(--jade-soft)]"
                      : "text-rose-300"
                  }`}
                >
                  {loading
                    ? "—"
                    : `${profitTotal > 0 ? "+" : ""}${formatXu(profitTotal)}`}
                </p>
              </div>
            </div>

            {error && (
              <p className="text-center text-xs font-medium text-rose-300">
                {error}
              </p>
            )}

            {loading && (
              <p className="py-6 text-center text-xs text-white/40">
                Đang tải…
              </p>
            )}

            {!loading && !error && stakes.length === 0 && (
              <p className="py-8 text-center text-xs text-white/40">
                Chưa có ván nào — đặt xu để ghi lịch sử.
              </p>
            )}

            {!loading && rounds.length > 0 && (
              <ul className="space-y-2">
                {rounds.map((g) => {
                  const winCard = cardDef(g.winningCardId);
                  return (
                    <li
                      key={g.key}
                      className="rounded-xl bg-white/8 px-2.5 py-2 ring-1 ring-white/10"
                    >
                      <div className="mb-1.5 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white/90">
                            Ván #{g.round}
                            <span className="ml-1.5 font-normal text-white/45">
                              · thắng {cardName(g.winningCardId)}
                            </span>
                          </p>
                          <p className="text-[10px] text-white/40">
                            {new Date(g.at).toLocaleString("vi-VN")}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p
                            className={`font-play text-xs font-bold tabular-nums ${
                              g.profit >= 0
                                ? "text-[var(--jade-soft)]"
                                : "text-rose-300"
                            }`}
                          >
                            {g.profit > 0 ? "+" : ""}
                            {formatXu(g.profit)}
                          </p>
                          <p className="text-[10px] text-white/40">
                            xu {formatXu(g.stake)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-end gap-1.5">
                        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-0.5">
                          {g.stakes.map((b) => {
                            const c = cardDef(b.cardId);
                            const isWin = b.result === "win";
                            return (
                              <div
                                key={b.id}
                                className={`relative flex shrink-0 flex-col items-center gap-0.5 rounded-lg px-1 py-1 ${
                                  isWin
                                    ? "bg-[var(--jade)]/25 ring-1 ring-[var(--jade-soft)]/60"
                                    : "bg-black/20 ring-1 ring-white/10"
                                }`}
                                title={`${cardName(b.cardId)} · ${formatXu(b.amount)}`}
                              >
                                <img
                                  src={c?.image}
                                  alt={c?.nameVi ?? `#${b.cardId}`}
                                  className="h-11 w-8 rounded object-cover"
                                />
                                <span className="font-play absolute left-0.5 top-0.5 rounded bg-black/70 px-0.5 text-[8px] font-bold text-[var(--gold-soft)] tabular-nums">
                                  {b.cardId}
                                </span>
                                <span className="font-play max-w-[2.1rem] truncate text-[9px] font-semibold text-white/75 tabular-nums">
                                  {formatXu(b.amount)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        {winCard && (
                          <div
                            className="flex shrink-0 flex-col items-center gap-0.5 rounded-lg bg-[var(--gold)]/15 px-1 py-1 ring-1 ring-[var(--gold)]/45"
                            title={`Lá mở thưởng: ${winCard.nameVi}`}
                          >
                            <span className="text-[8px] font-bold uppercase tracking-wide text-[var(--gold-soft)]/80">
                              Win
                            </span>
                            <img
                              src={winCard.image}
                              alt={winCard.nameVi}
                              className="h-11 w-8 rounded object-cover"
                            />
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="text-center text-[10px] text-white/35">
              Mỗi ván hiện toàn bộ lá bạn đã chọn + lá mở thưởng
            </p>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
