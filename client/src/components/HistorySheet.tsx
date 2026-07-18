import { BottomSheet } from "./BottomSheet";
import { CARDS, type RoundResult } from "../cards";

interface HistorySheetProps {
  open: boolean;
  rows: RoundResult[];
  onClose: () => void;
}

export function HistorySheet({ open, rows, onClose }: HistorySheetProps) {
  return (
    <BottomSheet
      open={open}
      title="Chi tiết mở thưởng"
      onClose={onClose}
      heightClass="h-[90vh] max-h-[90vh]"
    >
      <div className="overflow-x-auto pb-4">
        <table className="w-full min-w-[340px] border-collapse text-center text-[11px]">
          <thead className="sticky top-0 z-20 bg-[#121826]">
            <tr>
              <th className="sticky left-0 z-30 bg-[#121826] px-1 py-2 text-white/50">
                Ván
              </th>
              {CARDS.map((c) => (
                <th key={c.id} className="px-0.5 py-1">
                  <img
                    src={c.image}
                    alt={c.nameVi}
                    className="mx-auto h-9 w-7 rounded object-cover ring-1 ring-white/15"
                  />
                  <div className="mt-0.5 text-[9px] text-[var(--gold)]/80">
                    {c.id} · x{c.multiplier}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-white/40">
                  Chưa có lịch sử
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.round} className="border-t border-white/5">
                <td className="sticky left-0 bg-[#121826] px-1 py-2.5 font-semibold text-[var(--gold-soft)]">
                  {row.round}
                </td>
                {CARDS.map((c) => (
                  <td key={c.id} className="py-2.5">
                    {row.win === c.id ? (
                      <span
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--gold)] text-[11px] font-bold text-[#1a1208] shadow-[0_0_10px_rgba(212,168,75,0.55)]"
                        title="Lá thắng"
                      >
                        ★
                      </span>
                    ) : (
                      <span className="text-white/12">·</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="pb-2 text-center text-[10px] text-white/35">
        Tối đa 30 ván gần nhất — soi cầu theo cột ★
      </p>
    </BottomSheet>
  );
}
