import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../auth";
import { formatXu } from "../cards";
import {
  DEFAULT_RINGS,
  isRingEmoji,
  normalizeRingCategory,
  normalizeRingEffect,
  RING_CATEGORIES,
  COUPLE_PHRASE_DEFAULT,
  COUPLE_PHRASE_MAX,
  coupleWithLabel,
  ringAllowsCustomPhrase,
  type RingCategory,
  type RingItem,
  type UserBondSnippet,
} from "../rings";

export interface RingHubTarget {
  userId?: string;
  code?: string;
  username?: string;
  name: string;
}

interface RingProposeSheetProps {
  open: boolean;
  balance?: number;
  busy?: boolean;
  preset?: RingHubTarget | null;
  onlineHints?: RingHubTarget[];
  onClose: () => void;
  onPropose: (opts: {
    ring: RingItem;
    toUserId?: string;
    toCode?: string;
    toUsername?: string;
    note?: string;
  }) => void | Promise<void>;
}

function RingThumb({
  ring,
  selected,
}: {
  ring: RingItem;
  selected?: boolean;
}) {
  const effect = normalizeRingEffect(ring.effect);
  const fxClass =
    selected && effect === "glow"
      ? "ring-fx ring-fx--glow"
      : selected && effect === "pulse"
        ? "ring-fx ring-fx--pulse"
        : selected && effect === "sparkle"
          ? "ring-fx ring-fx--sparkle"
          : selected && effect === "orbit"
            ? "ring-fx ring-fx--orbit"
            : selected
              ? "ring-fx ring-fx--glow"
              : "";

  return (
    <div
      className={`relative mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
        selected
          ? "couple-avatar__ring-badge shadow-[0_0_16px_rgba(255,120,160,0.4)]"
          : "bg-gradient-to-b from-white/12 to-white/[0.03] ring-1 ring-white/10"
      }`}
    >
      <span
        className={`relative flex h-12 w-12 items-center justify-center ${fxClass}`}
      >
        {isRingEmoji(ring.image) ? (
          <span className="text-3xl leading-none drop-shadow-sm">
            {ring.image}
          </span>
        ) : (
          <img
            src={ring.image}
            alt=""
            className="h-11 w-11 object-contain drop-shadow-md"
            draggable={false}
          />
        )}
      </span>
    </div>
  );
}

export function RingProposeSheet({
  open,
  balance,
  busy,
  preset,
  onlineHints = [],
  onClose,
  onPropose,
}: RingProposeSheetProps) {
  const [catalog, setCatalog] = useState<RingItem[]>(DEFAULT_RINGS);
  const [category, setCategory] = useState<RingCategory>("classic");
  const [ringKey, setRingKey] = useState(DEFAULT_RINGS[0]!.key);
  const [toCode, setToCode] = useState("");
  const [toUsername, setToUsername] = useState("");
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<RingHubTarget | null>(null);
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
    void api<{ ok: true; rings: RingItem[] }>("/api/rings")
      .then((r) => {
        if (cancelled) return;
        const rings = (r.rings ?? [])
          .filter((g) => g.enabled !== false)
          .map((g) => ({
            ...g,
            category: normalizeRingCategory(g.category, g.key),
          }));
        if (rings.length) {
          setCatalog(rings);
          const firstCat =
            RING_CATEGORIES.find((c) =>
              rings.some((g) => g.category === c.id),
            )?.id ?? "classic";
          setCategory(firstCat);
          const first =
            rings.find((g) => g.category === firstCat) ?? rings[0]!;
          setRingKey(first.key);
        } else {
          setCatalog(DEFAULT_RINGS);
          setCategory("classic");
          setRingKey(DEFAULT_RINGS[0]!.key);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setCatalog(DEFAULT_RINGS);
        setCategory("classic");
        setRingKey(DEFAULT_RINGS[0]!.key);
        setLoadNote("Dùng catalog mặc định (API nhẫn lỗi)");
      });
    return () => {
      cancelled = true;
    };
  }, [open, preset]);

  const byCategory = useMemo(
    () =>
      catalog.filter(
        (g) => normalizeRingCategory(g.category, g.key) === category,
      ),
    [catalog, category],
  );

  const ring = useMemo(() => {
    return (
      catalog.find((g) => g.key === ringKey) ??
      byCategory[0] ??
      catalog[0] ??
      DEFAULT_RINGS[0]!
    );
  }, [catalog, ringKey, byCategory]);

  const insufficient =
    typeof balance === "number" && Number.isFinite(balance)
      ? balance < ring.price
      : false;

  if (!open) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (busy || insufficient) return;
    const code = toCode.trim().toUpperCase();
    const username = toUsername.trim();
    if (!picked?.userId && !code && !username) return;
    void onPropose({
      ring,
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
      aria-label="Cầu hôn / Lên nhẫn"
      onClick={onClose}
    >
      <div
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-[#16100c] shadow-2xl ring-1 ring-rose-400/35 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-white/10 bg-[#16100c]/95 px-3 py-2.5 backdrop-blur">
          <div className="min-w-0">
            <p className="play-heading truncate text-sm !text-rose-200">
              Cầu hôn / Lên nhẫn
            </p>
            <p className="text-[10px] text-white/45">
              Trừ xu người cầu hôn · đối phương chấp nhận · xu ảo
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
          {loadNote && (
            <p className="text-[10px] text-amber-200/80">{loadNote}</p>
          )}

          <div className="flex flex-wrap gap-1">
            {RING_CATEGORIES.map((c) => {
              const count = catalog.filter(
                (g) => normalizeRingCategory(g.category, g.key) === c.id,
              ).length;
              if (!count) return null;
              const on = category === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setCategory(c.id);
                    const first = catalog.find(
                      (g) => normalizeRingCategory(g.category, g.key) === c.id,
                    );
                    if (first) setRingKey(first.key);
                  }}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition ${
                    on
                      ? "bg-gradient-to-r from-rose-700 to-rose-500 text-white shadow-[0_0_12px_rgba(244,63,94,0.35)] ring-1 ring-rose-300/50"
                      : "bg-white/10 text-white/75 ring-1 ring-white/15 hover:bg-white/14"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-white/50">
              Chọn nhẫn
            </p>
            <div className="grid grid-cols-2 gap-2">
              {byCategory.map((g) => {
                const on = g.key === ring.key;
                return (
                  <button
                    key={g.key}
                    type="button"
                    disabled={busy}
                    onClick={() => setRingKey(g.key)}
                    className={`rounded-xl px-2 py-2.5 text-left ring-1 transition ${
                      on
                        ? "bg-gradient-to-br from-rose-500/35 via-rose-900/25 to-amber-900/20 ring-rose-300/60 shadow-[0_0_16px_rgba(244,63,94,0.22)]"
                        : "bg-white/5 ring-white/10 hover:bg-white/8 hover:ring-white/20"
                    }`}
                  >
                    <RingThumb ring={g} selected={on} />
                    <span className="mt-1.5 block truncate text-center text-[11px] font-bold text-white/90">
                      {g.nameVi}
                    </span>
                    <span className="block text-center text-[10px] tabular-nums text-rose-200/90">
                      {formatXu(g.price)} xu
                    </span>
                  </button>
                );
              })}
            </div>
            {ring.blurb && (
              <p className="mt-1.5 text-center text-[10px] text-white/45">
                {ring.blurb}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/50">
              Đối phương
            </p>
            {picked && (
              <p className="rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] text-rose-100/90 ring-1 ring-white/10">
                {picked.name}
                {picked.code ? ` · ID ${picked.code}` : ""}
              </p>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              <label className="text-[10px] text-white/50">
                Mã ID
                <input
                  value={toCode}
                  onChange={(e) => {
                    setToCode(e.target.value);
                    setPicked(null);
                  }}
                  disabled={busy}
                  placeholder="U7K2…"
                  className="mt-0.5 w-full rounded-lg border-0 bg-white/10 px-2 py-1.5 font-mono text-xs text-white outline-none ring-1 ring-white/15 placeholder:text-white/35"
                />
              </label>
              <label className="text-[10px] text-white/50">
                Username
                <input
                  value={toUsername}
                  onChange={(e) => {
                    setToUsername(e.target.value);
                    setPicked(null);
                  }}
                  disabled={busy}
                  placeholder="@tên"
                  className="mt-0.5 w-full rounded-lg border-0 bg-white/10 px-2 py-1.5 text-xs text-white outline-none ring-1 ring-white/15 placeholder:text-white/35"
                />
              </label>
            </div>
            {onlineHints.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {onlineHints.slice(0, 8).map((h) => (
                  <button
                    key={h.userId || h.code || h.name}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setPicked(h);
                      setToCode(h.code ?? "");
                      setToUsername(h.username ?? "");
                    }}
                    className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/80 ring-1 ring-white/15"
                  >
                    {h.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="block text-[10px] text-white/50">
            Lời nhắn (tuỳ chọn)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={busy}
              maxLength={80}
              className="mt-0.5 w-full rounded-lg border-0 bg-white/10 px-2 py-1.5 text-xs text-white outline-none ring-1 ring-white/15"
            />
          </label>

          <div className="flex items-center justify-between gap-2 text-[11px] text-white/60">
            <span>
              Giá:{" "}
              <strong className="text-rose-200">{formatXu(ring.price)} xu</strong>
            </span>
            {typeof balance === "number" && (
              <span>
                Số dư: {formatXu(balance)}
                {insufficient ? " · thiếu" : ""}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={
              busy ||
              insufficient ||
              (!picked?.userId && !toCode.trim() && !toUsername.trim())
            }
            className="w-full rounded-xl bg-gradient-to-r from-rose-700 to-rose-500 px-3 py-2.5 text-sm font-bold text-white shadow-[0_4px_18px_rgba(244,63,94,0.28)] disabled:opacity-45"
          >
            {busy ? "Đang gửi…" : "Gửi lời cầu hôn"}
          </button>
        </form>
      </div>
    </div>
  );
}

interface RingHubSheetProps {
  open: boolean;
  balance?: number;
  busy?: boolean;
  myBond?: UserBondSnippet | null;
  /** Bond id khi pending — để accept/reject */
  pendingBondId?: string | null;
  /** true nếu mình là người nhận pending */
  canAcceptPending?: boolean;
  onlineHints?: RingHubTarget[];
  onClose: () => void;
  onOpenPropose: () => void;
  onAccept?: () => void | Promise<void>;
  onReject?: () => void | Promise<void>;
  onBreak?: () => void | Promise<void>;
  onSaveCouplePhrase?: (phrase: string) => void | Promise<void>;
}

function DiamondPhraseEditor({
  bond,
  busy,
  onSave,
}: {
  bond: UserBondSnippet;
  busy?: boolean;
  onSave?: (phrase: string) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState(bond.couplePhrase ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(bond.couplePhrase ?? "");
  }, [bond.couplePhrase, bond.partnerId]);

  if (!ringAllowsCustomPhrase(bond.ringKey) || !onSave) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving || busy) return;
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="mt-3 rounded-lg bg-white/5 px-2.5 py-2 ring-1 ring-amber-300/25"
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-amber-200/85">
        Chữ Kim Cương · A — … — B
      </p>
      <p className="mt-0.5 text-[10px] text-white/45">
        Để trống = «{COUPLE_PHRASE_DEFAULT}» · tối đa {COUPLE_PHRASE_MAX} ký tự
      </p>
      <div className="mt-1.5 flex gap-1.5">
        <input
          value={draft}
          maxLength={COUPLE_PHRASE_MAX}
          disabled={busy || saving}
          onChange={(e) => setDraft(e.target.value.slice(0, COUPLE_PHRASE_MAX))}
          placeholder={COUPLE_PHRASE_DEFAULT}
          className="app-input !px-2 !py-1.5 flex-1 text-[11px]"
        />
        <button
          type="submit"
          disabled={busy || saving}
          className="shrink-0 rounded-lg bg-gradient-to-r from-amber-600 to-rose-500 px-2.5 py-1.5 text-[10px] font-bold text-white disabled:opacity-45"
        >
          Lưu
        </button>
      </div>
      <p className="mt-1.5 truncate text-center text-[11px] text-white/70">
        <span className="opacity-60">Bạn</span>
        <span className="mx-1.5 text-rose-200/80">——</span>
        <span className="font-bold text-amber-100">
          {coupleWithLabel(draft)}
        </span>
        <span className="mx-1.5 text-rose-200/80">——</span>
        <span className="font-medium text-white/90">{bond.partnerName}</span>
      </p>
    </form>
  );
}

export function RingHubSheet({
  open,
  balance,
  busy,
  myBond,
  pendingBondId,
  canAcceptPending,
  onClose,
  onOpenPropose,
  onAccept,
  onReject,
  onBreak,
  onSaveCouplePhrase,
}: RingHubSheetProps) {
  if (!open) return null;

  const active = myBond?.status === "active";
  const pending = myBond?.status === "pending";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center sm:px-3"
      role="dialog"
      aria-modal="true"
      aria-label="Hub nhẫn"
      onClick={onClose}
    >
      <div
        className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-[#16100c] shadow-2xl ring-1 ring-rose-400/35 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-white/10 bg-[#16100c]/95 px-3 py-2.5 backdrop-blur">
          <div className="min-w-0">
            <p className="play-heading truncate text-sm !text-rose-200">Nhẫn</p>
            <p className="text-[10px] text-white/45">
              Cặp đôi · xu ảo · không tiền thật
              {typeof balance === "number" ? ` · dư ${formatXu(balance)}` : ""}
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

        <div className="space-y-3 px-3 py-3">
          {active && myBond && (
            <div className="rounded-xl bg-gradient-to-br from-rose-500/20 via-white/5 to-amber-900/15 px-3 py-3 ring-1 ring-rose-300/35">
              <p className="text-[10px] font-bold uppercase tracking-wide text-rose-200/80">
                Đang đeo nhẫn
              </p>
              <div className="mt-2 flex items-center gap-3">
                <div className="couple-avatar__ring-badge flex h-14 w-14 shrink-0 items-center justify-center">
                  {(() => {
                    const fx = normalizeRingEffect(myBond.ringEffect);
                    const fxClass =
                      fx === "glow"
                        ? "ring-fx ring-fx--glow"
                        : fx === "pulse"
                          ? "ring-fx ring-fx--pulse"
                          : fx === "sparkle"
                            ? "ring-fx ring-fx--sparkle"
                            : fx === "orbit"
                              ? "ring-fx ring-fx--orbit"
                              : "ring-fx";
                    return (
                      <span
                        className={`flex h-11 w-11 items-center justify-center ${fxClass}`}
                      >
                        {isRingEmoji(myBond.ringImage) ? (
                          <span className="text-3xl">{myBond.ringImage}</span>
                        ) : (
                          <img
                            src={myBond.ringImage}
                            alt=""
                            className="h-10 w-10 object-contain"
                          />
                        )}
                      </span>
                    );
                  })()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white/90">
                    {myBond.ringNameVi}
                  </p>
                  <p className="truncate text-[11px] text-white/55">
                    {coupleWithLabel(myBond.couplePhrase)} {myBond.partnerName} ·
                    ID {myBond.partnerCode}
                  </p>
                </div>
              </div>
              <DiamondPhraseEditor
                bond={myBond}
                busy={busy}
                onSave={onSaveCouplePhrase}
              />
              {onBreak && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onBreak()}
                  className="mt-3 w-full rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-rose-200 ring-1 ring-rose-400/40 disabled:opacity-45"
                >
                  Tháo nhẫn / chia tay
                </button>
              )}
            </div>
          )}

          {pending && myBond && (
            <div className="rounded-xl bg-gradient-to-br from-amber-500/15 via-white/5 to-rose-900/10 px-3 py-3 ring-1 ring-amber-300/30">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-200/80">
                Lời cầu hôn đang chờ
              </p>
              <div className="mt-2 flex items-center gap-3">
                <div className="couple-avatar__ring-badge flex h-14 w-14 shrink-0 items-center justify-center opacity-90">
                  {isRingEmoji(myBond.ringImage) ? (
                    <span className="text-3xl">{myBond.ringImage}</span>
                  ) : (
                    <img
                      src={myBond.ringImage}
                      alt=""
                      className="h-10 w-10 object-contain"
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white/90">
                    {myBond.ringNameVi}
                  </p>
                  <p className="truncate text-[11px] text-white/55">
                    với {myBond.partnerName} · ID {myBond.partnerCode}
                  </p>
                </div>
              </div>
              {canAcceptPending && pendingBondId && onAccept && onReject && (
                <div className="mt-3 flex gap-1.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onAccept()}
                    className="flex-1 rounded-lg bg-gradient-to-r from-rose-700 to-rose-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-45"
                  >
                    Chấp nhận
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onReject()}
                    className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white/80 ring-1 ring-white/15 disabled:opacity-45"
                  >
                    Từ chối
                  </button>
                </div>
              )}
              {!canAcceptPending && onReject && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onReject()}
                  className="mt-3 w-full rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-white/80 ring-1 ring-white/15 disabled:opacity-45"
                >
                  Hủy lời cầu hôn
                </button>
              )}
            </div>
          )}

          {!active && !pending && (
            <div className="rounded-xl bg-white/5 px-3 py-3 text-center ring-1 ring-white/10">
              <p className="text-[11px] text-white/55">
                Bạn chưa đeo nhẫn với ai.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={onOpenPropose}
                className="mt-3 w-full rounded-xl bg-gradient-to-r from-rose-700 to-rose-500 px-3 py-2.5 text-sm font-bold text-white shadow-[0_4px_18px_rgba(244,63,94,0.28)] disabled:opacity-45"
              >
                Cầu hôn / Lên nhẫn
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
