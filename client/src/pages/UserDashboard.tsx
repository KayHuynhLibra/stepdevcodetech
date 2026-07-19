import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  api,
  clearSession,
  getStoredUser,
  getToken,
  homePath,
  isStaff,
  playPath,
  saveSession,
  VIP_ROUNDS_REQUIRED,
  type AuthUser,
} from "../auth";
import {
  AVATARS,
  DEFAULT_AVATAR,
  isCustomAvatar,
  normalizeAvatar,
} from "../avatars";
import { CARDS, formatXu, type BetEntry } from "../cards";
import { AppShell } from "../components/AppShell";
import { IdentityBadge } from "../components/IdentityBadge";
import { uploadAvatarFromFile } from "../uploadAvatar";

function cardName(id: number) {
  return CARDS.find((c) => c.id === id)?.nameVi ?? `Lá ${id}`;
}

function groupBetsByRound(bets: BetEntry[]) {
  const map = new Map<
    string,
    {
      key: string;
      round: number;
      at: number;
      winningCardId: number;
      bets: BetEntry[];
      profit: number;
      stake: number;
    }
  >();
  for (const b of bets) {
    const key = `${b.round}-${b.at}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        round: b.round,
        at: b.at,
        winningCardId: b.winningCardId,
        bets: [],
        profit: 0,
        stake: 0,
      };
      map.set(key, g);
    }
    g.bets.push(b);
    g.profit += b.profit;
    g.stake += b.amount;
  }
  for (const g of map.values()) {
    g.bets.sort((a, b) => a.cardId - b.cardId);
  }
  return [...map.values()].sort((a, b) => b.at - a.at);
}

export default function UserDashboard() {
  const nav = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(getStoredUser());
  const [bets, setBets] = useState<BetEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      nav("/login", { replace: true });
      return;
    }
    api<{ ok: true; user: AuthUser }>("/api/auth/me")
      .then((r) => {
        setUser(r.user);
        const token = getToken();
        if (token) saveSession(token, r.user);
        if (isStaff(r.user)) {
          nav(homePath(r.user), { replace: true });
          return;
        }
        return api<{ ok: true; bets: BetEntry[] }>(
          "/api/auth/bets?limit=50",
        ).then((b) => setBets(b.bets));
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Lỗi");
        clearSession();
        nav("/login", { replace: true });
      });
  }, [nav]);

  const logout = () => {
    clearSession();
    nav("/login", { replace: true });
  };

  const redeemCoupon = async (e: FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim() || redeeming) return;
    setRedeeming(true);
    setMsg(null);
    setError(null);
    try {
      const r = await api<{
        ok: true;
        amount: number;
        user: AuthUser;
        message: string;
      }>("/api/auth/redeem-coupon", {
        method: "POST",
        body: JSON.stringify({ code: couponCode.trim() }),
      });
      setUser(r.user);
      const token = getToken();
      if (token) saveSession(token, r.user);
      setCouponCode("");
      setMsg(r.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đổi được mã");
    } finally {
      setRedeeming(false);
    }
  };

  const pickAvatar = async (avatar: string) => {
    if (!user || savingAvatar || avatar === normalizeAvatar(user.avatar)) return;
    setSavingAvatar(true);
    setMsg(null);
    try {
      const r = await api<{ ok: true; user: AuthUser }>("/api/auth/avatar", {
        method: "POST",
        body: JSON.stringify({ avatar }),
      });
      setUser(r.user);
      const token = getToken();
      if (token) saveSession(token, r.user);
      setMsg("Đã đổi avatar");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Không đổi được avatar");
    } finally {
      setSavingAvatar(false);
    }
  };

  const uploadFromDevice = async (file: File) => {
    if (!user || savingAvatar) return;
    setSavingAvatar(true);
    setMsg(null);
    setError(null);
    try {
      const r = await uploadAvatarFromFile(file);
      if (r.user) {
        setUser(r.user);
        const token = getToken();
        if (token) saveSession(token, r.user);
      }
      setMsg("Đã đổi avatar từ máy");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload avatar thất bại");
    } finally {
      setSavingAvatar(false);
    }
  };

  if (!user) {
    return (
      <AppShell center>
        <p className="text-[var(--play-muted)]">Đang tải…</p>
      </AppShell>
    );
  }

  const currentAvatar = normalizeAvatar(user.avatar) || DEFAULT_AVATAR;

  return (
    <AppShell maxWidth="md">
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <IdentityBadge
            user={user}
            showPath={false}
            onAvatarClick={() => {
              document
                .getElementById("avatar-picker")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
        </div>
        <button type="button" onClick={logout} className="app-btn-ghost shrink-0">
          Thoát
        </button>
      </header>

      {error && (
        <p className="mt-3 text-center text-xs text-red-600">{error}</p>
      )}
      {msg && (
        <p className="mt-3 text-center text-xs font-semibold text-[var(--wood-deep)]">
          {msg}
        </p>
      )}

      <section id="avatar-picker" className="app-panel mt-4 p-3">
        <p className="play-heading text-sm">Đổi avatar</p>
        <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
          Chọn mẫu hoặc tải ảnh từ máy — hiện trên bàn chơi & bảng xếp hạng
        </p>
        <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--cream)]/80 px-3 py-2.5 text-sm font-bold text-[var(--wood-deep)] ring-1 ring-[var(--amber)]/40">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            className="hidden"
            disabled={savingAvatar}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void uploadFromDevice(file);
            }}
          />
          {savingAvatar ? "Đang tải…" : "Chọn ảnh từ máy"}
        </label>
        <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-9">
          {isCustomAvatar(currentAvatar) && (
            <button
              type="button"
              disabled={savingAvatar}
              className="rounded-full p-0.5 ring-2 ring-[var(--amber)] ring-offset-2"
              title="Avatar từ máy"
            >
              <img
                src={currentAvatar}
                alt=""
                className="h-11 w-11 rounded-full object-cover"
              />
            </button>
          )}
          {AVATARS.map((src) => {
            const selected = src === currentAvatar;
            return (
              <button
                key={src}
                type="button"
                disabled={savingAvatar}
                onClick={() => pickAvatar(src)}
                className={`rounded-full p-0.5 transition ${
                  selected
                    ? "ring-2 ring-[var(--amber)] ring-offset-2"
                    : "opacity-85 hover:opacity-100"
                }`}
                title="Chọn avatar"
              >
                <img
                  src={src}
                  alt=""
                  className="h-11 w-11 rounded-full object-cover"
                />
              </button>
            );
          })}
        </div>
      </section>

      <section className="app-panel mt-4 p-3">
        <p className="play-heading text-sm">Nạp xu bằng mã</p>
        <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
          Có mã nạp thì nhập bên dưới (mỗi mã một lần / tài khoản).
        </p>
        <form onSubmit={redeemCoupon} className="mt-2 flex gap-2">
          <input
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            placeholder="Nhập mã…"
            className="app-input flex-1"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            disabled={redeeming || !couponCode.trim()}
            className="shrink-0 rounded-xl bg-[var(--wood-deep)] px-4 text-xs font-bold text-white disabled:opacity-50"
          >
            {redeeming ? "…" : "Đổi"}
          </button>
        </form>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-2.5">
        {[
          ["Số dư xu", formatXu(user.balance), true],
          ["Thưởng hôm nay", formatXu(user.winToday), false],
          ["Đã đoán hôm nay", String(user.guessesToday), false],
          [
            "VIP",
            user.isVip
              ? user.vipGranted
                ? "Admin"
                : "10k ván"
              : `${(user.roundsPlayed ?? 0).toLocaleString("vi-VN")}/${VIP_ROUNDS_REQUIRED.toLocaleString("vi-VN")} ván`,
            false,
          ],
        ].map(([label, value, accent]) => (
          <div
            key={String(label)}
            className={`app-panel p-3 ${accent ? "ring-2 ring-amber-300/50" : ""}`}
          >
            <p className="play-section-title !normal-case !tracking-wide">
              {label}
            </p>
            <p
              className={`font-play mt-1 text-xl font-bold tabular-nums ${
                accent ? "text-amber-700" : "text-[var(--play-ink)]"
              }`}
            >
              {value}
            </p>
          </div>
        ))}
      </section>

      <div className="app-frame mt-6 px-4 py-5">
        <p className="play-heading text-center text-base">Sẵn sàng đoán bài?</p>
        <p className="mt-1 text-center text-xs text-[var(--play-muted)]">
          Số dư đồng bộ khi bạn chơi và thoát bàn.
        </p>
        <Link to={playPath(user)} className="app-btn-primary mt-4">
          Vào bàn Tarot
        </Link>
      </div>

      <section className="app-panel mt-5 p-3">
        <p className="play-heading text-sm">Lịch sử cược</p>
        <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
          {bets.length === 0
            ? "Chưa có ván nào — vào bàn để đặt cược."
            : `${bets.length} dòng gần nhất`}
        </p>
        {bets.length > 0 && (
          <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto">
            {groupBetsByRound(bets).map((g) => (
              <li
                key={g.key}
                className="rounded-lg bg-white/70 px-2.5 py-2 text-xs ring-1 ring-[var(--wood-deep)]/10"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--play-ink)]">
                      Ván #{g.round}
                      <span className="ml-1 font-normal text-[var(--play-muted)]">
                        · thắng {cardName(g.winningCardId)}
                      </span>
                    </p>
                    <p className="text-[10px] text-[var(--play-muted)]">
                      {new Date(g.at).toLocaleString("vi-VN")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`font-play font-bold tabular-nums ${
                        g.profit >= 0
                          ? "text-[var(--jade-deep)]"
                          : "text-rose-600"
                      }`}
                    >
                      {g.profit > 0 ? "+" : ""}
                      {formatXu(g.profit)}
                    </p>
                    <p className="text-[10px] text-[var(--play-muted)]">
                      cược {formatXu(g.stake)}
                    </p>
                  </div>
                </div>
                <div className="mt-1.5 flex gap-1 overflow-x-auto">
                  {g.bets.map((b) => {
                    const c = CARDS.find((x) => x.id === b.cardId);
                    return (
                      <div
                        key={b.id}
                        className={`relative shrink-0 rounded-md p-0.5 ${
                          b.result === "win"
                            ? "ring-1 ring-[var(--jade)]"
                            : "ring-1 ring-[var(--wood-deep)]/15"
                        }`}
                        title={`${cardName(b.cardId)} · ${formatXu(b.amount)}`}
                      >
                        <img
                          src={c?.image}
                          alt={c?.nameVi ?? `#${b.cardId}`}
                          className="h-10 w-7 rounded object-cover"
                        />
                        <span className="font-play absolute left-0.5 top-0.5 rounded bg-[var(--wood-deep)]/90 px-0.5 text-[8px] font-bold text-[var(--gold-soft)] tabular-nums">
                          {b.cardId}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
