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
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <button
        type="button"
        aria-label="Đóng"
        className="absolute inset-0 bg-black/35"
        onClick={resetAndClose}
      />

      {/* Floating selected card (như ảnh mẫu) */}
      <div className="pointer-events-none relative z-10 mx-auto mb-[-1.5rem] flex justify-center">
        <div className="relative">
          <div className="absolute inset-[-12px] rounded-2xl bg-[var(--jade)]/40 blur-xl" />
          <img
            src={card.image}
            alt={card.nameVi}
            className="relative h-36 w-[6.75rem] rounded-[0.7rem] object-cover object-center shadow-[0_8px_28px_rgba(0,0,0,0.35)] ring-2 ring-[var(--jade-soft)]/70"
          />
          <span className="absolute -left-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--jade-deep)] text-xs font-bold text-[var(--jade-soft)]">
            {card.id}
          </span>
        </div>
      </div>

      {/* Form panel */}
      <div className="relative z-20 mx-auto w-full max-w-md animate-[sheet-up_0.2s_ease-out]">
        <div className="sheet-shell-light relative rounded-t-2xl border-[3px] border-[var(--jade)]/80 border-b-0 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-8 shadow-2xl">
          <svg
            className="absolute left-2 top-2 h-4 w-4 text-[var(--jade)]"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
          >
            <path d="M13 2L4 14h7l-1 8 10-14h-7l0-6z" />
          </svg>
          <svg
            className="absolute right-2 top-2 h-4 w-4 text-[var(--jade)]"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
          >
            <path d="M13 2L4 14h7l-1 8 10-14h-7l0-6z" />
          </svg>

          {/* Title ribbon */}
          <div className="absolute -top-3 left-1/2 z-10 w-[92%] -translate-x-1/2">
            <div
              className="bg-[var(--jade-deep)] px-3 py-1.5 text-center text-[12px] font-bold leading-tight text-[var(--jade-soft)] shadow-md"
              style={{
                clipPath:
                  "polygon(3% 0, 97% 0, 100% 50%, 97% 100%, 3% 100%, 0 50%)",
              }}
            >
              May mắn cũng là 1 loại sức mạnh
            </div>
          </div>

          <p className="mb-2 text-center text-[11px] font-semibold text-[var(--jade-deep)]/80">
            Lá {card.id} · x{card.multiplier} · Số dư {formatXu(balance)} · Max{" "}
            {formatXu(MAX_BET_PER_CARD)}/lá
          </p>

          {already > 0 && (
            <p className="font-play mb-1.5 text-center text-xs font-bold text-amber-700">
              Đã cược lá này: {formatXu(already)} xu
            </p>
          )}

          {/* Status / amount box */}
          <div
            className={`mx-auto mb-3 w-[85%] rounded-md border border-slate-300/80 bg-slate-200/90 py-2.5 text-center text-sm font-semibold ${
              insufficient && amount > 0
                ? "text-red-600"
                : already > 0 && amount <= 0
                  ? "text-amber-800"
                  : "text-slate-600"
            }`}
          >
            {status}
          </div>

          {/* Quick adds 2x2 */}
          <div className="mx-auto grid w-[88%] grid-cols-2 gap-2.5">
            {QUICK_ADDS.map((n) => (
              <button
                key={n}
                type="button"
                disabled={roomLeft <= 0}
                onClick={() => add(n)}
                className={`rounded-md border-2 py-2.5 text-base font-bold shadow-sm active:scale-[0.97] ${
                  roomLeft <= 0
                    ? "cursor-not-allowed border-slate-300 bg-slate-100 text-slate-400"
                    : "border-[var(--jade)]/55 bg-white/85 text-[var(--jade-deep)]"
                }`}
              >
                +{n >= 1000 ? n.toLocaleString("en-US").replace(/,/g, "") : n}
              </button>
            ))}
          </div>

          {/* Confirm */}
          <button
            type="button"
            disabled={insufficient}
            onClick={confirm}
            className={`relative mx-auto mt-4 flex w-[90%] items-center justify-center rounded-xl py-3 text-lg font-extrabold tracking-wide text-[#e8fff8] shadow-lg transition ${
              insufficient
                ? "cursor-not-allowed bg-slate-300 text-slate-500"
                : "bg-gradient-to-r from-[var(--jade-soft)] via-[var(--jade)] to-[var(--jade-deep)] active:scale-[0.98]"
            }`}
          >
            {!insufficient && (
              <>
                <svg
                  className="absolute left-3 top-2 h-3.5 w-3.5 text-amber-200"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M12 2l2.4 7.2H22l-6 4.4 2.3 7.2L12 16.8 5.7 20.8 8 13.6 2 9.2h7.6L12 2z" />
                </svg>
                <svg
                  className="absolute bottom-2 right-3 h-3.5 w-3.5 text-amber-200"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M12 2l2.4 7.2H22l-6 4.4 2.3 7.2L12 16.8 5.7 20.8 8 13.6 2 9.2h7.6L12 2z" />
                </svg>
              </>
            )}
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}
