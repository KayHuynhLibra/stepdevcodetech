import type { ReactNode } from "react";
import { AdminPopupHead } from "./AdminPopupHead";

/** Modal / sheet admin — nền form vàng, title gọn. */
export function AdminModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidthClass = "max-w-md",
  closeLabel,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  maxWidthClass?: string;
  closeLabel?: string;
}) {
  if (!open) return null;

  return (
    <div
      className="admin-modal"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className={`admin-modal__panel ${maxWidthClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        <AdminPopupHead
          title={title}
          subtitle={subtitle}
          onClose={onClose}
          closeLabel={closeLabel}
        />
        <div className="admin-modal__body">{children}</div>
      </div>
    </div>
  );
}
