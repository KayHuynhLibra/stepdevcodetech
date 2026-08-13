/** Tiêu đề popup admin — gọn, đồng bộ BottomSheet / modal. */
export function AdminPopupHead({
  title,
  subtitle,
  onClose,
  closeLabel = "Đóng",
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  closeLabel?: string;
}) {
  return (
    <header className="admin-popup__head">
      <div className="admin-popup__grip" aria-hidden />
      <div className="admin-popup__titles">
        <h2 className="admin-popup__title">{title}</h2>
        {subtitle ? (
          <p className="admin-popup__subtitle">{subtitle}</p>
        ) : null}
      </div>
      <button
        type="button"
        className="admin-popup__close"
        onClick={onClose}
        aria-label={closeLabel}
      >
        {closeLabel}
      </button>
    </header>
  );
}
