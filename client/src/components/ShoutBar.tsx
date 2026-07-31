import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { formatXu } from "../cards";
import {
  CHAT_MAX_LEN,
  SHOUTS,
  chatCost,
  type ChatMode,
  type ShoutEvent,
  type ShoutReplyRef,
} from "../shouts";
import { CultivationChip } from "./CultivationChip";
import { PlayLevelBadge } from "./PlayLevelBadge";

const VIP_BADGE_KEY = "tarot_vip_badge";

const EXTRA_REACT = [
  { id: "heart", text: "❤" },
  { id: "ok", text: "OK" },
  { id: "lol", text: "Haha" },
  { id: "wow", text: "Wow" },
];

function readVipBadgeVisible(): boolean {
  try {
    return localStorage.getItem(VIP_BADGE_KEY) !== "hide";
  } catch {
    return true;
  }
}

export type ChatMentionHint = { name: string; userId?: string };

interface ShoutBarProps {
  disabled?: boolean;
  busy?: boolean;
  lines: ShoutEvent[];
  selfAvatar?: string;
  chatLive?: boolean;
  isVip?: boolean;
  mode: ChatMode;
  chatCosts?: { no: number; vip: number; saint: number };
  onModeChange: (mode: ChatMode) => void;
  onSendSlang: (id: string) => void;
  onSendText: (
    text: string,
    meta?: { replyTo?: ShoutReplyRef; mentions?: string[] },
  ) => void;
  chatSuggests?: string[];
  onAvatarClick?: (line: ShoutEvent) => void;
  needRelogin?: boolean;
  onRelogin?: () => void;
  onReport?: (line: ShoutEvent) => void;
  /** Gợi ý @mention từ danh sách phòng */
  mentionHints?: ChatMentionHint[];
  /** Phase-2 stub — hub toàn site (chưa làm) */
  onOpenGlobalHub?: () => void;
  /** Chèn mention từ bên ngoài (PlayersSheet) */
  insertMentionRequest?: string | null;
  onInsertMentionConsumed?: () => void;
}

export function ShoutBar({
  disabled,
  busy,
  lines,
  selfAvatar,
  chatLive = false,
  isVip = false,
  mode,
  chatCosts,
  onModeChange,
  onSendSlang,
  onSendText,
  chatSuggests,
  onAvatarClick,
  needRelogin,
  onRelogin,
  onReport,
  mentionHints = [],
  onOpenGlobalHub,
  insertMentionRequest,
  onInsertMentionConsumed,
}: ShoutBarProps) {
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<ShoutReplyRef | null>(null);
  const [badgeVisible, setBadgeVisible] = useState(readVipBadgeVisible);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cost = chatCost(mode, chatCosts);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines.length, lines[lines.length - 1]?.at]);

  useEffect(() => {
    if (!insertMentionRequest) return;
    const tag = `@${insertMentionRequest} `;
    setText((t) => {
      const next = (t + (t.endsWith(" ") || !t ? "" : " ") + tag).slice(
        0,
        CHAT_MAX_LEN,
      );
      return next;
    });
    inputRef.current?.focus();
    onInsertMentionConsumed?.();
  }, [insertMentionRequest, onInsertMentionConsumed]);

  const mentionQuery = useMemo(() => {
    const m = text.match(/(?:^|\s)@([\p{L}\p{N}_.-]*)$/u);
    return m ? m[1].toLowerCase() : null;
  }, [text]);

  const mentionOptions = useMemo(() => {
    if (mentionQuery == null) return [];
    const q = mentionQuery;
    return mentionHints
      .filter((h) => h.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [mentionHints, mentionQuery]);

  const toggleBadge = () => {
    const next = !badgeVisible;
    setBadgeVisible(next);
    try {
      localStorage.setItem(VIP_BADGE_KEY, next ? "show" : "hide");
    } catch {
      /* ignore */
    }
  };

  const pickMention = (name: string) => {
    setText((t) => t.replace(/(?:^|\s)@([\p{L}\p{N}_.-]*)$/u, ` @${name} `).trimStart().slice(0, CHAT_MAX_LEN));
    inputRef.current?.focus();
  };

  const extractMentions = (raw: string): string[] => {
    const found = [...raw.matchAll(/@([\p{L}\p{N}_.-]{1,32})/gu)].map(
      (m) => m[1],
    );
    return [...new Set(found)].slice(0, 5);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || disabled || busy) return;
    onSendText(t, {
      replyTo: replyTo ?? undefined,
      mentions: extractMentions(t),
    });
    setText("");
    setReplyTo(null);
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
        title: `Saint — toàn màn ~4.5s (${formatXu(chatCosts?.saint ?? 10_000)} xu)`,
      },
    ];

  return (
    <section className="game-task social-dock mt-2 overflow-hidden px-0 py-0">
      {/* Phase-2 hook: onOpenGlobalHub — chưa gắn hub toàn site */}
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
          <p className="text-[11px] font-bold text-[var(--play-ink)]">
            Kênh chat
          </p>
          {onOpenGlobalHub ? (
            <button
              type="button"
              className="hidden"
              aria-hidden
              tabIndex={-1}
              onClick={onOpenGlobalHub}
            />
          ) : null}
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
          {formatXu(cost)} xu chơi
          {mode === "vip"
            ? " · bay"
            : mode === "saint"
              ? " · full · CD 45s"
              : ""}
        </span>
      </div>

      <div
        ref={listRef}
        className="h-36 space-y-1 overflow-y-auto bg-[var(--night)]/8 px-2 py-1.5 sm:h-40"
      >
        {lines.length === 0 ? (
          <p className="py-4 text-center text-[10px] text-[var(--play-muted)]">
            Chưa có tin · gõ @ để gọi tên · Reply để trả lời
          </p>
        ) : (
          lines.map((m, i) => (
            <div
              key={`${m.at}-${m.name}-${i}`}
              className="flex items-start gap-1 rounded px-1 py-0.5"
            >
              <button
                type="button"
                onClick={() => onAvatarClick?.(m)}
                className="mt-0.5 shrink-0 rounded-full"
                title="Xem thông tin"
              >
                <img
                  src={m.avatar || "/assets/ui/avatar-default.png"}
                  alt=""
                  className="h-5 w-5 rounded-full object-cover"
                />
              </button>
              <div className="min-w-0 flex-1">
                {m.replyTo && (
                  <p className="truncate text-[9px] text-[var(--play-muted)]">
                    ↳ {m.replyTo.name}: {m.replyTo.text}
                  </p>
                )}
                <p className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[10px] leading-snug text-[var(--play-ink)]">
                  <span className="font-bold text-[var(--wood-deep)]">
                    {m.name}
                  </span>
                  {m.roundsPlayed != null ? (
                    <PlayLevelBadge
                      rounds={m.roundsPlayed}
                      size="sm"
                      className="chat-rank-lv"
                    />
                  ) : m.playLevel != null ? (
                    <span className="text-[9px] font-bold text-[var(--wood-deep)]">
                      Lv{m.playLevel}
                    </span>
                  ) : null}
                  {m.cultivationRank ? (
                    <CultivationChip
                      rank={m.cultivationRank}
                      className="!px-1.5 !py-0 !text-[8px] chat-rank-cult"
                    />
                  ) : null}
                  {(m.isVip || m.mode === "vip" || m.fly) && (
                    <span className="text-[9px] font-bold text-amber-700">
                      VIP
                    </span>
                  )}
                  {(m.mode === "saint" || m.saint) && (
                    <span className="text-[9px] font-bold text-[var(--jade)]">
                      Saint
                    </span>
                  )}
                  <span className="text-[var(--play-muted)]">·</span>
                  <span className="min-w-0 whitespace-pre-wrap break-words">
                    {m.text}
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-0.5">
                <button
                  type="button"
                  title="Trả lời"
                  disabled={disabled}
                  className="px-1 text-[9px] font-bold text-[var(--wood-deep)] disabled:opacity-40"
                  onClick={() => {
                    setReplyTo({ name: m.name, text: m.text });
                    inputRef.current?.focus();
                  }}
                >
                  ↩
                </button>
                {onReport && chatLive && (
                  <button
                    type="button"
                    title="Báo cáo"
                    className="px-1 text-[9px] font-bold text-rose-700/80"
                    onClick={() => onReport(m)}
                  >
                    !
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {replyTo && (
        <div className="flex items-center gap-2 border-t border-[var(--wood-deep)]/10 bg-amber-50/80 px-2 py-1 text-[10px]">
          <span className="min-w-0 flex-1 truncate text-[var(--play-ink)]">
            Đang trả lời <b>@{replyTo.name}</b>: {replyTo.text}
          </span>
          <button
            type="button"
            className="shrink-0 font-bold text-[var(--play-muted)]"
            onClick={() => setReplyTo(null)}
          >
            ✕
          </button>
        </div>
      )}

      {mentionOptions.length > 0 && (
        <ul className="max-h-28 overflow-y-auto border-t border-[var(--wood-deep)]/10 bg-white/90 px-1 py-1">
          {mentionOptions.map((h) => (
            <li key={h.userId ?? h.name}>
              <button
                type="button"
                className="w-full rounded px-2 py-1 text-left text-[11px] font-semibold text-[var(--play-ink)] hover:bg-[var(--wood-deep)]/8"
                onClick={() => pickMention(h.name)}
              >
                @{h.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {chatSuggests && chatSuggests.length > 0 && (
        <div className="flex gap-1 overflow-x-auto border-t border-[var(--wood-deep)]/10 px-1.5 py-1">
          {chatSuggests.map((s) => (
            <button
              key={s}
              type="button"
              disabled={disabled || busy}
              onClick={() => onSendText(s)}
              className="shrink-0 rounded-full bg-[var(--wood-deep)]/8 px-2.5 py-0.5 text-[10px] font-semibold text-[var(--wood-deep)] ring-1 ring-[var(--wood-deep)]/15 disabled:opacity-45"
            >
              {s}
            </button>
          ))}
        </div>
      )}

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
        {EXTRA_REACT.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={disabled || busy}
            onClick={() => onSendText(s.text)}
            className="shrink-0 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/12 disabled:opacity-45"
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
          ref={inputRef}
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
                ? "Saint toàn màn… @tên"
                : mode === "vip"
                  ? "VIP bay… @tên"
                  : "Nhập tin · @mention…"
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
