import { useEffect, useMemo, useState } from "react";
import {
  CARDS,
  MAX_BET_PER_CARD,
  QUICK_ADDS,
  formatXu,
  type CardDef,
} from "../cards";

interface BetSheetProps {
  open: boolean;
  cardId: number | null;
  balance: number;
  /** Số xu đã đặt trên lá này trong ván hiện tại */
  currentStake?: number;
  onClose: () => void;
  onConfirm: (cardId: number, amount: number) => void;
}

export function BetSheet({
  open,
  cardId,
  balance,
  currentStake = 0,
  onClose,
  onConfirm,
}: BetSheetProps) {
  const [amount, setAmount] = useState(0);

  const card: CardDef | undefined = useMemo(
    () => CARDS.find((c) => c.id === cardId) ?? undefined,
    [cardId],
  );

  useEffect(() => {
    if (open) setAmount(0);
  }, [open, cardId]);

  if (!open || !card) return null;

  const already = Math.max(0, currentStake);
  const roomLeft = Math.max(0, MAX_BET_PER_CARD - already);
  const totalAfter = already + amount;
  const overCardCap = amount > roomLeft;
  const insufficient =
    amount > balance || amount <= 0 || overCardCap || roomLeft <= 0;
  const status =
    roomLeft <= 0
      ? `Đã đạt trần ${formatXu(MAX_BET_PER_CARD)} xu / lá`
      : amount <= 0
        ? already > 0
          ? `Đã đặt ${formatXu(already)} · còn thêm tối đa ${formatXu(roomLeft)}`
          : `Mời chọn số đặt (tối đa ${formatXu(MAX_BET_PER_CARD)} / lá)`
        : overCardCap
          ? `Vượt trần ${formatXu(MAX_BET_PER_CARD)} / lá`
          : amount > balance
            ? "Số dư không đủ"
            : already > 0
              ? `Thêm ${formatXu(amount)} → tổng ${formatXu(totalAfter)} xu`
              : `Đặt ${formatXu(amount)} xu`;

  const resetAndClose = () => {
    setAmount(0);
    onClose();
  };

  const add = (n: number) =>
    setAmount((prev) => Math.min(prev + n, roomLeft, balance));

  const confirm = () => {
    if (insufficient) return;
    onConfirm(card.id, amount);
    setAmount(0);
  };

  return (
    <div className="bet-sheet-root fixed inset-0 z-[60] flex flex-col justify-end">
      <button
        type="button"
        aria-label="Đóng"
        className="bet-sheet-backdrop absolute inset-0"
        onClick={resetAndClose}
      />

      <div className="pointer-events-none relative z-10 mx-auto mb-[-1.5rem] flex justify-center">
        <div className="bet-sheet-hero relative">
          <span className="arcana-aura bet-sheet-hero__aura" aria-hidden />
          <span
            className="arcana-aura-inner bet-sheet-hero__aura bet-sheet-hero__aura--inner"
            aria-hidden
          />
          <span className="bet-sheet-hero__star bet-sheet-hero__star--tl" aria-hidden>
            ✦
          </span>
          <span className="bet-sheet-hero__star bet-sheet-hero__star--br" aria-hidden>
            ✦
          </span>
          <img
            src={card.image}
            alt={card.nameVi}
            className="bet-sheet-hero__card"
          />
          <span className="bet-sheet-hero__id font-play">{card.id}</span>
        </div>
      </div>

      <div className="relative z-20 mx-auto w-full max-w-md animate-[sheet-up_0.2s_ease-out]">
        <div className="bet-sheet-panel relative rounded-t-2xl border-b-0 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-8">
          <div className="bet-sheet-panel__rim pointer-events-none absolute inset-0 rounded-t-2xl" aria-hidden />

          <div className="bet-sheet-ribbon absolute -top-3 left-1/2 z-10 w-[92%] -translate-x-1/2">
            <p className="bet-sheet-ribbon__text text-center text-[12px] font-bold leading-tight">
              May mắn cũng là 1 loại sức mạnh
            </p>
          </div>

          <p className="bet-sheet-meta mb-2 text-center text-[11px] font-semibold">
            Lá {card.id} · x{card.multiplier} · Số dư {formatXu(balance)} · Max{" "}
            {formatXu(MAX_BET_PER_CARD)}/lá
          </p>

          {already > 0 && (
            <p className="font-play mb-1.5 text-center text-xs font-bold text-amber-200/95">
              Đã cược lá này: {formatXu(already)} xu
            </p>
          )}

          <div
            className={`bet-sheet-status mx-auto mb-3 w-[90%] py-2.5 text-center text-sm font-semibold ${
              insufficient && amount > 0
                ? "bet-sheet-status--error"
                : already > 0 && amount <= 0
                  ? "bet-sheet-status--warn"
                  : ""
            }`}
          >
            {status}
          </div>

          <div className="bet-sheet-chips mx-auto grid w-[92%] grid-cols-3 gap-2">
            {QUICK_ADDS.map((n) => (
              <button
                key={n}
                type="button"
                disabled={roomLeft <= 0}
                onClick={() => add(n)}
                className="bet-sheet-chip font-play tabular-nums"
              >
                +{formatXu(n)}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={insufficient}
            onClick={confirm}
            className={`bet-sheet-confirm font-play relative mx-auto mt-4 flex w-[90%] items-center justify-center py-3 text-lg font-extrabold tracking-wide transition ${
              insufficient ? "bet-sheet-confirm--disabled" : ""
            }`}
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}
