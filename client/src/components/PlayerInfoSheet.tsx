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
  isGuest?: boolean;
  userId?: string;
  socketId?: string;
  guestCode?: string;
  balance?: number;
  outcomeMode?: "normal" | "win" | "lose";
  isVip?: boolean;
  roundsPlayed?: number;
  vipGranted?: boolean;
  cultivationRank?: string | null;
  bond?: UserBondSnippet | null;
}

interface PlayerInfoSheetProps {
  open: boolean;
  player: PlayerInfoView | null;
  meId?: string | null;
  canGift?: boolean;
  staff?: boolean;
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
  onOpenGiftHub?: () => void;
  onOpenRingPropose?: () => void;
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

  const pill =
    "rounded-full border border-[#C59B27] bg-[#1C160C] px-3 py-1 text-xs font-semibold text-[#E8DCB8]";

  return (
    <div className="fixed inset-0 z-[66] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/65"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div
        className="relative z-10 max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-t-2xl border-2 border-[#D4AF37] bg-gradient-to-b from-[#0B231E] via-[#071815] to-[#040C0A] px-4 pb-6 pt-4 text-[#E8DCB8] shadow-[0_0_28px_rgba(212,175,55,0.22),inset_0_0_40px_rgba(212,175,55,0.06)] sm:rounded-2xl"
        role="dialog"
        aria-label="Thông tin người chơi"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="font-display text-base tracking-wide text-[#E5C158]">
            Thông tin
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#B89748] bg-[#0F2A24] px-4 py-1 text-xs font-semibold text-[#E8DCB8]"
          >
            Đóng
          </button>
        </div>

        {/* Hero couple / avatar */}
        <div className="relative overflow-hidden rounded-2xl border border-[#2D5A50]/60 bg-[radial-gradient(circle_at_50%_40%,rgba(120,50,200,0.35)_0%,transparent_70%)] px-2 py-5">
          <div className="relative z-[1] mx-auto flex justify-center">
            {targetBonded && player.bond ? (
              <CoupleAvatar
                displaySize="hero"
                avatarA={player.avatar || "/assets/ui/avatar-default.png"}
                avatarB={player.bond.partnerAvatar}
                ringImage={player.bond.ringImage}
                ringAlt={player.bond.ringNameVi}
                ringEffect={player.bond.ringEffect}
                ringSharpness={player.bond.ringSharpness}
                coupleFrame={player.bond.coupleFrame}
                coupleBorder={player.bond.coupleBorder}
                coupleScale={player.bond.coupleScale ?? "xl"}
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
                className="h-20 w-20 rounded-full object-cover border-2 border-[#E5C158] shadow-[0_0_10px_rgba(229,193,88,0.4)]"
              />
            )}
          </div>

          <div className="relative z-[1] mt-4 text-center">
            <p className="font-display text-xl font-bold text-[#E5C158] drop-shadow">
              {player.name}
            </p>
            {targetBonded && player.bond && (
              <p className="mt-1.5 flex items-center justify-center gap-1.5 text-[12px] text-[#E8DCB8]/90">
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
                  {player.bond.ringNameVi} · với ♥ {player.bond.partnerName}
                </span>
              </p>
            )}

            {(player.code || player.guestCode) && (
              <div className="mt-3 flex justify-center">
                <span className="rounded-full border border-[#D4AF37] bg-gradient-to-b from-[#3A2E14] to-[#1C160C] px-4 py-1 font-mono text-[11px] font-bold tracking-wide text-[#E5C158] shadow-[inset_0_1px_0_rgba(255,236,180,0.25)]">
                  ID {player.code || player.guestCode}
                </span>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {showVip && <span className={pill}>VIP</span>}
              <CultivationChip rank={player.cultivationRank} />
              <span className={pill}>{kind}</span>
            </div>
          </div>
        </div>

        {!player.isBot && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-[#2D5A50] bg-[#0B201B] p-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1C160C] text-lg shadow-[0_0_8px_rgba(229,193,88,0.35)] ring-1 ring-[#C59B27]/60"
                aria-hidden
              >
                🪙
              </span>
              <div className="min-w-0">
                <p className="text-[10px] text-[#E8DCB8]/55">Thắng hôm nay</p>
                <p className="font-play truncate text-sm font-bold tabular-nums text-[#E5C158]">
                  {formatXu(player.winToday ?? 0)} xu
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-[#2D5A50] bg-[#0B201B] p-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#12182A] text-lg shadow-[0_0_10px_rgba(120,180,255,0.4)] ring-1 ring-cyan-400/40"
                aria-hidden
              >
                🔮
              </span>
              <div className="min-w-0">
                <p className="text-[10px] text-[#E8DCB8]/55">Lần đoán hôm nay</p>
                <p className="font-play truncate text-sm font-bold tabular-nums text-[#E8DCB8]">
                  {(player.guessesToday ?? 0).toLocaleString("vi-VN")}
                </p>
              </div>
            </div>
          </div>
        )}

        {showRingPropose && (
          <div className="mt-4 rounded-xl border border-[#C59B27]/50 bg-[#0B201B] px-3 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#E5C158]">
              Lên nhẫn
            </p>
            <p className="mt-1 text-[10px] text-[#E8DCB8]/55">
              Cầu hôn — trừ xu theo giá nhẫn (xu ảo)
            </p>
            <button
              type="button"
              onClick={onOpenRingPropose}
              className="mt-2 w-full rounded-full border border-[#C59B27] bg-gradient-to-b from-[#8B6914] to-[#5A420C] px-3 py-2 text-xs font-bold text-[#FFF8E0]"
            >
              Cầu hôn / Lên nhẫn
            </button>
          </div>
        )}

        {showGift && (
          <div className="mt-4 space-y-2 rounded-xl border border-[#2D5A50] bg-[#0B201B] px-3 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#E5C158]">
              Tặng quà / xu
            </p>
            <p className="text-[10px] text-[#E8DCB8]/55">
              Chuyển xu trực tiếp · tối thiểu 10 · tối đa 100.000 / lần
            </p>
            {onOpenGiftHub && (
              <button
                type="button"
                disabled={giftBusy}
                onClick={onOpenGiftHub}
                className="w-full rounded-full border border-[#3D8A70] bg-[#0F2A24] px-3 py-2 text-xs font-bold text-[#E8DCB8] disabled:opacity-45"
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
                  className="rounded-full border border-[#C59B27]/50 bg-[#1C160C] px-2.5 py-1 text-[10px] font-bold text-[#E8DCB8] disabled:opacity-45"
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
                className="min-w-0 flex-1 rounded-lg border border-[#2D5A50] bg-[#040C0A] px-2 py-1.5 text-xs text-[#E8DCB8] outline-none placeholder:text-[#E8DCB8]/35"
              />
              <button
                type="submit"
                disabled={giftBusy || !giftAmount.trim()}
                className="shrink-0 rounded-lg border border-[#C59B27] bg-[#1C160C] px-3 text-xs font-bold text-[#E5C158] disabled:opacity-45"
              >
                {giftBusy ? "…" : "Tặng"}
              </button>
            </form>
          </div>
        )}

        {staff && !canManage && (
          <p className="mt-4 rounded-xl border border-[#2D5A50] bg-[#0B201B] px-3 py-2 text-center text-[11px] text-[#E8DCB8]/55">
            Không quản lý được ({player.isBot ? "bot" : "khách offline"})
          </p>
        )}

        {canManage && (
          <div className="mt-4 space-y-3 rounded-xl border border-[#C59B27]/45 bg-[#0B201B] px-3 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#E5C158]">
              Xử lý (admin)
              {canBalanceUser && !canManageUser ? " · chỉnh xu" : ""}
              {canManageGuest && !canManageUser && !canBalanceUser
                ? " · khách"
                : ""}
            </p>
            {localBalance != null && (
              <p className="text-xs text-[#E8DCB8]/75">
                Số dư:{" "}
                <span className="font-play font-bold tabular-nums text-[#E5C158]">
                  {formatXu(localBalance)} xu
                </span>
              </p>
            )}

            {canManageUser && (
              <>
                <div>
                  <p className="mb-1.5 text-[10px] text-[#E8DCB8]/45">
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
                              ? "bg-emerald-700 text-white"
                              : mode === "lose"
                                ? "bg-rose-700 text-white"
                                : "bg-[#3A2E14] text-[#E5C158]"
                            : "border border-[#2D5A50] bg-[#040C0A] text-[#E8DCB8]/80"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-[10px] text-[#E8DCB8]/45">
                    VIP10K (tắt không gỡ VIP đủ 10k ván)
                  </p>
                  <p className="mb-1.5 text-[10px] tabular-nums text-[#E8DCB8]/40">
                    Đã chơi {rounds.toLocaleString("vi-VN")} /{" "}
                    {VIP_ROUNDS_REQUIRED.toLocaleString("vi-VN")} ván
                    {showVip
                      ? localGranted
                        ? " · VIP10K"
                        : autoVip
                          ? " · VIP (đủ ván)"
                          : " · VIP"
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
                        : "border border-[#C59B27]/50 bg-[#1C160C] text-[#E8DCB8]"
                    }`}
                  >
                    {localGranted ? "Đang VIP10K" : "Cấp VIP10K"}
                  </button>
                </div>
              </>
            )}

            <div>
              <p className="mb-1.5 text-[10px] text-[#E8DCB8]/45">Cộng / trừ xu</p>
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
                    className="rounded-full border border-[#C59B27]/40 bg-[#1C160C] px-2 py-0.5 text-[10px] font-bold text-[#E8DCB8] disabled:opacity-45"
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
                  className="min-w-0 flex-1 rounded-lg border border-[#2D5A50] bg-[#040C0A] px-2 py-1.5 text-xs text-[#E8DCB8] outline-none placeholder:text-[#E8DCB8]/35"
                />
                <button
                  type="submit"
                  disabled={busy || !delta.trim()}
                  className="shrink-0 rounded-lg border border-[#C59B27] bg-[#E5C158] px-3 text-xs font-bold text-[#1a1208] disabled:opacity-45"
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
