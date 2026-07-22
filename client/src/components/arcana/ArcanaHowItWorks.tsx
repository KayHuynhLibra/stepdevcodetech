import { useState } from "react";
import { formatXu } from "../../cards";
import { previewArcanaPayout } from "../../lib/arcanaPayout";

export function ArcanaHowItWorksBody({
  payoutScale,
  pickCount,
  stake,
  exampleRatio = 12,
}: {
  payoutScale: number;
  pickCount: number;
  stake: number;
  exampleRatio?: number;
}) {
  const k = Math.max(1, pickCount || 2);
  const exampleStake = stake > 0 ? stake : 10_000;
  const examplePay = previewArcanaPayout(
    exampleStake,
    exampleRatio,
    k,
    payoutScale,
  );

  return (
    <div className="text-[11px] leading-relaxed text-[var(--play-ink)]">
      <p>
        <strong>Hệ số ×8, ×12…</strong> là số nhân trong công thức — ô hiếm
        thường có hệ số cao hơn. Không có nghĩa “bỏ 1 xu nhận 8 xu”.
      </p>
      <p className="mt-2 rounded-lg bg-white/60 p-2 font-mono text-[10px] ring-1 ring-[var(--wood-deep)]/10">
        thưởng = làm tròn xuống( xu × hệ số × {payoutScale} ÷ số ô đã chọn )
      </p>
      <p className="mt-2 text-[var(--play-muted)]">
        Ví dụ: xu {formatXu(exampleStake)}, chọn {k} ô, trúng ô ×
        {exampleRatio} → nhận <strong>{formatXu(examplePay)}</strong> xu (lãi{" "}
        {formatXu(Math.max(0, examplePay - exampleStake))}).
      </p>
      <p className="mt-2 text-[var(--play-muted)]">
        Trúng khi nhân vật bánh xe dừng nằm trong danh sách bạn đã chọn. Chuỗi
        vận thắng có thể cộng thêm % lên thưởng gốc (xem Chi tiết chuỗi vận).
      </p>
      <p className="mt-2 text-[var(--play-muted)]">
        <strong>Nhóm Arcana</strong> (Common / Rare / Epic): chọn nhanh cả nhóm
        theo độ hiếm — cùng công thức thưởng như chọn từng nhân vật.
      </p>
      <p className="mt-2 text-[var(--play-muted)]">
        <strong>Roulette ngoài</strong> (Đỏ / Đen / Chẵn / Lẻ): tùy chọn. Khi
        chọn, chia stake 50/50 — nửa even-money (trúng nhận ×2 nửa đó; số 0
        thua), nửa còn lại vào Arcana. Không chọn = 100% stake vào Arcana.
      </p>
    </div>
  );
}

export function ArcanaHowItWorks({
  payoutScale,
  pickCount,
  stake,
  exampleRatio = 12,
  mode = "accordion",
}: {
  payoutScale: number;
  pickCount: number;
  stake: number;
  exampleRatio?: number;
  mode?: "accordion" | "sheet";
}) {
  const [open, setOpen] = useState(false);

  if (mode === "sheet") {
    return (
      <ArcanaHowItWorksBody
        payoutScale={payoutScale}
        pickCount={pickCount}
        stake={stake}
        exampleRatio={exampleRatio}
      />
    );
  }

  return (
    <section className="app-panel mt-3 overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-bold text-[var(--wood-deep)]"
      >
        Cách tính thưởng & hệ số ×N
        <span className="text-[var(--play-muted)]">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="border-t border-[var(--wood-deep)]/10 px-3 pb-3 pt-2">
          <ArcanaHowItWorksBody
            payoutScale={payoutScale}
            pickCount={pickCount}
            stake={stake}
            exampleRatio={exampleRatio}
          />
        </div>
      )}
    </section>
  );
}
