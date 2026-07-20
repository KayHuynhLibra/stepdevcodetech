import { formatXu } from "../../cards";

export interface ArcanaRecentRow {
  id: string;
  at?: number;
  winId: number;
  won: boolean;
  stake?: number;
  profit?: number;
}

export function ArcanaRecentTable({
  rows,
  slotName,
  highlightId,
  compact,
}: {
  rows: ArcanaRecentRow[];
  slotName: (winId: number) => string;
  highlightId?: string | null;
  compact?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-[10px] text-[var(--play-muted)]">Chưa có kết quả gần đây</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table
        className={`arcana-paytable w-full text-[10px] ${compact ? "" : "min-w-[20rem]"}`}
      >
        <thead>
          <tr className="border-b border-[var(--gold)]/25 text-[var(--play-muted)]">
            {!compact && <th className="py-1 pr-1 text-left font-semibold">Giờ</th>}
            <th className="py-1 pr-1 text-left font-semibold">Ra</th>
            <th className="py-1 pr-1 text-center font-semibold">KQ</th>
            <th className="py-1 pr-1 text-right font-semibold">Cược</th>
            <th className="py-1 text-right font-semibold">+/-</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const hi = highlightId === r.id;
            const time =
              r.at != null
                ? new Date(r.at).toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "";
            const profit = r.profit ?? (r.won ? 0 : -(r.stake ?? 0));
            return (
              <tr
                key={r.id}
                className={`border-b border-[var(--wood-deep)]/8 ${
                  hi ? "bg-[var(--gold)]/15 ring-1 ring-[var(--gold)]/40" : ""
                }`}
              >
                {!compact && (
                  <td className="py-1 pr-1 tabular-nums text-[var(--play-muted)]">
                    {time}
                  </td>
                )}
                <td className="max-w-[5rem] truncate py-1 pr-1 font-semibold">
                  {slotName(r.winId)}
                </td>
                <td
                  className={`py-1 pr-1 text-center font-bold ${
                    r.won ? "text-[var(--jade-deep)]" : "text-rose-700"
                  }`}
                >
                  {r.won ? "Thắng" : "Thua"}
                </td>
                <td className="py-1 pr-1 text-right tabular-nums">
                  {r.stake != null ? formatXu(r.stake) : "—"}
                </td>
                <td
                  className={`py-1 text-right font-play font-bold tabular-nums ${
                    profit >= 0 ? "text-[var(--jade-deep)]" : "text-rose-700"
                  }`}
                >
                  {r.stake != null || r.profit != null
                    ? `${profit >= 0 ? "+" : ""}${formatXu(profit)}`
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
