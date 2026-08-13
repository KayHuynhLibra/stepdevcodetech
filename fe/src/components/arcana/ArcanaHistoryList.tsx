import { formatXu } from "../../cards";
import type { SpinResult } from "./arcanaTypes";

export function ArcanaHistoryList({
  spins,
  slotName,
  view,
}: {
  spins: SpinResult[];
  slotName: (winId: number) => string;
  view: "list" | "table";
}) {
  if (view === "table") {
    return (
      <div className="overflow-x-auto">
        <table className="arcana-paytable w-full min-w-[18rem] text-xs">
          <thead>
            <tr className="border-b border-[var(--gold)]/25 text-[10px] text-[var(--play-muted)]">
              <th className="py-1 text-left">Ra</th>
              <th className="py-1 text-center">KQ</th>
              <th className="py-1 text-right">Xu đặt</th>
              <th className="py-1 text-right">Thưởng</th>
              <th className="py-1 text-right">Lãi</th>
            </tr>
          </thead>
          <tbody>
            {spins.map((sp) => (
              <tr
                key={sp.id}
                className="border-b border-[var(--wood-deep)]/8"
              >
                <td className="py-1.5 pr-1 font-semibold">
                  {slotName(sp.winId)}
                </td>
                <td
                  className={`py-1.5 text-center font-bold ${
                    sp.won ? "text-[var(--jade-deep)]" : "text-rose-600"
                  }`}
                >
                  {sp.won ? "Thắng" : "Thua"}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {formatXu(sp.stake)}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {formatXu(sp.payout)}
                </td>
                <td
                  className={`py-1.5 text-right font-play font-bold tabular-nums ${
                    sp.profit >= 0
                      ? "text-[var(--jade-deep)]"
                      : "text-rose-700"
                  }`}
                >
                  {sp.profit >= 0 ? "+" : ""}
                  {formatXu(sp.profit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {spins.map((sp) => {
        const win = slotName(sp.winId);
        const picks = sp.pickIds?.length ? sp.pickIds : [sp.pickId];
        return (
          <li
            key={sp.id}
            className="rounded-lg bg-white/70 px-2.5 py-2 text-xs ring-1 ring-[var(--wood-deep)]/10"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-[var(--play-ink)]">
                  Ra: {win}
                  <span
                    className={`ml-1 ${
                      sp.won ? "text-[var(--jade-deep)]" : "text-rose-600"
                    }`}
                  >
                    {sp.won ? "Thắng" : "Thua"}
                  </span>
                </p>
                <p className="mt-0.5 text-[10px] text-[var(--play-muted)]">
                  Chọn: {picks.map((id) => slotName(id)).join(", ")}
                </p>
                <p className="text-[10px] text-[var(--play-muted)]">
                  {sp.at ? new Date(sp.at).toLocaleString("vi-VN") : ""} · xu đặt{" "}
                  {formatXu(sp.stake)}
                </p>
              </div>
              <span
                className={`font-play shrink-0 font-bold tabular-nums ${
                  sp.profit >= 0
                    ? "text-[var(--jade-deep)]"
                    : "text-rose-700"
                }`}
              >
                {sp.profit >= 0 ? "+" : ""}
                {formatXu(sp.profit)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
