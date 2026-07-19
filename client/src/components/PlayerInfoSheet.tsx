import { FormEvent, useEffect, useState } from "react";
import { VIP_ROUNDS_REQUIRED } from "../auth";
import { formatXu } from "../cards";

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
  balance?: number;
  outcomeMode?: "normal" | "win" | "lose";
  isVip?: boolean;
  roundsPlayed?: number;
  vipGranted?: boolean;
}

interface PlayerInfoSheetProps {
  open: boolean;
  player: PlayerInfoView | null;
  staff?: boolean;
  busy?: boolean;
  onClose: () => void;
  onSetOutcome?: (userId: string, mode: "normal" | "win" | "lose") => void;
  onSetVip?: (userId: string, isVip: boolean) => void;
  onAdjustBalance?: (userId: string, delta: number) => void;
}

export function PlayerInfoSheet({
  open,
  player,
  staff,
  busy,
  onClose,
  onSetOutcome,
  onSetVip,
  onAdjustBalance,
}: PlayerInfoSheetProps) {
  const [delta, setDelta] = useState("");
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

  const canManage = !!(staff && player.userId && !player.isBot);

  const submitDelta = (e: FormEvent) => {
    e.preventDefault();
    if (!player.userId || !onAdjustBalance) return;
    const n = Number(delta);
    if (!Number.isFinite(n) || n === 0) return;
    onAdjustBalance(player.userId, Math.floor(n));
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
          className={`player-info-hero${player.isVip ? " player-info-hero--vip" : ""}`}
        >
          <img
            src={player.avatar || "/assets/ui/avatar-default.png"}
            alt=""
            className="player-info-hero__avatar mx-auto"
          />
          <div className="player-info-hero__body mt-3">
            <p className="font-play text-lg font-bold text-[var(--cream)] drop-shadow-sm">
              {player.name}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1">
              <span className="identity-chip identity-chip--role !text-[9px]">
                {kind}
              </span>
              {player.isVip && (
                <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-extrabold text-[#1a1208] shadow ring-1 ring-amber-200/80">
                  VIP
                </span>
              )}
            </div>
            {player.code && (
              <span
                className={`identity-chip identity-chip--code${
                  player.isVip ? " identity-chip--code-vip" : ""
                }`}
                title={player.isVip ? "ID VIP" : "ID"}
              >
                ID {player.code}
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

        {staff && !canManage && (
          <p className="mt-4 rounded-xl bg-white/5 px-3 py-2 text-center text-[11px] text-white/50 ring-1 ring-white/10">
            Không quản lý được ({player.isBot ? "bot" : "khách"})
          </p>
        )}

        {canManage && (
          <div className="mt-4 space-y-3 rounded-xl bg-white/5 px-3 py-3 ring-1 ring-[var(--gold)]/30">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--gold-soft)]">
              Xử lý (admin)
            </p>
            {localBalance != null && (
              <p className="text-xs text-white/70">
                Số dư:{" "}
                <span className="font-play font-bold text-amber-200 tabular-nums">
                  {formatXu(localBalance)} xu
                </span>
              </p>
            )}

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
                VIP admin (tắt không gỡ VIP đủ 10k ván)
              </p>
              <p className="mb-1.5 text-[10px] text-white/40 tabular-nums">
                {rounds.toLocaleString("vi-VN")} ván
                {player.isVip
                  ? localGranted
                    ? " · đang VIP (cấp thủ công)"
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
                {localGranted ? "Đang cấp admin" : "Cấp VIP admin"}
              </button>
            </div>

            <div>
              <p className="mb-1.5 text-[10px] text-white/45">Cộng / trừ xu</p>
              <div className="mb-1.5 flex flex-wrap gap-1">
                {[100, 1000, -100, -1000].map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (!player.userId || !onAdjustBalance) return;
                      onAdjustBalance(player.userId, n);
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
