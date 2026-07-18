import { useEffect, useState } from "react";
import {
  CARDS,
  MAX_BET_PER_CARD,
  QUICK_ADDS,
  formatXu,
} from "../cards";

const MAX_AUTO_CARDS = 5;
const MIN_BET = 10;
const BET_STEP = 10;

export interface AutoBetSlot {
  cardId: number;
  amount: number;
}

export interface AutoBetConfig {
  enabled: boolean;
  slots: AutoBetSlot[];
}

export const AUTO_BET_KEY = "tarot_auto_bet";

export const DEFAULT_AUTO_BET: AutoBetConfig = {
  enabled: false,
  slots: [],
};

export function loadAutoBet(): AutoBetConfig {
  try {
    const raw = localStorage.getItem(AUTO_BET_KEY);
    if (!raw) return { ...DEFAULT_AUTO_BET };
    const parsed = JSON.parse(raw) as AutoBetConfig;
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_AUTO_BET };
    const slots = Array.isArray(parsed.slots)
      ? parsed.slots
          .filter(
            (s) =>
              s &&
              Number.isFinite(s.cardId) &&
              s.cardId >= 1 &&
              s.cardId <= 8 &&
              Number.isFinite(s.amount),
          )
          .map((s) => ({
            cardId: Math.floor(s.cardId),
            amount: Math.max(
              MIN_BET,
              Math.min(
                MAX_BET_PER_CARD,
                Math.floor(s.amount / BET_STEP) * BET_STEP,
              ),
            ),
          }))
          .slice(0, MAX_AUTO_CARDS)
      : [];
    // unique by cardId
    const map = new Map<number, number>();
    for (const s of slots) map.set(s.cardId, s.amount);
    return {
      enabled: !!parsed.enabled && map.size > 0,
      slots: [...map.entries()].map(([cardId, amount]) => ({
        cardId,
        amount,
      })),
    };
  } catch {
    return { ...DEFAULT_AUTO_BET };
  }
}

export function saveAutoBet(cfg: AutoBetConfig) {
  try {
    localStorage.setItem(AUTO_BET_KEY, JSON.stringify(cfg));
  } catch {
    /* ignore */
  }
}

interface AutoBetSheetProps {
  open: boolean;
  initial: AutoBetConfig;
  onClose: () => void;
  onSave: (cfg: AutoBetConfig) => void;
}

export function AutoBetSheet({
  open,
  initial,
  onClose,
  onSave,
}: AutoBetSheetProps) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [slots, setSlots] = useState<AutoBetSlot[]>(initial.slots);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEnabled(initial.enabled);
    setSlots(initial.slots);
    setFormError(null);
  }, [open, initial]);

  if (!open) return null;

  const selected = new Set(slots.map((s) => s.cardId));
  const total = slots.reduce((s, x) => s + x.amount, 0);

  const toggleCard = (cardId: number) => {
    if (selected.has(cardId)) {
      setSlots((prev) => prev.filter((s) => s.cardId !== cardId));
      return;
    }
    if (slots.length >= MAX_AUTO_CARDS) return;
    setSlots((prev) => [...prev, { cardId, amount: MIN_BET }]);
  };

  const addAmount = (cardId: number, n: number) => {
    setSlots((prev) =>
      prev.map((s) =>
        s.cardId === cardId
          ? {
              ...s,
              amount: Math.min(MAX_BET_PER_CARD, s.amount + n),
            }
          : s,
      ),
    );
  };

  const setAmount = (cardId: number, amount: number) => {
    setSlots((prev) =>
      prev.map((s) =>
        s.cardId === cardId
          ? {
              ...s,
              amount: Math.max(
                MIN_BET,
                Math.min(MAX_BET_PER_CARD, amount),
              ),
            }
          : s,
      ),
    );
  };

  const clearPreset = () => {
    setEnabled(false);
    setSlots([]);
    setFormError(null);
  };

  const save = () => {
    const clean = slots.filter((s) => s.amount >= MIN_BET);
    if (enabled && clean.length === 0) {
      setFormError("Chọn ít nhất 1 lá trước khi bật Auto");
      return;
    }
    setFormError(null);
    onSave({
      enabled: enabled && clean.length > 0,
      slots: clean,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div className="sheet-shell relative z-10 mb-0 flex max-h-[85vh] w-full max-w-md flex-col rounded-t-2xl px-4 pb-5 pt-4 shadow-xl ring-1 ring-[var(--jade)]/40 sm:mb-0 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display text-base text-[var(--jade-soft)]">
              Auto đặt lá
            </p>
            <p className="text-[11px] text-white/50">
              Tối đa {MAX_AUTO_CARDS} lá · tự đặt đầu mỗi ván
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-[var(--cream)]/55 ring-1 ring-white/10"
          >
            Đóng
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
          <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/10">
            <div>
              <p className="text-sm font-bold text-white/90">Bật Auto</p>
              <p className="text-[10px] text-white/45">
                {enabled ? "Đang bật" : "Đang tắt"}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled((v) => !v)}
              className={`relative h-7 w-12 rounded-full transition ${
                enabled ? "bg-[var(--jade)]" : "bg-white/15"
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                  enabled ? "left-[1.35rem]" : "left-0.5"
                }`}
              />
            </button>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--jade-soft)]/80">
              Chọn lá ({slots.length}/{MAX_AUTO_CARDS})
            </p>
            <div className="grid grid-cols-4 gap-2">
              {CARDS.map((card) => {
                const on = selected.has(card.id);
                const locked = !on && slots.length >= MAX_AUTO_CARDS;
                return (
                  <button
                    key={card.id}
                    type="button"
                    disabled={locked}
                    onClick={() => toggleCard(card.id)}
                    className={`relative overflow-hidden rounded-lg ring-2 transition active:scale-[0.97] disabled:opacity-35 ${
                      on
                        ? "ring-[var(--jade-soft)]"
                        : "ring-white/10"
                    }`}
                  >
                    <img
                      src={card.image}
                      alt={card.nameVi}
                      className="aspect-[3/4] w-full object-cover"
                      draggable={false}
                    />
                    <span className="font-play absolute left-0.5 top-0.5 rounded bg-black/55 px-1 text-[10px] font-bold text-[var(--jade-soft)]">
                      {card.id}
                    </span>
                    {on && (
                      <span className="absolute inset-x-0 bottom-0 bg-[var(--jade)]/90 py-0.5 text-center text-[9px] font-bold text-[#06241e]">
                        Chọn
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {slots.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--jade-soft)]/80">
                Số xu mỗi lá
              </p>
              {slots.map((slot) => {
                const card = CARDS.find((c) => c.id === slot.cardId);
                if (!card) return null;
                return (
                  <div
                    key={slot.cardId}
                    className="rounded-xl bg-white/5 px-2.5 py-2 ring-1 ring-white/10"
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      <img
                        src={card.image}
                        alt=""
                        className="h-9 w-[1.65rem] rounded object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-bold text-white/90">
                          #{card.id} {card.nameVi}
                        </p>
                        <p className="font-play text-xs font-bold text-amber-200 tabular-nums">
                          {formatXu(slot.amount)} xu
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAmount(slot.cardId, MIN_BET)}
                        className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold text-white/60"
                      >
                        Reset
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {QUICK_ADDS.map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => addAmount(slot.cardId, n)}
                          className="rounded-md bg-[var(--jade)]/20 px-2 py-1 text-[10px] font-bold text-[var(--jade-soft)] ring-1 ring-[var(--jade)]/35"
                        >
                          +{n >= 1000 ? formatXu(n) : n}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              <p className="text-center text-[11px] text-white/50">
                Tổng / ván:{" "}
                <span className="font-play font-bold text-amber-200 tabular-nums">
                  {formatXu(total)}
                </span>{" "}
                xu
              </p>
            </div>
          )}
        </div>

        {formError && (
          <p className="mt-2 text-center text-[11px] font-semibold text-rose-300">
            {formError}
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={clearPreset}
            className="app-btn-ghost flex-1 !rounded-xl !py-2.5 !text-xs"
          >
            Xóa preset
          </button>
          <button
            type="button"
            onClick={save}
            className="app-btn-primary flex-[1.4] !rounded-xl !py-2.5 !text-sm"
          >
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
}
