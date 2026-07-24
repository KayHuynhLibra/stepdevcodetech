import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  buildLevelTable,
  normalizeFormula,
  type LevelFormula,
} from "../levelFormula";
import { formatXu } from "../cards";

export type LevelMetric = "rounds" | "xu";

export interface LevelPartAdmin {
  id: string;
  label: string;
  blurb: string;
  enabled: boolean;
  metric: LevelMetric;
  formula: LevelFormula;
  sort: number;
  preview?: { level: number; metric: number }[];
}

interface LevelPartPopupProps {
  open: boolean;
  part: LevelPartAdmin | null;
  busy?: boolean;
  onClose: () => void;
  onSave: (part: LevelPartAdmin) => void | Promise<void>;
}

/** Popup chỉnh 1 part level (max / coef / power) + bảng Lv→metric. */
export function LevelPartPopup({
  open,
  part,
  busy,
  onClose,
  onSave,
}: LevelPartPopupProps) {
  const [label, setLabel] = useState("");
  const [blurb, setBlurb] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [maxLevel, setMaxLevel] = useState("99");
  const [coef, setCoef] = useState("5");
  const [power, setPower] = useState("2");
  const [sort, setSort] = useState("10");

  useEffect(() => {
    if (!part) return;
    setLabel(part.label);
    setBlurb(part.blurb);
    setEnabled(part.enabled);
    setMaxLevel(String(part.formula.maxLevel));
    setCoef(String(part.formula.coef));
    setPower(String(part.formula.power));
    setSort(String(part.sort));
  }, [part]);

  const formula = useMemo(
    () =>
      normalizeFormula(
        {
          maxLevel: Number(maxLevel),
          coef: Number(coef),
          power: Number(power),
        },
        part?.formula ?? { maxLevel: 99, coef: 5, power: 2 },
      ),
    [maxLevel, coef, power, part?.formula],
  );

  const table = useMemo(
    () => buildLevelTable(formula, Math.min(formula.maxLevel, 25)),
    [formula],
  );

  if (!open || !part) return null;

  const metricLabel = part.metric === "xu" ? "xu" : "ván";

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void onSave({
      ...part,
      label: label.trim() || part.id,
      blurb: blurb.trim(),
      enabled,
      sort: Math.max(0, Math.floor(Number(sort) || 0)),
      formula,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 sm:items-center sm:px-3"
      role="dialog"
      aria-modal="true"
      aria-label={`Chỉnh level ${part.id}`}
      onClick={onClose}
    >
      <form
        className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-[var(--cream)] p-3 shadow-2xl ring-1 ring-[var(--wood-deep)]/20 sm:rounded-2xl sm:p-4"
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="play-heading text-sm">Part · {part.id}</p>
            <p className="text-[10px] text-[var(--play-muted)]">
              metric={part.metric} · toReach(L)=coef×(L−1)^power
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/15"
          >
            Đóng
          </button>
        </div>

        <div className="mt-3 space-y-2">
          <label className="block text-[10px] font-bold text-[var(--play-muted)]">
            Tên hiển thị
            <input
              className="app-input mt-0.5 !px-2 !py-1.5 w-full text-[12px]"
              value={label}
              maxLength={40}
              disabled={busy}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <label className="block text-[10px] font-bold text-[var(--play-muted)]">
            Mô tả
            <input
              className="app-input mt-0.5 !px-2 !py-1.5 w-full text-[12px]"
              value={blurb}
              maxLength={120}
              disabled={busy}
              onChange={(e) => setBlurb(e.target.value)}
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-[10px] font-bold text-[var(--play-muted)]">
              Max LV
              <input
                className="app-input mt-0.5 !px-2 !py-1.5 w-full text-[12px]"
                value={maxLevel}
                disabled={busy}
                onChange={(e) => setMaxLevel(e.target.value)}
              />
            </label>
            <label className="text-[10px] font-bold text-[var(--play-muted)]">
              Coef
              <input
                className="app-input mt-0.5 !px-2 !py-1.5 w-full text-[12px]"
                value={coef}
                disabled={busy}
                onChange={(e) => setCoef(e.target.value)}
              />
            </label>
            <label className="text-[10px] font-bold text-[var(--play-muted)]">
              Power
              <input
                className="app-input mt-0.5 !px-2 !py-1.5 w-full text-[12px]"
                value={power}
                disabled={busy}
                onChange={(e) => setPower(e.target.value)}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-[10px] font-bold text-[var(--play-muted)]">
              Sort
              <input
                className="app-input ml-1 !inline-block !w-16 !px-2 !py-1 text-[12px]"
                value={sort}
                disabled={busy}
                onChange={(e) => setSort(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--play-ink)]">
              <input
                type="checkbox"
                checked={enabled}
                disabled={busy}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 accent-[var(--jade-deep)]"
              />
              Bật
            </label>
          </div>
        </div>

        <div className="mt-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--play-muted)]">
            Bảng Lv → {metricLabel} (preview)
          </p>
          <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto rounded-lg bg-white/80 px-2 py-1.5 text-[10px] ring-1 ring-[var(--wood-deep)]/10">
            {table.map((row) => (
              <li
                key={row.level}
                className="flex justify-between gap-2 tabular-nums"
              >
                <span>Lv.{row.level}</span>
                <span className="font-play font-bold">
                  {part.metric === "xu"
                    ? formatXu(row.metric)
                    : row.metric.toLocaleString("vi-VN")}{" "}
                  {metricLabel}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="mt-3 w-full rounded-full bg-[var(--wood-deep)] px-3 py-2.5 text-xs font-bold text-[var(--cream)] disabled:opacity-45"
        >
          {busy ? "Đang lưu…" : "Lưu part"}
        </button>
      </form>
    </div>
  );
}
