import { FormEvent, useEffect, useState } from "react";
import { VIP_ROUNDS_REQUIRED, userShowsVip } from "../auth";
import { formatXu } from "../cards";
import { CoupleAvatar } from "./CoupleAvatar";
import { ColoredName } from "./ColoredName";
import { RoleAvatarFrame } from "./RoleAvatarFrame";
import { RoleRail } from "./RoleRail";
import { PlayLevelBadge } from "./PlayLevelBadge";
import { isRingEmoji, coupleWithLabel, type UserBondSnippet } from "../rings";
import {
  normalizeProfileTheme,
  normalizeNameFrame,
  normalizeIdFrame,
  resolveDisplayAvatarFrame,
  type ProfileThemeId,
} from "../profileStyles";
import {
  cultivationLabel,
  getCultivationColor,
  isCultivationRank,
} from "../cultivation";
import { displayBadgeDef } from "../displayBadges";
import {
  resolveRoleColorStyle,
  resolveRoleGlyph,
  resolveRoleLabel,
  type RoleLabelKey,
} from "../roleDisplay";
import { useRoleDisplay } from "./RoleRail";

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
  playLevel?: number;
  vipGranted?: boolean;
  cultivationRank?: string | null;
  nameColor?: string | null;
  nameEffect?: string | null;
  avatarFrame?: string | null;
  profileTheme?: string | null;
  nameFrame?: string | null;
  idFrame?: string | null;
  displayBadges?: string[] | null;
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
  const rd = useRoleDisplay();

  useEffect(() => {
    if (!player) return;
    setLocalMode(player.outcomeMode ?? "normal");
    setLocalBalance(player.balance);
    setLocalGranted(!!player.vipGranted);
    setDelta("");
    setGiftAmount("");
  }, [player]);

  if (!open || !player) return null;

  const roleLabelKey: RoleLabelKey = player.isBot
    ? "bot"
    : player.isGuest
      ? "guest"
      : "player";
  const kind = resolveRoleLabel(roleLabelKey, rd.roleLabels);
  const coupleLabel = resolveRoleLabel("couple", rd.roleLabels);
  const vipLabel = resolveRoleLabel("vip", rd.roleLabels);

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

  const theme: ProfileThemeId = normalizeProfileTheme(player.profileTheme);
  const nameFrame = normalizeNameFrame(player.nameFrame);
  const idFrame = normalizeIdFrame(player.idFrame);
  const displayFrame = resolveDisplayAvatarFrame(player.avatarFrame, {
    isVip: showVip,
    bonded: targetBonded,
    role: player.isGuest ? "guest" : player.isBot ? "bot" : "user",
  });
  const roleKindClass = player.isBot
    ? "role-pill--bot"
    : player.isGuest
      ? "role-pill--guest"
      : "role-pill--player";

  return (
    <div className="fixed inset-0 z-[66] flex items-end justify-center backdrop-blur-md sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-[#050A14]/70"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div
        className="profile-celestial relative z-10 max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-[#8A9BB8]/45 bg-[#0B1528]/85 px-0 pb-5 pt-2 text-[#E3D8C4] shadow-[0_0_40px_rgba(120,150,200,0.18),inset_0_0_60px_rgba(180,200,230,0.04)] backdrop-blur-xl sm:rounded-3xl"
        data-theme={theme}
        role="dialog"
        aria-label="Hồ Sơ Chiêm Tinh"
      >
        <div className="profile-celestial__ornament" aria-hidden />
        <div className="profile-celestial__stars" aria-hidden />

        <div className="relative z-[1] flex items-center justify-between px-4 py-2">
          <p className="font-display text-xl text-[#E3D8C4]">
            Hồ Sơ Chiêm Tinh
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#B0C2DE] bg-[#E8EFF8] px-5 py-1.5 text-sm font-medium text-[#1E293B] shadow-sm"
          >
            Thoát
          </button>
        </div>

        {/* Hero couple — PRIMARY */}
        <div className="relative z-[1] mx-3 mt-1 rounded-2xl border border-[#3A4E6C]/50 profile-celestial__hero">
          <div className="profile-celestial__couple-stage">
            {targetBonded && player.bond ? (
              <CoupleAvatar
                displaySize="hero"
                className="profile-celestial__couple"
                avatarA={player.avatar || "/assets/ui/avatar-default.png"}
                avatarB={player.bond.partnerAvatar}
                ringImage={player.bond.ringImage}
                ringAlt={player.bond.ringNameVi}
                ringEffect={player.bond.ringEffect}
                ringSharpness={player.bond.ringSharpness}
                coupleFrame={player.bond.coupleFrame}
                coupleBorder={player.bond.coupleBorder}
                coupleScale={player.bond.coupleScale ?? "xl"}
                coupleMotion={player.bond.coupleMotion}
                coupleGap={player.bond.coupleGap}
                coupleLayout={player.bond.coupleLayout}
                ringFrame={player.bond.ringFrame}
                ringFrameScale={player.bond.ringFrameScale}
              />
            ) : (
              <RoleAvatarFrame
                size="lg"
                src={player.avatar || "/assets/ui/avatar-default.png"}
                frame={player.avatarFrame}
                isVip={showVip}
                bonded={targetBonded}
                accountRole={
                  player.isGuest ? "guest" : player.isBot ? "bot" : "user"
                }
                alt=""
              />
            )}
          </div>
        </div>

        {/* Identity — name / ID / roles căn giữa đồng bộ */}
        <div
          className="profile-celestial__identity relative z-[1]"
          data-avatar-frame={displayFrame}
        >
          <div
            className={`profile-name-frame profile-name-frame--${nameFrame}`}
            data-frame={nameFrame}
          >
            <ColoredName
              name={player.name}
              colorId={player.nameColor}
              effectId={player.nameEffect}
              as="p"
              className="font-display text-center text-2xl font-bold leading-tight text-[#F3EAD8]"
            />
          </div>

          {targetBonded && player.bond && (
            <p className="profile-celestial__partner">
              <span className="mx-1 text-[#8A9EB8]" aria-hidden>
                ——
              </span>
              <span className="profile-celestial__with font-semibold text-[#FFD0DC]">
                {coupleWithLabel(player.bond.couplePhrase)}
              </span>
              <span className="mx-1 text-[#8A9EB8]" aria-hidden>
                ——
              </span>
              <span aria-hidden>💖</span>
              <span className="mx-1 font-medium text-[#E3D8C4]">
                {player.bond.partnerName}
              </span>
              {!isRingEmoji(player.bond.ringImage) ? (
                <img
                  src={player.bond.ringImage}
                  alt=""
                  className="inline-block h-4 w-4 object-contain align-middle"
                />
              ) : (
                <span aria-hidden>💎</span>
              )}
            </p>
          )}

          {(player.code || player.guestCode) && (
            <div className="profile-celestial__id-wrap">
              <span
                className={`profile-id-frame profile-id-frame--${idFrame}`}
                data-frame={idFrame}
              >
                <span className="profile-id-frame__label">ID</span>
                <span className="profile-id-frame__value">
                  {player.code || player.guestCode}
                </span>
              </span>
            </div>
          )}

          <div className="profile-celestial__roles" role="list">
            <RoleRail
              slots={{
                couple: targetBonded ? (
                  <span
                    className="role-pill role-pill--couple"
                    role="listitem"
                    style={resolveRoleColorStyle("couple", rd.roleColors)}
                  >
                    <span className="role-pill__glyph" aria-hidden>
                      {resolveRoleGlyph("couple")}
                    </span>
                    <span className="role-pill__text">{coupleLabel}</span>
                  </span>
                ) : null,
                vip: showVip ? (
                  <span
                    className="role-pill role-pill--vip"
                    role="listitem"
                    style={resolveRoleColorStyle("vip", rd.roleColors)}
                  >
                    <span className="role-pill__glyph" aria-hidden>
                      {resolveRoleGlyph("vip")}
                    </span>
                    <span className="role-pill__text">{vipLabel}</span>
                  </span>
                ) : null,
                cult:
                  player.cultivationRank &&
                  isCultivationRank(player.cultivationRank) ? (
                    <span
                      className="role-pill role-pill--cult"
                      role="listitem"
                      title={
                        cultivationLabel(player.cultivationRank) ?? "Cảnh giới"
                      }
                      style={{
                        ...resolveRoleColorStyle("tutien", rd.roleColors),
                        borderColor: getCultivationColor(player.cultivationRank)
                          ?.border,
                        color:
                          resolveRoleColorStyle("tutien", rd.roleColors)
                            ?.color ??
                          getCultivationColor(player.cultivationRank)?.text,
                      }}
                    >
                      <span className="role-pill__glyph" aria-hidden>
                        ᚱ
                      </span>
                      <span className="role-pill__text">
                        {cultivationLabel(player.cultivationRank)}
                      </span>
                    </span>
                  ) : null,
                role: (
                  <span
                    className={`role-pill role-pill--role ${roleKindClass}`}
                    role="listitem"
                    style={resolveRoleColorStyle(roleLabelKey, rd.roleColors)}
                  >
                    <span className="role-pill__glyph" aria-hidden>
                      {resolveRoleGlyph(roleLabelKey)}
                    </span>
                    <span className="role-pill__text">{kind}</span>
                  </span>
                ),
                badges:
                  player.displayBadges && player.displayBadges.length > 0 ? (
                    <>
                      {player.displayBadges.map((bid) => {
                        const def = displayBadgeDef(bid);
                        if (!def) return null;
                        return (
                          <span
                            key={def.id}
                            className={`role-pill role-pill--badge role-pill--badge-${def.tone}`}
                            role="listitem"
                            title={def.label}
                          >
                            <span className="role-pill__glyph" aria-hidden>
                              {def.glyph}
                            </span>
                            <span className="role-pill__text">{def.label}</span>
                          </span>
                        );
                      })}
                    </>
                  ) : null,
              }}
            />
          </div>

          {player.userId && !player.isBot && (
            <div className="profile-celestial__level w-full max-w-[16rem]">
              <PlayLevelBadge
                rounds={rounds}
                size="md"
                showTitle
                showBar
              />
            </div>
          )}

          {player.userId && !player.isBot && (
            <p className="profile-celestial__rounds">
              Đã chơi {rounds.toLocaleString("vi-VN")} /{" "}
              {VIP_ROUNDS_REQUIRED.toLocaleString("vi-VN")} ván (VIP)
            </p>
          )}
        </div>

        {!player.isBot && (
          <div className="relative z-[1] mt-3 grid grid-cols-2 gap-3 px-4 pb-1">
            <div className="flex items-center gap-3 rounded-2xl border border-[#2A3E5C] bg-[#0E1A2B]/90 p-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#152238] text-lg shadow-[0_0_12px_rgba(126,200,255,0.45)]"
                aria-hidden
              >
                💎
              </span>
              <div className="min-w-0">
                <p className="text-xs text-[#8A9EB8]">Tài Lộc</p>
                <p className="truncate text-sm font-bold text-white">
                  {formatXu(player.winToday ?? 0)}
                </p>
                <p className="text-[9px] text-[#7A8EA8]">tinh thể vũ trụ</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-[#2A3E5C] bg-[#0E1A2B]/90 p-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1C160C] text-lg shadow-[0_0_12px_rgba(200,169,104,0.4)]"
                aria-hidden
              >
                🪐
              </span>
              <div className="min-w-0">
                <p className="text-xs text-[#8A9EB8]">Dự Đoán</p>
                <p className="truncate text-sm font-bold text-white">
                  {(player.guessesToday ?? 0).toLocaleString("vi-VN")}
                </p>
              </div>
            </div>
          </div>
        )}

        {showRingPropose && (
          <div className="relative z-[1] mx-4 mt-3 rounded-2xl border border-[#8C764D]/60 bg-[#0E1A2B]/90 px-3 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#E5C158]">
              Lên nhẫn
            </p>
            <button
              type="button"
              onClick={onOpenRingPropose}
              className="mt-2 w-full rounded-lg border border-[#C8A968] bg-gradient-to-b from-[#3A2E14] to-[#1A2638] px-3 py-2 text-xs font-bold text-[#F3EAD8]"
            >
              Cầu hôn / Lên nhẫn
            </button>
          </div>
        )}

        {showGift && (
          <div className="relative z-[1] mx-4 mt-3 space-y-2 rounded-2xl border border-[#2A3E5C] bg-[#0E1A2B]/90 px-3 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#E5C158]">
              Tặng quà / xu
            </p>
            {onOpenGiftHub && (
              <button
                type="button"
                disabled={giftBusy}
                onClick={onOpenGiftHub}
                className="w-full rounded-lg border border-[#5A7A9A] bg-[#121D2D] px-3 py-2 text-xs font-bold text-[#E3D8C4] disabled:opacity-45"
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
                  className="rounded-full border border-[#8C764D]/50 bg-[#121D2D] px-2.5 py-1 text-[10px] font-bold text-[#E3D8C4] disabled:opacity-45"
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
                className="min-w-0 flex-1 rounded-lg border border-[#2A3E5C] bg-[#0B1528] px-2 py-1.5 text-xs text-[#E3D8C4] outline-none placeholder:text-[#7A8EA8]"
              />
              <button
                type="submit"
                disabled={giftBusy || !giftAmount.trim()}
                className="shrink-0 rounded-lg border border-[#C8A968] bg-[#1A2638] px-3 text-xs font-bold text-[#E5C158] disabled:opacity-45"
              >
                {giftBusy ? "…" : "Tặng"}
              </button>
            </form>
          </div>
        )}

        {staff && !canManage && (
          <p className="relative z-[1] mx-4 mt-3 rounded-2xl border border-[#2A3E5C] bg-[#0E1A2B]/90 px-3 py-2 text-center text-[11px] text-[#7A8EA8]">
            Không quản lý được ({player.isBot ? "bot" : "khách offline"})
          </p>
        )}

        {canManage && (
          <div className="relative z-[1] mx-4 mt-3 space-y-3 rounded-2xl border border-[#8C764D]/50 bg-[#0E1A2B]/90 px-3 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#E5C158]">
              Xử lý (admin)
            </p>
            {localBalance != null && (
              <p className="text-xs text-[#B0C4DE]">
                Số dư:{" "}
                <span className="font-bold tabular-nums text-[#E5C158]">
                  {formatXu(localBalance)} xu
                </span>
              </p>
            )}

            {canManageUser && (
              <>
                <div>
                  <p className="mb-1.5 text-[10px] text-[#7A8EA8]">
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
                                : "bg-[#2A3B54] text-[#E5C158]"
                            : "border border-[#2A3E5C] bg-[#0B1528] text-[#B0C4DE]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-[10px] text-[#7A8EA8]">VIP10K</p>
                  <p className="mb-1.5 text-[10px] tabular-nums text-[#7A8EA8]">
                    {rounds.toLocaleString("vi-VN")} /{" "}
                    {VIP_ROUNDS_REQUIRED.toLocaleString("vi-VN")} ván
                    {showVip
                      ? localGranted
                        ? " · VIP10K"
                        : autoVip
                          ? " · VIP"
                          : " · VIP"
                      : ""}
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
                        : "border border-[#8C764D] bg-[#121D2D] text-[#E3D8C4]"
                    }`}
                  >
                    {localGranted ? "Đang VIP10K" : "Cấp VIP10K"}
                  </button>
                </div>
              </>
            )}

            <div>
              <p className="mb-1.5 text-[10px] text-[#7A8EA8]">Cộng / trừ xu</p>
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
                    className="rounded-full border border-[#8C764D]/40 bg-[#121D2D] px-2 py-0.5 text-[10px] font-bold text-[#E3D8C4] disabled:opacity-45"
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
                  className="min-w-0 flex-1 rounded-lg border border-[#2A3E5C] bg-[#0B1528] px-2 py-1.5 text-xs text-[#E3D8C4] outline-none placeholder:text-[#7A8EA8]"
                />
                <button
                  type="submit"
                  disabled={busy || !delta.trim()}
                  className="shrink-0 rounded-lg border border-[#C8A968] bg-[#E5C158] px-3 text-xs font-bold text-[#1a1208] disabled:opacity-45"
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
