import { useEffect, useState } from "react";
import { BottomSheet } from "./BottomSheet";
import {
  CARDS,
  formatXu,
  type BotPanelState,
} from "../cards";

interface BotPanelSheetProps {
  open: boolean;
  panel: BotPanelState | null | undefined;
  onClose: () => void;
  onSetCount: (count: number) => void;
}

export function BotPanelSheet({
  open,
  panel,
  onClose,
  onSetCount,
}: BotPanelSheetProps) {
  const [draft, setDraft] = useState(panel?.targetCount ?? 25);

  useEffect(() => {
    if (panel) setDraft(panel.targetCount);
  }, [panel?.targetCount]);

  const apply = () => {
    const n = Math.max(0, Math.min(50, Math.floor(draft)));
    onSetCount(n);
  };

  return (
    <BottomSheet open={open} title="Bot & Data Log" onClose={onClose} heightClass="max-h-[85vh]">
      <div className="space-y-4">
        {/* Adjust count */}
        <section className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
          <p className="text-xs font-semibold text-[var(--gold-soft)]">
            Số lượng bot (0–50)
          </p>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={50}
              value={draft}
              onChange={(e) => setDraft(Number(e.target.value))}
              className="flex-1 accent-[var(--gold)]"
            />
            <input
              type="number"
              min={0}
              max={50}
              value={draft}
              onChange={(e) => setDraft(Number(e.target.value))}
              className="w-16 rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 text-center text-sm"
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[11px] text-white/50">
              Target {panel?.targetCount ?? "—"} · Active{" "}
              {panel?.activeCount ?? "—"}
            </p>
            <button
              type="button"
              onClick={apply}
              className="rounded-full bg-[var(--gold)] px-4 py-1.5 text-xs font-bold text-[var(--ink)]"
            >
              Áp dụng
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[0, 5, 10, 25, 40, 50].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setDraft(n);
                  onSetCount(n);
                }}
                className="rounded-full bg-black/35 px-2.5 py-1 text-[10px] ring-1 ring-white/15"
              >
                {n}
              </button>
            ))}
          </div>
        </section>

        {/* Bot bets per card */}
        <section>
          <p className="mb-1.5 text-[10px] uppercase tracking-wider text-white/45">
            Tổng cược bot / lá (ván này)
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {CARDS.map((c, i) => (
              <div
                key={c.id}
                className="rounded-lg bg-black/30 px-1.5 py-1.5 text-center ring-1 ring-white/10"
              >
                <img
                  src={c.image}
                  alt=""
                  className="mx-auto h-8 w-6 rounded object-cover"
                />
                <p className="mt-0.5 text-[9px] text-[var(--gold-soft)]">
                  {formatXu(panel?.botBetsTotal?.[i] ?? 0)}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Active bots list */}
        <section>
          <p className="mb-1.5 text-[10px] uppercase tracking-wider text-white/45">
            Danh sách bot active ({panel?.bots.length ?? 0})
          </p>
          <ul className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
            {(panel?.bots ?? []).length === 0 && (
              <li className="text-xs text-white/35">Không có bot</li>
            )}
            {(panel?.bots ?? []).map((bot) => (
              <li
                key={bot.id}
                className="flex items-start gap-2 rounded-lg bg-black/25 px-2 py-1.5 ring-1 ring-white/10"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">
                    {bot.name}
                    {bot.isChaser ? (
                      <span className="ml-1 text-[9px] text-rose-300">Dí cầu</span>
                    ) : null}
                    {bot.isVip ? (
                      <span className="ml-1 text-[9px] text-[var(--gold)]">VIP</span>
                    ) : null}
                  </p>
                  {bot.bets.length === 0 ? (
                    <p className="text-[9px] text-white/30">Chưa đặt</p>
                  ) : (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {bot.bets.map((b) => {
                        const card = CARDS.find((c) => c.id === b.cardId);
                        return (
                          <span
                            key={b.cardId}
                            className="inline-flex items-center gap-1 rounded bg-white/10 px-1 py-0.5 text-[9px]"
                          >
                            <img
                              src={card?.image}
                              alt=""
                              className="h-4 w-3 rounded object-cover"
                            />
                            {formatXu(b.amount)}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Data log */}
        <section>
          <p className="mb-1.5 text-[10px] uppercase tracking-wider text-white/45">
            Data log bot
          </p>
          <ul className="max-h-52 space-y-1 overflow-y-auto rounded-xl bg-black/40 p-2 font-mono text-[10px] ring-1 ring-white/10">
            {(panel?.logs ?? []).length === 0 && (
              <li className="text-white/35">Chưa có log</li>
            )}
            {(panel?.logs ?? []).map((log) => (
              <li
                key={log.id}
                className={`border-b border-white/5 py-1 last:border-0 ${
                  log.action === "bet"
                    ? "text-emerald-200/90"
                    : log.action === "scale"
                      ? "text-[var(--gold-soft)]"
                      : "text-sky-200/80"
                }`}
              >
                <span className="text-white/35">
                  [{new Date(log.at).toLocaleTimeString("vi-VN")}] R{log.round}
                </span>{" "}
                {log.message}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </BottomSheet>
  );
}
