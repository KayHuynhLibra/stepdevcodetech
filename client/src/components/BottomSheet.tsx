import type { ReactNode } from "react";
import { AdminPopupHead } from "./admin/AdminPopupHead";

interface BottomSheetProps {
  open: boolean;
  title: string;
  subtitle?: string;
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
  subtitle,
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
        <AdminPopupHead title={title} subtitle={subtitle} onClose={onClose} />
        <div
          className="overflow-y-auto px-4 py-3"
          style={{
            maxHeight: heightClass.includes("90vh")
              ? "calc(90vh - 56px)"
              : heightClass.includes("88vh")
                ? "calc(88vh - 56px)"
                : "calc(80vh - 56px)",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
