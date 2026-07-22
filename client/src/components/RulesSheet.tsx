import { CARDS, formatXu } from "../cards";
import { VIP_ROUNDS_REQUIRED } from "../auth";
import { PLAY_LEVEL_MAX, roundsToReachLevel } from "../playLevel";
import {
  CHAT_COST,
  VIP_CHAT_COST,
  SAINT_CHAT_COST,
} from "../shouts";

interface RulesSheetProps {
  open: boolean;
  onClose: () => void;
}

/** Luật chơi / bảng hệ số — giảm hỏi support. */
export function RulesSheet({ open, onClose }: RulesSheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div className="sheet-shell relative z-10 max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-t-2xl px-5 pb-6 pt-5 shadow-xl ring-1 ring-[var(--jade)]/40 sm:rounded-2xl">
        <div className="mb-3 flex items-start justify-between gap-2">
          <p className="font-display text-sm tracking-wide text-[var(--jade-soft)]">
            Luật chơi
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80"
          >
            Đóng
          </button>
        </div>

        <div className="space-y-3 text-[12px] leading-relaxed text-[var(--cream)]/85">
          <p>
            Mỗi ván chọn tối đa <strong className="text-white">5 lá</strong>,
            mỗi lá tối đa <strong className="text-white">100.000 xu</strong>.
            Thắng = xu × hệ số lá đó.
          </p>
          <p>
            VIP khi đủ{" "}
            <strong className="text-white">
              {VIP_ROUNDS_REQUIRED.toLocaleString("vi-VN")} ván
            </strong>{" "}
            hoặc được admin cấp. Cấp độ chơi{" "}
            <strong className="text-white">Lv.1–{PLAY_LEVEL_MAX}</strong> tăng
            theo số ván (Lv.{PLAY_LEVEL_MAX} ≈{" "}
            {roundsToReachLevel(PLAY_LEVEL_MAX).toLocaleString("vi-VN")} ván).
            Chat: thường {formatXu(CHAT_COST)} · VIP bay{" "}
            {formatXu(VIP_CHAT_COST)} · Saint {formatXu(SAINT_CHAT_COST)} xu.
          </p>
          <p className="text-[11px] text-white/50">
            Nạp xu bằng mã coupon (đăng nhập). Khách chơi nhanh có thể mang xu
            sang tài khoản khi đăng ký/đăng nhập.
          </p>
        </div>

        <ul className="mt-4 space-y-2">
          {CARDS.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-2 rounded-xl bg-white/5 px-2.5 py-2 ring-1 ring-white/10"
            >
              <img
                src={c.image}
                alt=""
                className="h-10 w-8 rounded object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-bold text-white">
                  {c.nameVi}
                </p>
                <p className="text-[10px] text-white/45">{c.name}</p>
              </div>
              <span className="font-play text-sm font-bold text-amber-300 tabular-nums">
                ×{c.multiplier}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
