import { FormEvent, useEffect, useState } from "react";
import { VIP_ROUNDS_REQUIRED, userShowsVip } from "../auth";
import { formatXu } from "../cards";
import { VipFantasyAvatar } from "./VipFantasyAvatar";
import { CultivationChip } from "./CultivationChip";
import { CoupleAvatar } from "./CoupleAvatar";
import { isRingEmoji, type UserBondSnippet } from "../rings";

export interface PlayerInfoView {
  name: string;
  avatar: string;
  isBot?: boolean;
  code?: string;
  winToday?: number;
  guessesToday?: number;
  /** Khách chưa login */
  isGuest?: boolean;
  userId?: string;
  /** Socket session id (Tarot) — admin chỉnh xu khách */
  socketId?: string;
  guestCode?: string;
  balance?: number;
  outcomeMode?: "normal" | "win" | "lose";
  isVip?: boolean;
  roundsPlayed?: number;
  vipGranted?: boolean;
  cultivationRank?: string | null;
  /** Bond active của người được xem */
  bond?: UserBondSnippet | null;
}

interface PlayerInfoSheetProps {
  open: boolean;
  player: PlayerInfoView | null;
  /** User đang đăng nhập (để tặng xu) */
  meId?: string | null;
  canGift?: boolean;
  staff?: boolean;
  /** Deal / admin / mainadmin — chỉ cộng trừ xu (không outcome/VIP) */
  balanceOperator?: boolean;
  busy?: boolean;
  giftBusy?: boolean;
  onClose: () => void;
  onSetOutcome?: (userId: string, mode: "normal" | "win" | "lose") => void;
  onSetVip?: (userId: string, isVip: boolean) => void;
  onAdjustBalance?: (userId: string, delta: number) => void;
  onAdjustGuestBalance?: (opts: {
    socketId?: string;
    guestCode?: string;
    delta: number;
  }) => void;
  onGiftXu?: (opts: {
    toUserId?: string;
    toCode?: string;
    amount: number;
  }) => void;
  /** Mở hub catalog quà demo với người này */
  onOpenGiftHub?: () => void;
  /** Mở cầu hôn với người này (cả hai chưa bonded) */
  onOpenRingPropose?: () => void;
  /** Viewer đang có bond (active|pending) — ẩn nút cầu hôn */
  viewerBonded?: boolean;
}

export function PlayerInfoSheet({
  open,
  player,
  meId,
  canGift,
  staff,
  balanceOperator,
  busy,
  giftBusy,
  onClose,
  onSetOutcome,
  onSetVip,
  onAdjustBalance,
  onAdjustGuestBalance,
  onGiftXu,
  onOpenGiftHub,
  onOpenRingPropose,
  viewerBonded,
}: PlayerInfoSheetProps) {
  const [delta, setDelta] = useState("");
  const [giftAmount, setGiftAmount] = useState("");
  const [localMode, setLocalMode] = useState<"normal" | "win" | "lose">(
    "normal",
  );
  const [localBalance, setLocalBalance] = useState<number | undefined>();
  const [localGranted, setLocalGranted] = useState(false);

  useEffect(() => {
    if (!player) return;
    setLocalMode(player.outcomeMode ?? "normal");
    setLocalBalance(player.balance);
    setLocalGranted(!!player.vipGranted);
    setDelta("");
    setGiftAmount("");
  }, [player]);

  if (!open || !player) return null;

  const kind = player.isBot
    ? "Bot"
    : player.code
      ? "Người chơi"
      : player.isGuest
        ? "Khách"
        : "Người chơi";

  const rounds = player.roundsPlayed ?? 0;
  const autoVip = rounds >= VIP_ROUNDS_REQUIRED;
  const showVip = userShowsVip({
    isVip: player.isVip,
    vipGranted: player.vipGranted,
    roundsPlayed: rounds,
  });

  const canManageUser = !!(staff && player.userId && !player.isBot);
  const canBalanceUser = !!(
    (staff || balanceOperator) &&
    player.userId &&
    !player.isBot
  );
  const canManageGuest = !!(
    staff &&
    !player.isBot &&
    player.isGuest &&
    (player.guestCode || player.socketId)
  );
  const canManage = canManageUser || canBalanceUser || canManageGuest;

  const showGift = !!(
    canGift &&
    onGiftXu &&
    !player.isBot &&
    !player.isGuest &&
    (player.userId || player.code) &&
    meId &&
    player.userId !== meId
  );

  const targetBonded = player.bond?.status === "active";
  const showRingPropose = !!(
    onOpenRingPropose &&
    !player.isBot &&
    !player.isGuest &&
    (player.userId || player.code) &&
    meId &&
    player.userId !== meId &&
    !viewerBonded &&
    !targetBonded
  );

  const submitDelta = (e: FormEvent) => {
    e.preventDefault();
    const n = Number(delta);
    if (!Number.isFinite(n) || n === 0) return;
    const d = Math.floor(n);
    if (canBalanceUser && player.userId && onAdjustBalance) {
      onAdjustBalance(player.userId, d);
      return;
    }
    if (
      canManageGuest &&
      onAdjustGuestBalance &&
      (player.socketId || player.guestCode)
    ) {
      onAdjustGuestBalance({
        socketId: player.socketId,
        guestCode: player.guestCode,
        delta: d,
      });
    }
  };

  const submitGift = (e: FormEvent) => {
    e.preventDefault();
    if (!onGiftXu || giftBusy) return;
    const n = Math.floor(Number(giftAmount));
    if (!Number.isFinite(n) || n <= 0) return;
    onGiftXu({
      toUserId: player.userId,
      toCode: player.code,
      amount: n,
    });
  };

  return (
    <div className="fixed inset-0 z-[66] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div className="sheet-shell relative z-10 max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-t-2xl px-5 pb-6 pt-5 shadow-xl ring-1 ring-[var(--jade)]/40 sm:rounded-2xl">
        <div className="mb-3 flex items-start justify-between gap-2">
          <p className="font-display text-sm tracking-wide text-[var(--jade-soft)]">
            Thông tin
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80"
          >
            Đóng
          </button>
        </div>

        <div
          className={`player-info-hero${showVip ? " player-info-hero--vip" : ""}`}
        >
          <div className="mx-auto flex justify-center">
            {targetBonded && player.bond ? (
              <CoupleAvatar
                avatarA={player.avatar || "/assets/ui/avatar-default.png"}
                avatarB={player.bond.partnerAvatar}
                ringImage={player.bond.ringImage}
                ringAlt={player.bond.ringNameVi}
                ringEffect={player.bond.ringEffect}
                ringSharpness={player.bond.ringSharpness}
              />
            ) : showVip ? (
              <VipFantasyAvatar
                size="lg"
                src={player.avatar || "/assets/ui/avatar-default.png"}
                alt=""
              />
            ) : (
              <img
                src={player.avatar || "/assets/ui/avatar-default.png"}
                alt=""
                className="player-info-hero__avatar"
              />
            )}
          </div>
          <div className="player-info-hero__body mt-3">
            <p className="font-play text-lg font-bold text-[var(--cream)] drop-shadow-sm">
              {player.name}
            </p>
            {targetBonded && player.bond && (
              <p className="mt-1 flex items-center justify-center gap-1 text-[11px] text-rose-200/90">
                {isRingEmoji(player.bond.ringImage) ? (
                  <span>{player.bond.ringImage}</span>
                ) : (
                  <img
                    src={player.bond.ringImage}
                    alt=""
                    className="h-4 w-4 object-contain"
                  />
                )}
                <span>
                  {player.bond.ringNameVi} · với {player.bond.partnerName}
                </span>
              </p>
            )}
            <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1">
              <span className="identity-chip identity-chip--role !text-[9px]">
                {kind}
              </span>
              <CultivationChip rank={player.cultivationRank} />
              {showVip && (
                <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-extrabold text-[#1a1208] shadow ring-1 ring-amber-200/80">
                  VIP
                </span>
              )}
            </div>
            {player.code && (
              <span
                className={`identity-chip identity-chip--code${
                  showVip ? " identity-chip--code-vip" : ""
                }`}
                title={showVip ? "ID VIP" : "ID"}
              >
                ID {player.code}
              </span>
            )}
            {player.guestCode && (
              <span
                className="identity-chip identity-chip--code mt-1"
                title="Mã khách"
              >
                {player.guestCode}
              </span>
            )}
            {player.userId && !player.isBot && (
              <p className="mt-2 text-[11px] tabular-nums text-[var(--cream)]/65">
                Đã chơi {rounds.toLocaleString("vi-VN")} /{" "}
                {VIP_ROUNDS_REQUIRED.toLocaleString("vi-VN")} ván
              </p>
            )}
          </div>
        </div>

        {!player.isBot && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/10">
              <p className="text-[10px] text-white/45">Thắng hôm nay</p>
              <p className="font-play mt-0.5 text-sm font-bold text-amber-200 tabular-nums">
                {formatXu(player.winToday ?? 0)} xu
              </p>
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/10">
              <p className="text-[10px] text-white/45">Lần đoán hôm nay</p>
              <p className="font-play mt-0.5 text-sm font-bold text-[var(--gold-soft)] tabular-nums">
                {player.guessesToday ?? 0}
              </p>
            </div>
          </div>
        )}

        {showRingPropose && (
          <div className="mt-4 rounded-xl bg-white/5 px-3 py-3 ring-1 ring-rose-400/35">
            <p className="text-[11px] font-bold uppercase tracking-wide text-rose-200/90">
              Lên nhẫn
            </p>
            <p className="mt-1 text-[10px] text-white/45">
              Cầu hôn — trừ xu theo giá nhẫn (xu ảo)
            </p>
            <button
              type="button"
              onClick={onOpenRingPropose}
              className="mt-2 w-full rounded-lg bg-rose-500/90 px-3 py-2 text-xs font-bold text-white"
            >
              Cầu hôn / Lên nhẫn
            </button>
          </div>
        )}

        {showGift && (
          <div className="mt-4 space-y-2 rounded-xl bg-white/5 px-3 py-3 ring-1 ring-[var(--jade)]/35">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--jade-soft)]">
              Tặng quà / xu
            </p>
            <p className="text-[10px] text-white/45">
              Chuyển xu trực tiếp · tối thiểu 10 · tối đa 100.000 / lần
            </p>
            {onOpenGiftHub && (
              <button
                type="button"
                disabled={giftBusy}
                onClick={onOpenGiftHub}
                className="w-full rounded-lg bg-[var(--jade)]/90 px-3 py-2 text-xs font-bold text-white disabled:opacity-45"
              >
                Mở hub quà demo
              </button>
            )}
            <div className="flex flex-wrap gap-1">
              {[100, 500, 1000, 5000].map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={giftBusy}
                  onClick={() => setGiftAmount(String(n))}
                  className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/85 ring-1 ring-white/15 disabled:opacity-45"
                >
                  {formatXu(n)}
                </button>
              ))}
            </div>
            <form onSubmit={submitGift} className="flex gap-1.5">
              <input
                value={giftAmount}
                onChange={(e) => setGiftAmount(e.target.value)}
                placeholder="Số xu…"
                inputMode="numeric"
                disabled={giftBusy}
                className="min-w-0 flex-1 rounded-lg border-0 bg-white/10 px-2 py-1.5 text-xs text-white outline-none ring-1 ring-white/15 placeholder:text-white/35"
              />
              <button
                type="submit"
                disabled={giftBusy || !giftAmount.trim()}
                className="shrink-0 rounded-lg bg-[var(--jade)] px-3 text-xs font-bold text-white disabled:opacity-45"
              >
                {giftBusy ? "…" : "Tặng"}
              </button>
            </form>
          </div>
        )}

        {staff && !canManage && (
          <p className="mt-4 rounded-xl bg-white/5 px-3 py-2 text-center text-[11px] text-white/50 ring-1 ring-white/10">
            Không quản lý được ({player.isBot ? "bot" : "khách offline"})
          </p>
        )}

        {canManage && (
          <div className="mt-4 space-y-3 rounded-xl bg-white/5 px-3 py-3 ring-1 ring-[var(--gold)]/30">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--gold-soft)]">
              Xử lý (admin)
              {canBalanceUser && !canManageUser ? " · chỉnh xu" : ""}
              {canManageGuest && !canManageUser && !canBalanceUser ? " · khách" : ""}
              {canManageGuest && !canManageUser && canBalanceUser ? "" : ""}
            </p>
            {localBalance != null && (
              <p className="text-xs text-white/70">
                Số dư:{" "}
                <span className="font-play font-bold text-amber-200 tabular-nums">
                  {formatXu(localBalance)} xu
                </span>
              </p>
            )}

            {canManageUser && (
              <>
            <div>
              <p className="mb-1.5 text-[10px] text-white/45">
                Mode kết quả ván
              </p>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ["lose", "Lose"],
                    ["normal", "Normal"],
                    ["win", "Win"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (!player.userId || !onSetOutcome) return;
                      setLocalMode(mode);
                      onSetOutcome(player.userId, mode);
                    }}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold disabled:opacity-45 ${
                      localMode === mode
                        ? mode === "win"
                          ? "bg-emerald-600 text-white"
                          : mode === "lose"
                            ? "bg-rose-600 text-white"
                            : "bg-[var(--wood)] text-white"
                        : "bg-white/10 text-white/80 ring-1 ring-white/15"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[10px] text-white/45">
                VIP10K (tắt không gỡ VIP đủ 10k ván)
              </p>
              <p className="mb-1.5 text-[10px] text-white/40 tabular-nums">
                {rounds.toLocaleString("vi-VN")} ván
                {showVip
                  ? localGranted
                    ? " · đang VIP10K (cấp thủ công)"
                    : autoVip
                      ? " · đang VIP (đủ ván)"
                      : " · đang VIP"
                  : " · chưa VIP"}
              </p>
              <button
                type="button"
                disabled={busy || !onSetVip}
                onClick={() => {
                  if (!player.userId || !onSetVip) return;
                  const next = !localGranted;
                  setLocalGranted(next);
                  onSetVip(player.userId, next);
                }}
                className={`rounded-full px-3 py-1 text-[10px] font-bold disabled:opacity-45 ${
                  localGranted
                    ? "bg-amber-500 text-[#1a1208]"
                    : "bg-white/10 text-white/80 ring-1 ring-white/15"
                }`}
              >
                {localGranted ? "Đang VIP10K" : "Cấp VIP10K"}
              </button>
            </div>
              </>
            )}

            <div>
              <p className="mb-1.5 text-[10px] text-white/45">Cộng / trừ xu</p>
              <div className="mb-1.5 flex flex-wrap gap-1">
                {[100, 1000, -100, -1000].map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (canBalanceUser && player.userId && onAdjustBalance) {
                        onAdjustBalance(player.userId, n);
                        return;
                      }
                      if (
                        canManageGuest &&
                        onAdjustGuestBalance &&
                        (player.socketId || player.guestCode)
                      ) {
                        onAdjustGuestBalance({
                          socketId: player.socketId,
                          guestCode: player.guestCode,
                          delta: n,
                        });
                      }
                    }}
                    className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/85 ring-1 ring-white/15 disabled:opacity-45"
                  >
                    {n > 0 ? `+${formatXu(n)}` : formatXu(n)}
                  </button>
                ))}
              </div>
              <form onSubmit={submitDelta} className="flex gap-1.5">
                <input
                  value={delta}
                  onChange={(e) => setDelta(e.target.value)}
                  placeholder="Delta (+/-)"
                  disabled={busy}
                  className="min-w-0 flex-1 rounded-lg border-0 bg-white/10 px-2 py-1.5 text-xs text-white outline-none ring-1 ring-white/15 placeholder:text-white/35"
                />
                <button
                  type="submit"
                  disabled={busy || !delta.trim()}
                  className="shrink-0 rounded-lg bg-[var(--gold)] px-3 text-xs font-bold text-[#1a1208] disabled:opacity-45"
                >
                  Áp
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
