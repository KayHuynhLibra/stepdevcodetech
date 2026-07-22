import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../auth";
import { formatXu } from "../cards";
import {
  DEFAULT_GIFTS,
  GIFT_CATEGORIES,
  type GiftCategory,
  type GiftItem,
} from "../gifts";

export interface GiftHubTarget {
  userId?: string;
  code?: string;
  username?: string;
  name: string;
}

interface GiftHubSheetProps {
  open: boolean;
  balance?: number;
  busy?: boolean;
  /** Gợi ý người nhận (click từ hồ sơ / online) */
  preset?: GiftHubTarget | null;
  onlineHints?: GiftHubTarget[];
  onClose: () => void;
  onSend: (opts: {
    gift: GiftItem;
    toUserId?: string;
    toCode?: string;
    toUsername?: string;
    note?: string;
  }) => void | Promise<void>;
}

export function GiftHubSheet({
  open,
  balance,
  busy,
  preset,
  onlineHints = [],
  onClose,
  onSend,
}: GiftHubSheetProps) {
  const [catalog, setCatalog] = useState<GiftItem[]>(DEFAULT_GIFTS);
  const [category, setCategory] = useState<GiftCategory>("warm");
  const [giftKey, setGiftKey] = useState(DEFAULT_GIFTS[0]!.key);
  const [toCode, setToCode] = useState("");
  const [toUsername, setToUsername] = useState("");
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<GiftHubTarget | null>(null);
  const [loadNote, setLoadNote] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNote("");
    setLoadNote(null);
    if (preset) {
      setPicked(preset);
      setToCode(preset.code ?? "");
      setToUsername(preset.username ?? "");
    } else {
      setPicked(null);
      setToCode("");
      setToUsername("");
    }
    let cancelled = false;
    void api<{ ok: true; gifts: GiftItem[] }>("/api/gifts")
      .then((r) => {
        if (cancelled) return;
        const gifts = (r.gifts ?? []).filter((g) => g.enabled !== false);
        if (gifts.length) {
          setCatalog(gifts);
          const firstCat =
            GIFT_CATEGORIES.find((c) => gifts.some((g) => g.category === c.id))
              ?.id ?? "warm";
          setCategory(firstCat);
          const first =
            gifts.find((g) => g.category === firstCat) ?? gifts[0]!;
          setGiftKey(first.key);
        } else {
          setCatalog(DEFAULT_GIFTS);
          setCategory("warm");
          setGiftKey(DEFAULT_GIFTS[0]!.key);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setCatalog(DEFAULT_GIFTS);
        setCategory("warm");
        setGiftKey(DEFAULT_GIFTS[0]!.key);
        setLoadNote("Dùng catalog mặc định (API quà lỗi)");
      });
    return () => {
      cancelled = true;
    };
  }, [open, preset]);

  const byCategory = useMemo(
    () => catalog.filter((g) => g.category === category),
    [catalog, category],
  );

  const gift = useMemo(() => {
    return (
      catalog.find((g) => g.key === giftKey) ??
      byCategory[0] ??
      catalog[0] ??
      DEFAULT_GIFTS[0]!
    );
  }, [catalog, giftKey, byCategory]);

  const insufficient =
    typeof balance === "number" && Number.isFinite(balance)
      ? balance < gift.price
      : false;

  if (!open) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (busy || insufficient) return;
    const code = toCode.trim().toUpperCase();
    const username = toUsername.trim();
    if (!picked?.userId && !code && !username) return;
    void onSend({
      gift,
      toUserId: picked?.userId,
      toCode: code || undefined,
      toUsername: username || undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center sm:px-3"
      role="dialog"
      aria-modal="true"
      aria-label="Tặng quà"
      onClick={onClose}
    >
      <div
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-[#16100c] shadow-2xl ring-1 ring-[var(--jade)]/35 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-white/10 bg-[#16100c]/95 px-3 py-2.5 backdrop-blur">
          <div className="min-w-0">
            <p className="play-heading truncate text-sm !text-[var(--jade-soft)]">
              Tặng quà
            </p>
            <p className="text-[10px] text-white/45">
              Xu ảo P2P · không tiền thật · tối đa 100.000 / lần
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/80"
          >
            Đóng
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3 px-3 py-3">
          <div className="flex flex-wrap gap-1">
            {GIFT_CATEGORIES.map((c) => {
              const count = catalog.filter((g) => g.category === c.id).length;
              if (!count) return null;
              const on = category === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setCategory(c.id);
                    const first = catalog.find((g) => g.category === c.id);
                    if (first) setGiftKey(first.key);
                  }}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    on
                      ? "bg-[var(--jade)] text-white"
                      : "bg-white/10 text-white/75 ring-1 ring-white/15"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-white/50">
              Chọn quà
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {byCategory.map((g) => {
                const on = g.key === gift.key;
                return (
                  <button
                    key={g.key}
                    type="button"
                    disabled={busy}
                    onClick={() => setGiftKey(g.key)}
                    className={`rounded-xl px-2.5 py-2 text-left ring-1 transition ${
                      on
                        ? "bg-[var(--jade)]/25 ring-[var(--jade)]/60"
                        : "bg-white/5 ring-white/10 hover:bg-white/8"
                    }`}
                  >
                    <p className="text-base leading-none">{g.emoji}</p>
                    <p className="mt-1 text-[11px] font-bold text-white/90">
                      {g.nameVi}
                    </p>
                    {g.blurb && (
                      <p className="text-[10px] text-white/45">{g.blurb}</p>
                    )}
                    <p className="font-play mt-0.5 text-[11px] font-bold tabular-nums text-amber-200">
                      {formatXu(g.price)} xu
                    </p>
                  </button>
                );
              })}
            </div>
            {loadNote && (
              <p className="mt-1.5 text-[10px] text-amber-200/80">{loadNote}</p>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-white/50">
              Người nhận
            </p>
            {picked && (
              <p className="mb-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--jade-soft)] ring-1 ring-white/10">
                Đang chọn: {picked.name}
                {picked.code ? ` · ID ${picked.code}` : ""}
                <button
                  type="button"
                  className="ml-2 text-[10px] text-white/50 underline"
                  onClick={() => {
                    setPicked(null);
                    setToCode("");
                    setToUsername("");
                  }}
                >
                  Đổi
                </button>
              </p>
            )}
            {!picked && (
              <div className="space-y-1.5">
                <input
                  value={toCode}
                  onChange={(e) => setToCode(e.target.value.toUpperCase())}
                  placeholder="Mã ID người nhận (vd. A1B2C)"
                  disabled={busy}
                  className="w-full rounded-lg border-0 bg-white/10 px-2.5 py-2 font-mono text-xs text-white outline-none ring-1 ring-white/15 placeholder:text-white/35"
                  autoComplete="off"
                  spellCheck={false}
                />
                <input
                  value={toUsername}
                  onChange={(e) => setToUsername(e.target.value)}
                  placeholder="Hoặc username đăng nhập"
                  disabled={busy}
                  className="w-full rounded-lg border-0 bg-white/10 px-2.5 py-2 text-xs text-white outline-none ring-1 ring-white/15 placeholder:text-white/35"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            )}
            {onlineHints.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {onlineHints.slice(0, 8).map((h) => (
                  <button
                    key={`${h.userId ?? h.code ?? h.name}`}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setPicked(h);
                      setToCode(h.code ?? "");
                      setToUsername(h.username ?? "");
                    }}
                    className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/85 ring-1 ring-white/15"
                  >
                    {h.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="block text-[10px] font-bold uppercase tracking-wide text-white/50">
            Lời nhắn (tuỳ chọn)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 60))}
              placeholder="Chúc may mắn…"
              disabled={busy}
              className="mt-1 w-full rounded-lg border-0 bg-white/10 px-2.5 py-2 text-xs text-white outline-none ring-1 ring-white/15 placeholder:text-white/35"
            />
          </label>

          {typeof balance === "number" && (
            <p className="text-[11px] text-white/55">
              Số dư của bạn:{" "}
              <span className="font-play font-bold tabular-nums text-amber-200">
                {formatXu(balance)} xu
              </span>
            </p>
          )}
          {insufficient && (
            <p className="rounded-lg bg-rose-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-rose-200 ring-1 ring-rose-400/35">
              Không đủ xu cho quà này
            </p>
          )}

          <button
            type="submit"
            disabled={
              busy ||
              insufficient ||
              (!picked?.userId && !toCode.trim() && !toUsername.trim())
            }
            className="w-full rounded-xl bg-[var(--jade)] py-3 text-sm font-extrabold text-white disabled:opacity-40"
          >
            {busy
              ? "Đang gửi…"
              : `Gửi ${gift.emoji} ${gift.nameVi} · ${formatXu(gift.price)} xu`}
          </button>
        </form>
      </div>
    </div>
  );
}
