import type { ReactNode } from "react";

interface BottomSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  heightClass?: string;
}

export function BottomSheet({
  open,
  title,
  onClose,
  children,
  heightClass = "max-h-[80vh]",
}: BottomSheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <button
        type="button"
        aria-label="Đóng"
        className="absolute inset-0 bg-black/55"
        onClick={onClose}
      />
      <div
        className={`sheet-shell relative w-full max-w-md ${heightClass} animate-[sheet-up_0.18s_ease-out] overflow-hidden rounded-t-2xl ring-1 ring-[var(--jade)]/45`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-[var(--jade)]/25 px-4 py-3">
          <div className="mx-auto h-1 w-10 rounded-full bg-[var(--jade-soft)]/50 absolute left-1/2 top-2 -translate-x-1/2" />
          <h2 className="font-display text-base font-bold text-[var(--jade-soft)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-sm text-[var(--jade-soft)]/65 hover:text-[var(--jade-soft)]"
          >
            Đóng
          </button>
        </div>
        <div
          className="overflow-y-auto px-4 py-3"
          style={{
            maxHeight: heightClass.includes("90vh")
              ? "calc(90vh - 52px)"
              : "calc(80vh - 52px)",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
