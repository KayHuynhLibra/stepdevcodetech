import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../auth";
import { formatXu } from "../cards";
import {
  DEFAULT_RINGS,
  isRingEmoji,
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
        const rings = (r.rings ?? []).filter((g) => g.enabled !== false);
        if (rings.length) {
          setCatalog(rings);
          setRingKey(rings[0]!.key);
        } else {
          setCatalog(DEFAULT_RINGS);
          setRingKey(DEFAULT_RINGS[0]!.key);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setCatalog(DEFAULT_RINGS);
        setRingKey(DEFAULT_RINGS[0]!.key);
        setLoadNote("Dùng catalog mặc định (API nhẫn lỗi)");
      });
    return () => {
      cancelled = true;
    };
  }, [open, preset]);

  const ring = useMemo(() => {
    return (
      catalog.find((g) => g.key === ringKey) ??
      catalog[0] ??
      DEFAULT_RINGS[0]!
    );
  }, [catalog, ringKey]);

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

          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-white/50">
              Chọn nhẫn
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {catalog.map((g) => {
                const on = g.key === ring.key;
                return (
                  <button
                    key={g.key}
                    type="button"
                    disabled={busy}
                    onClick={() => setRingKey(g.key)}
                    className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-left ring-1 ${
                      on
                        ? "bg-rose-500/25 ring-rose-300/50"
                        : "bg-white/5 ring-white/10"
                    }`}
                  >
                    {isRingEmoji(g.image) ? (
                      <span className="text-xl">{g.image}</span>
                    ) : (
                      <img
                        src={g.image}
                        alt=""
                        className="h-8 w-8 object-contain"
                      />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-bold text-white/90">
                        {g.nameVi}
                      </span>
                      <span className="block text-[10px] text-white/45">
                        {formatXu(g.price)} xu
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {ring.blurb && (
              <p className="mt-1.5 text-[10px] text-white/45">{ring.blurb}</p>
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
            className="w-full rounded-xl bg-rose-500/90 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-45"
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
            <div className="rounded-xl bg-white/5 px-3 py-3 ring-1 ring-rose-300/30">
              <p className="text-[10px] font-bold uppercase tracking-wide text-rose-200/80">
                Đang đeo nhẫn
              </p>
              <div className="mt-2 flex items-center gap-2">
                {isRingEmoji(myBond.ringImage) ? (
                  <span className="text-2xl">{myBond.ringImage}</span>
                ) : (
                  <img
                    src={myBond.ringImage}
                    alt=""
                    className="h-10 w-10 object-contain"
                  />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white/90">
                    {myBond.ringNameVi}
                  </p>
                  <p className="truncate text-[11px] text-white/55">
                    với {myBond.partnerName} · ID {myBond.partnerCode}
                  </p>
                </div>
              </div>
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
            <div className="rounded-xl bg-white/5 px-3 py-3 ring-1 ring-amber-300/30">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-200/80">
                Lời cầu hôn đang chờ
              </p>
              <div className="mt-2 flex items-center gap-2">
                {isRingEmoji(myBond.ringImage) ? (
                  <span className="text-2xl">{myBond.ringImage}</span>
                ) : (
                  <img
                    src={myBond.ringImage}
                    alt=""
                    className="h-10 w-10 object-contain"
                  />
                )}
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
                    className="flex-1 rounded-lg bg-rose-500/90 px-3 py-2 text-xs font-bold text-white disabled:opacity-45"
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
                className="mt-3 w-full rounded-xl bg-rose-500/90 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-45"
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
