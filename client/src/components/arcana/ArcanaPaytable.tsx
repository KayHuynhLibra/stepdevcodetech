import { formatXu } from "../../cards";
import {
  previewArcanaPayout,
  rarityLabel,
} from "../../lib/arcanaPayout";
import { onArcanaImgError } from "../../lib/arcanaImages";

export interface ArcanaPaytableSlot {
  id: number;
  nameVi: string;
  ratio: number;
  image: string;
  weightShare?: number;
}

export function ArcanaPaytable({
  slots,
  pickIds,
  stake,
  payoutScale,
  bare = false,
}: {
  slots: ArcanaPaytableSlot[];
  pickIds: number[];
  stake: number;
  payoutScale: number;
  bare?: boolean;
}) {
  const k = Math.max(1, pickIds.length || 1);

  const table = (
    <>
      {!bare && (
        <>
          <p className="play-heading text-center text-sm">Bảng hệ số & thưởng</p>
          <p className="mt-1 text-center text-[10px] text-[var(--play-muted)]">
            Hệ số ×N nhân vào công thức — không phải đổi 1 xu lấy N xu.
          </p>
        </>
      )}
      {bare && (
        <p className="mb-2 text-[10px] text-[var(--play-muted)]">
          Hệ số ×N nhân vào phần stake Arcana. Chip Đỏ/Đen/Chẵn/Lẻ chia stake
          50/50 (even-money ×2). Common / Rare / Epic = chọn nhóm Arcana.
        </p>
      )}
      <div className={`overflow-x-auto ${bare ? "" : "mt-2"}`}>
        <table className="arcana-paytable w-full min-w-[18rem] text-[10px]">
          <thead>
            <tr className="border-b border-[var(--gold)]/25 text-[var(--play-muted)]">
              <th className="py-1.5 text-left font-semibold">Nhân vật</th>
              <th className="py-1.5 text-right font-semibold">Hệ số</th>
              <th className="py-1.5 text-right font-semibold">~Ra bánh</th>
              <th className="py-1.5 text-right font-semibold">
                Thưởng nếu trúng
              </th>
            </tr>
          </thead>
          <tbody>
            {slots.map((s) => {
              const selected = pickIds.includes(s.id);
              const pay = previewArcanaPayout(stake, s.ratio, k, payoutScale);
              const share = s.weightShare ?? 0;
              const rare = rarityLabel(share);
              return (
                <tr
                  key={s.id}
                  className={`border-b border-[var(--wood-deep)]/8 ${
                    selected ? "bg-[var(--jade)]/15" : ""
                  }`}
                >
                  <td className="py-1.5 pr-1">
                    <div className="flex items-center gap-1.5">
                      <img
                        src={s.image}
                        alt=""
                        className="h-7 w-7 shrink-0 rounded-full object-cover object-top ring-1 ring-[var(--gold)]/30"
                        onError={(e) => onArcanaImgError(e, s.id)}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[var(--play-ink)]">
                          {s.nameVi}
                        </p>
                        <span
                          className={`arcana-rarity arcana-rarity--${
                            rare === "Epic"
                              ? "high"
                              : rare === "Hiếm"
                                ? "mid"
                                : "low"
                          }`}
                        >
                          {rare}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-1.5 text-right font-play font-bold text-[var(--gold)]">
                    ×{s.ratio}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-[var(--play-muted)]">
                    {share > 0 ? `${share}%` : "—"}
                  </td>
                  <td className="py-1.5 text-right font-play font-bold tabular-nums text-[var(--jade-deep)]">
                    {pickIds.length > 0 ? formatXu(pay) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );

  if (bare) return <div className="px-1 pb-2">{table}</div>;

  return <section className="app-panel mt-3 p-3">{table}</section>;
}
