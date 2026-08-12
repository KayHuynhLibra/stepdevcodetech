import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  api,
  getStoredUser,
  getToken,
  homePath,
  saveSession,
  userDisplayName,
  type AuthUser,
} from "../auth";
import { formatXu } from "../cards";
import { AppShell } from "../components/AppShell";
import { GameChrome } from "../components/GameChrome";
import { GiftHubSheet } from "../components/GiftHubSheet";
import {
  GiftFlyOverlay,
  type GiftFlyQueueItem,
} from "../components/GiftFlyOverlay";
import { PlatformShell } from "../components/PlatformShell";
import {
  DEFAULT_GIFTS,
  GIFT_CATEGORIES,
  type GiftCategory,
  type GiftFlyStyle,
  type GiftItem,
} from "../gifts";

function GiftCardThumb({ gift }: { gift: GiftItem }) {
  const [failed, setFailed] = useState(false);
  const showImg = Boolean(gift.image) && !failed;
  return (
    <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-[#fff8ec] to-[#f3e2c4]">
      {showImg ? (
        <img
          src={gift.image}
          alt=""
          className="h-[72%] w-[72%] object-contain drop-shadow-md"
          onError={() => setFailed(true)}
          draggable={false}
        />
      ) : (
        <span className="text-4xl drop-shadow-sm">{gift.emoji}</span>
      )}
    </div>
  );
}

export default function GiftShopPage() {
  const nav = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(getStoredUser());
  const [catalog, setCatalog] = useState<GiftItem[]>(DEFAULT_GIFTS);
  const [category, setCategory] = useState<GiftCategory | "all">("all");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [hubOpen, setHubOpen] = useState(false);
  const [presetGiftKey, setPresetGiftKey] = useState<string | null>(null);
  const [flyQueue, setFlyQueue] = useState<GiftFlyQueueItem[]>([]);

  const social = user?.balances?.social ?? 0;

  const loadCatalog = useCallback(async () => {
    try {
      const r = await api<{ ok: true; gifts: GiftItem[] }>("/api/gifts");
      const gifts = (r.gifts ?? []).filter((g) => g.enabled !== false);
      if (gifts.length) setCatalog(gifts);
    } catch {
      setCatalog(DEFAULT_GIFTS);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      nav("/login", { replace: true });
      return;
    }
    void loadCatalog();
    void api<{ ok: true; user: AuthUser }>("/api/auth/me")
      .then((r) => {
        setUser(r.user);
        saveSession(getToken()!, r.user);
      })
      .catch(() => {
        /* keep cached */
      });
  }, [nav, loadCatalog]);

  const filtered = useMemo(() => {
    if (category === "all") return catalog;
    return catalog.filter((g) => g.category === category);
  }, [catalog, category]);

  const openSend = (gift: GiftItem) => {
    setPresetGiftKey(gift.key);
    setHubOpen(true);
  };

  const sendGift = async (opts: {
    gift: GiftItem;
    toUserId?: string;
    toCode?: string;
    toUsername?: string;
    note?: string;
  }) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{
        ok: true;
        amount: number;
        from: AuthUser;
        to: AuthUser;
        fly?: {
          id: string;
          label: string;
          style: GiftFlyStyle;
          durationMs: number;
        };
      }>("/api/auth/gift-xu", {
        method: "POST",
        body: JSON.stringify({
          giftKey: opts.gift.key,
          toUserId: opts.toUserId,
          toCode: opts.toCode,
          toUsername: opts.toUsername,
          note: opts.note,
        }),
      });
      setUser(r.from);
      saveSession(getToken()!, r.from);
      if (r.fly?.style) {
        const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setFlyQueue((q) =>
          [
            ...q,
            {
              key,
              fromName: userDisplayName(r.from),
              toName: userDisplayName(r.to),
              amount: r.amount,
              giftKey: opts.gift.key,
              giftEmoji: opts.gift.emoji,
              giftNameVi: opts.gift.nameVi,
              giftImage: opts.gift.image,
              fly: r.fly!,
            },
          ].slice(-6),
        );
      }
      setMsg(`Đã tặng ${opts.gift.nameVi} · ${formatXu(opts.gift.price)} xu`);
      setHubOpen(false);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Không gửi được quà");
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <AppShell maxWidth="md">
        <p className="p-4 text-sm text-[var(--play-muted)]">Đang tải…</p>
      </AppShell>
    );
  }

  return (
    <PlatformShell user={user} maxWidth="md" showSocial={false}>
      <GameChrome
        title="Shop quà"
        user={user}
        playBalance={user.balances?.play ?? user.balance}
        socialBalance={social}
        showNav={false}
        tools={
          <Link
            to={homePath(user)}
            className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold ring-1 ring-[var(--wood-deep)]/20"
          >
            Lobby
          </Link>
        }
      />

      <section className="app-panel mt-3 space-y-3 p-3 sm:p-4">
        <div>
          <p className="play-heading text-sm">Shop quà</p>
          <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
            Chọn quà → tặng bằng xu Quà (social). Không tiền thật.
          </p>
          <p className="mt-1 text-[11px] font-bold tabular-nums text-[var(--wood-deep)]">
            Xu quà: {formatXu(social)}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
              category === "all"
                ? "bg-[var(--wood-deep)] text-white"
                : "bg-white ring-1 ring-[var(--wood-deep)]/15"
            }`}
            onClick={() => setCategory("all")}
          >
            Tất cả
          </button>
          {GIFT_CATEGORIES.map((c) => {
            const n = catalog.filter((g) => g.category === c.id).length;
            if (!n) return null;
            return (
              <button
                key={c.id}
                type="button"
                className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
                  category === c.id
                    ? "bg-[var(--wood-deep)] text-white"
                    : "bg-white ring-1 ring-[var(--wood-deep)]/15"
                }`}
                onClick={() => setCategory(c.id)}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {msg ? (
          <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] font-semibold text-amber-950 ring-1 ring-amber-200">
            {msg}
          </p>
        ) : null}

        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {filtered.map((g) => {
            const canAfford = social >= g.price;
            return (
              <li key={g.key}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => openSend(g)}
                  className="gift-shop-card w-full text-left"
                >
                  <GiftCardThumb gift={g} />
                  <div className="mt-2 min-w-0 px-0.5">
                    <p className="truncate text-[12px] font-extrabold text-[var(--play-ink)]">
                      {g.nameVi}
                    </p>
                    {g.blurb ? (
                      <p className="mt-0.5 line-clamp-2 text-[10px] text-[var(--play-muted)]">
                        {g.blurb}
                      </p>
                    ) : null}
                    <p
                      className={`mt-1 text-[11px] font-bold tabular-nums ${
                        canAfford ? "text-[var(--wood-deep)]" : "text-rose-700"
                      }`}
                    >
                      {formatXu(g.price)} xu
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        {!filtered.length ? (
          <p className="py-6 text-center text-[11px] text-[var(--play-muted)]">
            Chưa có quà trong mục này
          </p>
        ) : null}
      </section>

      <GiftHubSheet
        open={hubOpen}
        balance={social}
        busy={busy}
        initialGiftKey={presetGiftKey}
        onClose={() => {
          setHubOpen(false);
          setPresetGiftKey(null);
        }}
        onSend={sendGift}
      />

      <GiftFlyOverlay
        queue={flyQueue}
        onDone={(key) =>
          setFlyQueue((q) => q.filter((x) => x.key !== key))
        }
      />
    </PlatformShell>
  );
}
