import { useState } from "react";
import { AdminModal } from "./AdminModal";

/** Nút mở popup chọn mục — tránh hàng tab tràn / cắt chữ. */
export function AdminPickTrigger({
  label,
  value,
  ariaLabel,
  onClick,
}: {
  label: string;
  value: string;
  ariaLabel?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="admin-pick-trigger"
      aria-haspopup="dialog"
      aria-label={ariaLabel ?? `${label}: ${value}`}
      onClick={onClick}
    >
      <span className="admin-pick-trigger__meta">
        <span className="admin-pick-trigger__label">{label}</span>
        <span className="admin-pick-trigger__value">{value}</span>
      </span>
      <span className="admin-pick-trigger__chev" aria-hidden>
        ▾
      </span>
    </button>
  );
}

/** Lưới lựa chọn trong popup admin. */
export function AdminPickGrid<T extends string>({
  options,
  active,
  onSelect,
}: {
  options: { id: T; label: string }[];
  active: T;
  onSelect: (id: T) => void;
}) {
  return (
    <ul className="admin-pick-grid" role="listbox" aria-label="Chọn mục">
      {options.map((opt) => {
        const on = opt.id === active;
        return (
          <li key={opt.id} role="none">
            <button
              type="button"
              role="option"
              aria-selected={on}
              className={`admin-pick-grid__btn ${on ? "is-on" : ""}`}
              onClick={() => onSelect(opt.id)}
            >
              {on ? (
                <span className="admin-pick-grid__check" aria-hidden>
                  ✓
                </span>
              ) : (
                <span className="admin-pick-grid__dot" aria-hidden />
              )}
              <span className="admin-pick-grid__text">{opt.label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Thanh tab admin — chọn qua popup (không cuộn ngang / không tràn). */
export function AdminTabBar<T extends string>({
  tabs,
  active,
  onSelect,
  activeLabel,
  pickLabel = "Mục",
  pickTitle = "Chọn mục",
  pickSubtitle = "Chạm để mở — không bị cắt khi nhiều mục",
}: {
  tabs: { id: T; label: string; show: boolean }[];
  active: T;
  onSelect: (id: T) => void;
  activeLabel?: string;
  pickLabel?: string;
  pickTitle?: string;
  pickSubtitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const visible = tabs.filter((t) => t.show);
  const current =
    activeLabel ?? visible.find((t) => t.id === active)?.label ?? "";

  if (visible.length <= 1) {
    return current ? (
      <p className="admin-tabs__active" aria-live="polite">
        <span className="admin-tabs__active-dot" aria-hidden />
        {current}
      </p>
    ) : null;
  }

  return (
    <div className="admin-tabs-wrap admin-tabs-wrap--pick">
      <AdminPickTrigger
        label={pickLabel}
        value={current || "—"}
        onClick={() => setOpen(true)}
      />
      <AdminModal
        open={open}
        onClose={() => setOpen(false)}
        title={pickTitle}
        subtitle={pickSubtitle}
      >
        <AdminPickGrid
          options={visible.map((t) => ({ id: t.id, label: t.label }))}
          active={active}
          onSelect={(id) => {
            onSelect(id);
            setOpen(false);
          }}
        />
      </AdminModal>
    </div>
  );
}

/** Chọn game vault (Tarot / Arcana / Gem). */
export function AdminGameSwitch({
  value,
  onChange,
}: {
  value: "tarot" | "arcana" | "gem";
  onChange: (v: "tarot" | "arcana" | "gem") => void;
}) {
  return (
    <div className="admin-game-switch app-frame">
      <p className="admin-game-switch__label">Game quản lý</p>
      <div className="admin-game-switch__row">
        {(
          [
            ["tarot", "Tarot"],
            ["arcana", "Arcana"],
            ["gem", "Gem"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`admin-game-switch__btn ${value === id ? "is-on" : ""}`}
            onClick={() => onChange(id)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
