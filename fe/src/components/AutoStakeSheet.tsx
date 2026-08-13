import { useEffect, useState } from "react";
import {
  CARDS,
  MAX_STAKE_PER_CARD,
  QUICK_ADDS,
  formatXu,
} from "../cards";
import {
  DEFAULT_MAX_CARDS_PER_ROUND,
  MAX_CARDS_PER_ROUND_MAX,
  normalizeMaxCardsPerRound,
} from "../tableConfig";

const MIN_STAKE = 10;
const STAKE_STEP = 10;
/** Trần tuyệt đối — khớp server ABSOLUTE_MAX_STAKE (tu tiên / VIP). */
export const ABSOLUTE_MAX_STAKE_PER_CARD = 100_000_000;

export interface AutoStakeSlot {
  cardId: number;
  amount: number;
}

export interface AutoStakeConfig {
  enabled: boolean;
  slots: AutoStakeSlot[];
}

export const AUTO_STAKE_KEY = "tarot_auto_stake";
const LEGACY_AUTO_KEY = "tarot_auto_bet";

export const DEFAULT_AUTO_STAKE: AutoStakeConfig = {
  enabled: false,
  slots: [],
};

function normalizeStakeCap(maxStakePerCard: number): number {
  const n = Math.floor(maxStakePerCard);
  if (!Number.isFinite(n) || n < MIN_STAKE) return MAX_STAKE_PER_CARD;
  return Math.min(ABSOLUTE_MAX_STAKE_PER_CARD, Math.max(MIN_STAKE, n));
}

/** Cắt preset Auto theo trần số lá / ván + trần xu / lá (tu tiên). */
export function clampAutoStake(
  cfg: AutoStakeConfig,
  maxCardsPerRound: number = DEFAULT_MAX_CARDS_PER_ROUND,
  maxStakePerCard: number = MAX_STAKE_PER_CARD,
): AutoStakeConfig {
  const lim = normalizeMaxCardsPerRound(maxCardsPerRound);
  const stakeCap = normalizeStakeCap(maxStakePerCard);
  const map = new Map<number, number>();
  for (const s of cfg.slots ?? []) {
    if (!s || !Number.isFinite(s.cardId) || !Number.isFinite(s.amount)) continue;
    const cardId = Math.floor(s.cardId);
    if (cardId < 1 || cardId > 8) continue;
    map.set(
      cardId,
      Math.max(
        MIN_STAKE,
        Math.min(
          stakeCap,
          Math.floor(s.amount / STAKE_STEP) * STAKE_STEP,
        ),
      ),
    );
  }
  const slots = [...map.entries()]
    .map(([cardId, amount]) => ({ cardId, amount }))
    .slice(0, lim);
  return {
    enabled: !!cfg.enabled && slots.length > 0,
    slots,
  };
}

export function loadAutoStake(
  maxCardsPerRound: number = MAX_CARDS_PER_ROUND_MAX,
  /** Mặc định trần tuyệt đối để không phá preset tu tiên trước khi /auth/me trả stakeLimits. */
  maxStakePerCard: number = ABSOLUTE_MAX_STAKE_PER_CARD,
): AutoStakeConfig {
  try {
    const raw =
      localStorage.getItem(AUTO_STAKE_KEY) ??
      localStorage.getItem(LEGACY_AUTO_KEY);
    if (!raw) return { ...DEFAULT_AUTO_STAKE };
    const parsed = JSON.parse(raw) as AutoStakeConfig;
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_AUTO_STAKE };
    return clampAutoStake(
      {
        enabled: !!parsed.enabled,
        slots: Array.isArray(parsed.slots) ? parsed.slots : [],
      },
      maxCardsPerRound,
      maxStakePerCard,
    );
  } catch {
    return { ...DEFAULT_AUTO_STAKE };
  }
}

export function saveAutoStake(cfg: AutoStakeConfig) {
  try {
    localStorage.setItem(AUTO_STAKE_KEY, JSON.stringify(cfg));
  } catch {
    /* ignore */
  }
}

interface AutoStakeSheetProps {
  open: boolean;
  initial: AutoStakeConfig;
  /** Trần số lá / ván từ table-config — Auto không vượt quá. */
  maxCardsPerRound?: number;
  maxStakePerCard?: number;
  quickAdds?: number[];
  onClose: () => void;
  onSave: (cfg: AutoStakeConfig) => void;
}

export function AutoStakeSheet({
  open,
  initial,
  maxCardsPerRound = DEFAULT_MAX_CARDS_PER_ROUND,
  maxStakePerCard = MAX_STAKE_PER_CARD,
  quickAdds = [...QUICK_ADDS],
  onClose,
  onSave,
}: AutoStakeSheetProps) {
  const cardLimit = normalizeMaxCardsPerRound(maxCardsPerRound);
  const stakeCap = normalizeStakeCap(maxStakePerCard);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [slots, setSlots] = useState<AutoStakeSlot[]>(() =>
    clampAutoStake(initial, cardLimit, stakeCap).slots,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const cap = stakeCap;
  const adds = quickAdds.length ? quickAdds : [...QUICK_ADDS];

  useEffect(() => {
    if (!open) return;
    const next = clampAutoStake(initial, cardLimit, stakeCap);
    setEnabled(next.enabled);
    setSlots(next.slots);
    setFormError(null);
  }, [open, initial, cardLimit, stakeCap]);

  if (!open) return null;

  const selected = new Set(slots.map((s) => s.cardId));
  const total = slots.reduce((s, x) => s + x.amount, 0);

  const toggleCard = (cardId: number) => {
    if (selected.has(cardId)) {
      setSlots((prev) => prev.filter((s) => s.cardId !== cardId));
      return;
    }
    if (slots.length >= cardLimit) return;
    setSlots((prev) => [...prev, { cardId, amount: MIN_STAKE }]);
  };

  const addAmount = (cardId: number, n: number) => {
    setSlots((prev) =>
      prev.map((s) =>
        s.cardId === cardId
          ? {
              ...s,
              amount: Math.min(cap, s.amount + n),
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
              amount: Math.max(MIN_STAKE, Math.min(cap, amount)),
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
    const clean = clampAutoStake(
      { enabled, slots: slots.filter((s) => s.amount >= MIN_STAKE) },
      cardLimit,
      stakeCap,
    );
    if (enabled && clean.slots.length === 0) {
      setFormError("Chọn ít nhất 1 lá trước khi bật Auto");
      return;
    }
    setFormError(null);
    onSave(clean);
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
              Tối đa {cardLimit} lá / ván (theo cấu hình bàn) · tự đặt đầu mỗi
              ván
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
              Chọn lá ({slots.length}/{cardLimit})
            </p>
            <div className="grid grid-cols-4 gap-2">
              {CARDS.map((card) => {
                const on = selected.has(card.id);
                const locked = !on && slots.length >= cardLimit;
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
                        onClick={() => setAmount(slot.cardId, MIN_STAKE)}
                        className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold text-white/60"
                      >
                        Reset
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {adds.map((n) => (
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
                xu · tối đa {cardLimit} lá
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
