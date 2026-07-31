import type { ReactNode } from "react";

interface BottomSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  heightClass?: string;
  /** Overlay nền — mặc định tối vừa; cosmetics dùng nhạt hơn */
  backdropClass?: string;
  /** Thêm class cho panel (vd. sheet-shell-light) */
  shellClass?: string;
}

export function BottomSheet({
  open,
  title,
  onClose,
  children,
  heightClass = "max-h-[80vh]",
  backdropClass = "bg-black/55",
  shellClass = "",
}: BottomSheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <button
        type="button"
        aria-label="Đóng"
        className={`absolute inset-0 ${backdropClass}`}
        onClick={onClose}
      />
      <div
        className={`sheet-shell form-popup relative w-full max-w-md ${heightClass} animate-[sheet-up_0.18s_ease-out] overflow-hidden rounded-t-2xl ${shellClass}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="form-popup__head flex items-center justify-between px-4 py-3">
          <div className="form-popup__grip absolute left-1/2 top-2 -translate-x-1/2" />
          <h2 className="font-display text-base font-bold text-[var(--gold-soft)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-sm text-[var(--gold-soft)]/70 hover:text-[var(--gold-soft)]"
          >
            Đóng
          </button>
        </div>
        <div
          className="overflow-y-auto px-4 py-3"
          style={{
            maxHeight: heightClass.includes("90vh")
              ? "calc(90vh - 52px)"
              : heightClass.includes("88vh")
                ? "calc(88vh - 52px)"
                : "calc(80vh - 52px)",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
