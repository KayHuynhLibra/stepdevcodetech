import { FormEvent, useEffect, useRef, useState } from "react";
import { formatXu } from "../cards";
import {
  CHAT_MAX_LEN,
  SHOUTS,
  chatCost,
  type ChatMode,
  type ShoutEvent,
} from "../shouts";

const VIP_BADGE_KEY = "tarot_vip_badge";

function readVipBadgeVisible(): boolean {
  try {
    return localStorage.getItem(VIP_BADGE_KEY) !== "hide";
  } catch {
    return true;
  }
}

interface ShoutBarProps {
  disabled?: boolean;
  busy?: boolean;
  lines: ShoutEvent[];
  selfAvatar?: string;
  chatLive?: boolean;
  isVip?: boolean;
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  onSendSlang: (id: string) => void;
  onSendText: (text: string) => void;
  onAvatarClick?: (line: ShoutEvent) => void;
  /** Hiện nút đăng nhập lại khi phiên chat chết */
  needRelogin?: boolean;
  onRelogin?: () => void;
  onReport?: (line: ShoutEvent) => void;
}

export function ShoutBar({
  disabled,
  busy,
  lines,
  selfAvatar,
  chatLive = false,
  isVip = false,
  mode,
  onModeChange,
  onSendSlang,
  onSendText,
  onAvatarClick,
  needRelogin,
  onRelogin,
  onReport,
}: ShoutBarProps) {
  const [text, setText] = useState("");
  const [badgeVisible, setBadgeVisible] = useState(readVipBadgeVisible);
  const listRef = useRef<HTMLDivElement>(null);
  const cost = chatCost(mode);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines]);

  const toggleBadge = () => {
    const next = !badgeVisible;
    setBadgeVisible(next);
    try {
      localStorage.setItem(VIP_BADGE_KEY, next ? "show" : "hide");
    } catch {
      /* ignore */
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || disabled || busy) return;
    onSendText(t);
    setText("");
  };

  const modes: { id: ChatMode; label: string; title: string; needVip?: boolean }[] =
    [
      { id: "no", label: "No", title: "Chat thường — chỉ trong khung" },
      {
        id: "vip",
        label: "VIP",
        title: "VIP — bay marquee (cần VIP)",
        needVip: true,
      },
      {
        id: "saint",
        label: "Saint",
        title: "Saint — toàn màn ~4.5s (10.000 xu)",
      },
    ];

  return (
    <section className="game-task mt-2 overflow-hidden px-0 py-0">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--wood-deep)]/12 px-2.5 py-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className="relative shrink-0"
            title={
              chatLive
                ? "Đang online — có thể chat"
                : "Hết phiên chat — đăng nhập lại"
            }
          >
            <img
              src={selfAvatar || "/assets/ui/avatar-default.png"}
              alt=""
              className={`h-5 w-5 rounded-full object-cover ring-1 transition ${
                chatLive
                  ? "opacity-100 ring-[var(--jade)]/70"
                  : "opacity-35 grayscale ring-black/20"
              }`}
            />
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ring-1 ring-white ${
                chatLive ? "ui-live-dot" : "bg-zinc-400"
              }`}
              aria-hidden
            />
          </span>
          <p className="text-[11px] font-bold text-[var(--play-ink)]">Chat</p>
          <div className="flex items-center gap-0.5">
            {modes.map((m) => {
              const locked = !!(m.needVip && !isVip);
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={disabled || locked}
                  title={
                    locked ? "Cần VIP để dùng mode này" : m.title
                  }
                  onClick={() => onModeChange(m.id)}
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wide disabled:opacity-40 ${
                    active
                      ? m.id === "saint"
                        ? "bg-[var(--jade)] text-[#06241e] ring-1 ring-[var(--jade-soft)]/55 shadow-sm"
                        : m.id === "vip"
                          ? "bg-amber-400 text-[#1a1208] ring-1 ring-amber-500/50 shadow-sm"
                          : "bg-[var(--wood-deep)] text-[var(--cream)] ring-1 ring-[var(--gold)]/35"
                      : "bg-[var(--wood-deep)]/[0.06] text-[var(--play-muted)] ring-1 ring-[var(--wood-deep)]/10"
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          {isVip && (
            <button
              type="button"
              disabled={disabled}
              onClick={toggleBadge}
              title={
                badgeVisible
                  ? "Ẩn huy hiệu VIP của bạn"
                  : "Hiện huy hiệu VIP"
              }
              className={`shrink-0 rounded px-1 py-0.5 text-[8px] font-bold disabled:opacity-45 ${
                badgeVisible
                  ? "text-amber-700"
                  : "text-amber-800/35"
              }`}
            >
              ★
            </button>
          )}
        </div>
        <span className="shrink-0 text-[9px] font-semibold text-amber-700 tabular-nums">
          {formatXu(cost)} xu
          {mode === "vip"
            ? " · bay"
            : mode === "saint"
              ? " · full · CD 45s"
              : ""}
        </span>
      </div>

      <div
        ref={listRef}
        className="h-16 space-y-0.5 overflow-y-auto bg-[var(--night)]/8 px-2 py-1"
      >
        {lines.length === 0 ? (
          <p className="py-2 text-center text-[10px] text-[var(--play-muted)]">
            Chưa có tin
          </p>
        ) : (
          lines.map((m, i) => (
            <div
              key={`${m.at}-${m.name}-${i}`}
              className="flex items-center gap-1 rounded px-1 py-0.5"
            >
              <button
                type="button"
                onClick={() => onAvatarClick?.(m)}
                className="shrink-0 rounded-full"
                title="Xem thông tin"
              >
                <img
                  src={m.avatar || "/assets/ui/avatar-default.png"}
                  alt=""
                  className="h-4 w-4 rounded-full object-cover"
                />
              </button>
              <p className="min-w-0 flex-1 truncate text-[10px] text-[var(--play-ink)]">
                <span className="font-bold text-[var(--wood-deep)]">{m.name}</span>
                {(m.mode === "vip" || m.fly) && (
                  <span className="ml-1 text-[9px] font-bold text-amber-700">
                    VIP
                  </span>
                )}
                {(m.mode === "saint" || m.saint) && (
                  <span className="ml-1 text-[9px] font-bold text-[var(--jade)]">
                    Saint
                  </span>
                )}
                <span className="mx-1 text-[var(--play-muted)]">·</span>
                {m.text}
              </p>
              {onReport && chatLive && (
                <button
                  type="button"
                  title="Báo cáo"
                  className="shrink-0 px-1 text-[9px] font-bold text-rose-700/80"
                  onClick={() => onReport(m)}
                >
                  !
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto border-t border-[var(--wood-deep)]/10 px-1.5 py-1">
        {SHOUTS.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={disabled || busy}
            onClick={() => onSendSlang(s.id)}
            className="app-btn-soft shrink-0 !px-2 !py-0.5 !text-[10px] disabled:opacity-45"
          >
            {s.text}
          </button>
        ))}
      </div>

      <form
        onSubmit={submit}
        className="flex gap-1 border-t border-[var(--wood-deep)]/12 px-1.5 py-1"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, CHAT_MAX_LEN))}
          maxLength={CHAT_MAX_LEN}
          disabled={disabled || busy}
          placeholder={
            disabled
              ? needRelogin
                ? "Phiên hết hạn…"
                : "Đăng nhập…"
              : mode === "saint"
                ? "Saint toàn màn…"
                : mode === "vip"
                  ? "VIP bay màn hình…"
                  : "Nhập tin…"
          }
          className="app-input !px-2 !py-1 text-[11px]"
        />
        {needRelogin ? (
          <button
            type="button"
            onClick={onRelogin}
            className="shrink-0 rounded-lg bg-amber-500 px-2.5 text-[11px] font-bold text-[#1a1208]"
          >
            Login
          </button>
        ) : (
          <button
            type="submit"
            disabled={disabled || busy || !text.trim()}
            className="app-btn-primary !w-auto shrink-0 !rounded-lg !px-2.5 !py-1.5 !text-[11px]"
          >
            Gửi
          </button>
        )}
      </form>
    </section>
  );
}
