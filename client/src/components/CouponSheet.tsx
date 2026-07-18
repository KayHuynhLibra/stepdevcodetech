import { FormEvent, useState } from "react";

interface CouponSheetProps {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onRedeem: (code: string) => Promise<void>;
}

export function CouponSheet({
  open,
  busy,
  onClose,
  onRedeem,
}: CouponSheetProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const c = code.trim();
    if (!c) {
      setError("Nhập mã nạp");
      return;
    }
    try {
      await onRedeem(c);
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không nạp được");
    }
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div className="relative z-10 mb-0 w-full max-w-md rounded-t-2xl bg-white px-4 pb-5 pt-4 shadow-xl ring-1 ring-[#0f3d6e]/15 sm:mb-0 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="play-heading text-base">Nạp xu</p>
            <p className="text-[11px] text-[var(--play-muted)]">
              Nhập mã coupon để cộng xu
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-[#0f3d6e]/10 px-3 py-1 text-xs font-semibold text-[var(--play-ink)]"
          >
            Đóng
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Mã coupon"
            autoComplete="off"
            disabled={busy}
            className="app-input"
            autoFocus
          />
          {error && (
            <p className="text-center text-xs font-medium text-rose-600">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !code.trim()}
            className="app-btn-primary"
          >
            {busy ? "Đang nạp…" : "Xác nhận nạp"}
          </button>
        </form>
      </div>
    </div>
  );
}
