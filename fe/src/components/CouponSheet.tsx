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
      setError("Nhập mã cộng xu ảo");
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
      <div className="sheet-shell-light relative z-10 mb-0 w-full max-w-md rounded-t-2xl px-4 pb-5 pt-4 shadow-xl ring-1 ring-[var(--jade)]/45 sm:mb-0 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="play-heading text-base !text-[var(--jade-deep)]">Cộng xu ảo</p>
            <p className="text-[11px] text-[var(--jade-deep)]/65">
              Nhập mã coupon để cộng xu
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="app-btn-ghost px-3 py-1 text-xs"
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
