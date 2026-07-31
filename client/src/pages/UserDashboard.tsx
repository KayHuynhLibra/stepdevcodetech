import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  api,
  changePassword,
  clearSession,
  fetchRecoveryCode,
  getStoredUser,
  getToken,
  homePath,
  isStaff,
  saveSession,
  userShowsVip,
  VIP_ROUNDS_REQUIRED,
  USERNAME_RENAME_MAX,
  userDisplayName,
  type AuthUser,
} from "../auth";
import {
  AVATARS,
  DEFAULT_AVATAR,
  isCustomAvatar,
  normalizeAvatar,
} from "../avatars";
import { CARDS, formatXu, type StakeEntry } from "../cards";
import { AppShell } from "../components/AppShell";
import { IdentityBadge } from "../components/IdentityBadge";
import { PlatformShell } from "../components/PlatformShell";
import {
  fetchPlatformGames,
  getCachedPlatformGames,
  type GameManifest,
} from "../platform/games";
import { GameLobby } from "../platform/GameLobby";
import { uploadAvatarFromFile } from "../uploadAvatar";
import { ensureCultivationColors } from "../cultivation";

function cardName(id: number) {
  return CARDS.find((c) => c.id === id)?.nameVi ?? `Lá ${id}`;
}

function groupStakesByRound(stakes: StakeEntry[]) {
  const map = new Map<
    string,
    {
      key: string;
      round: number;
      at: number;
      winningCardId: number;
      stakes: StakeEntry[];
      profit: number;
      stake: number;
    }
  >();
  for (const b of stakes) {
    const key = `${b.round}-${b.at}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        round: b.round,
        at: b.at,
        winningCardId: b.winningCardId,
        stakes: [],
        profit: 0,
        stake: 0,
      };
      map.set(key, g);
    }
    g.stakes.push(b);
    g.profit += b.profit;
    g.stake += b.amount;
  }
  for (const g of map.values()) {
    g.stakes.sort((a, b) => a.cardId - b.cardId);
  }
  return [...map.values()].sort((a, b) => b.at - a.at);
}

export default function UserDashboard() {
  const nav = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(getStoredUser());
  const [stakes, setStakes] = useState<StakeEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [recoveryShown, setRecoveryShown] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [nicknameBusy, setNicknameBusy] = useState(false);
  const [lobbyGames, setLobbyGames] = useState<GameManifest[]>(() =>
    getCachedPlatformGames(),
  );

  useEffect(() => {
    if (!getToken()) {
      nav("/login", { replace: true });
      return;
    }
    void ensureCultivationColors();
    void fetchPlatformGames().then(setLobbyGames);
    api<{ ok: true; user: AuthUser }>("/api/auth/me")
      .then((r) => {
        setUser(r.user);
        const token = getToken();
        if (token) saveSession(token, r.user);
        if (isStaff(r.user) || r.user.role === "deal" || r.user.role === "tutien" || r.user.role === "mod") {
          nav(homePath(r.user), { replace: true });
          return;
        }
        setRenameDraft(r.user.username);
        setNicknameDraft(r.user.nickname ?? "");
        return api<{ ok: true; stakes: StakeEntry[] }>(
          "/api/auth/stakes?limit=50",
        ).then((b) => setStakes(b.stakes));
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Lỗi");
        clearSession();
        nav("/login", { replace: true });
      });
  }, [nav]);

  useEffect(() => {
    const refreshMe = () => {
      if (document.visibilityState !== "visible" || !getToken()) return;
      void api<{ ok: true; user: AuthUser }>("/api/auth/me")
        .then((r) => {
          setUser(r.user);
          const token = getToken();
          if (token) saveSession(token, r.user);
        })
        .catch(() => {});
    };
    document.addEventListener("visibilitychange", refreshMe);
    return () => document.removeEventListener("visibilitychange", refreshMe);
  }, []);

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

  const submitRename = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || renameBusy) return;
    const raw = renameDraft.trim();
    if (!raw || raw === user.username) return;
    setRenameBusy(true);
    setMsg(null);
    setError(null);
    try {
      const r = await api<{ ok: true; user: AuthUser }>("/api/auth/rename", {
        method: "POST",
        body: JSON.stringify({ username: raw }),
      });
      setUser(r.user);
      setRenameDraft(r.user.username);
      const token = getToken();
      if (token) saveSession(token, r.user);
      setMsg("Đã đổi username — lần sau đăng nhập bằng tên mới");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đổi được tên");
    } finally {
      setRenameBusy(false);
    }
  };

  const submitNickname = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || nicknameBusy) return;
    const raw = nicknameDraft.trim();
    if (raw.length > 0 && raw.length < 2) return;
    setNicknameBusy(true);
    setMsg(null);
    setError(null);
    try {
      const r = await api<{ ok: true; user: AuthUser }>("/api/auth/nickname", {
        method: "POST",
        body: JSON.stringify({ nickname: raw }),
      });
      setUser(r.user);
      setNicknameDraft(r.user.nickname ?? "");
      const token = getToken();
      if (token) saveSession(token, r.user);
      setMsg(
        raw
          ? "Đã lưu nickname — hiện trên bàn chơi"
          : "Đã xóa nickname — hiện username",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu nickname");
    } finally {
      setNicknameBusy(false);
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

  const staffPanel =
    user.role === "admin"
      ? `/admin/${user.code}`
      : user.role === "mod"
        ? `/mod/${user.code}`
        : user.role === "deal"
          ? `/deal/${user.code}`
          : user.role === "tutien"
            ? `/tutien/${user.code}`
            : isStaff(user)
              ? homePath(user)
              : null;

  return (
    <PlatformShell
      user={user}
      dense
      showSocial={false}
      subtitle="Lobby · xu chơi cho bàn · xu quà cho MXH"
      onExit={logout}
      staffHref={staffPanel}
      onSocial={(a) => {
        if (a === "profile") {
          const panel = document.getElementById("ho-so");
          if (panel instanceof HTMLDetailsElement) panel.open = true;
          panel?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }}
    >
      <div className="app-frame mt-0 px-2.5 py-2">
        <IdentityBadge
          user={user}
          compact
          showPath={false}
          onAvatarClick={() => {
            const panel = document.getElementById("ho-so");
            if (panel instanceof HTMLDetailsElement) panel.open = true;
            document
              .getElementById("avatar-picker")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          onNameClick={() => {
            const panel = document.getElementById("ho-so");
            if (panel instanceof HTMLDetailsElement) panel.open = true;
            document
              .getElementById("nickname-display")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      </div>

      {error && (
        <p className="mt-3 text-center text-xs text-red-600">{error}</p>
      )}
      {msg && (
        <p className="mt-3 text-center text-xs font-semibold text-[var(--wood-deep)]">
          {msg}
        </p>
      )}

      <div className="app-frame mt-2 px-2.5 py-2.5 sm:px-3 sm:py-3">
        <p className="play-heading text-center text-sm">Chọn bàn</p>
        <GameLobby user={user} games={lobbyGames} />
      </div>

      <section className="app-panel mt-5 p-3">
        <p className="play-heading text-sm">Lịch sử ván</p>
        <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
          {stakes.length === 0
            ? "Chưa có ván nào — vào bàn để đặt xu."
            : `${stakes.length} dòng gần nhất`}
        </p>
        {stakes.length > 0 && (
          <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto">
            {groupStakesByRound(stakes).map((g) => (
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
                      xu {formatXu(g.stake)}
                    </p>
                  </div>
                </div>
                <div className="mt-1.5 flex gap-1 overflow-x-auto">
                  {g.stakes.map((b) => {
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

      <details className="app-panel mt-5 p-3" id="ho-so">
        <summary className="cursor-pointer play-heading text-sm select-none">
          Hồ sơ &amp; cài đặt
        </summary>
        <p className="mt-1 text-[11px] text-[var(--play-muted)]">
          Avatar, nickname, nạp mã, VIP, bảo mật — gọn dưới lobby.
        </p>

        <section id="avatar-picker" className="mt-4 border-t border-[var(--wood-deep)]/10 pt-3">
          <p className="play-heading text-sm">Đổi avatar</p>
          <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
            Avatar &amp; ID hiện với người chơi khác trên bàn Tarot / Bánh xe
            Arcana
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

        <section id="nickname-display" className="mt-4 border-t border-[var(--wood-deep)]/10 pt-3">
          <p className="play-heading text-sm">Nickname (tên trong game)</p>
          <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
            2–12 ký tự · ký tự đặc biệt OK · hiện trên bàn, chat, BXH · để trống
            = dùng username · đăng nhập vẫn bằng{" "}
            <strong>@{user.username}</strong>
          </p>
          <p className="mt-1 text-xs font-bold text-[var(--play-ink)]">
            Đang hiện: {userDisplayName(user)}
          </p>
          <form onSubmit={submitNickname} className="mt-2 flex gap-2">
            <input
              value={nicknameDraft}
              onChange={(e) => setNicknameDraft(e.target.value.slice(0, 12))}
              maxLength={12}
              spellCheck={false}
              className="app-input flex-1 text-sm"
              placeholder="Nickname…"
            />
            <button
              type="submit"
              disabled={nicknameBusy}
              className="shrink-0 rounded-xl bg-[var(--wood-deep)] px-4 text-xs font-bold text-white disabled:opacity-50"
            >
              {nicknameBusy ? "…" : "Lưu"}
            </button>
          </form>
        </section>

        <section id="rename-username" className="mt-4 border-t border-[var(--wood-deep)]/10 pt-3">
          <p className="play-heading text-sm">Username đăng nhập</p>
          <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
            3–20 ký tự · chữ, số, gạch dưới · mã ID giữ nguyên · đăng nhập bằng
            tên mới · còn{" "}
            <strong>
              {user.usernameRenamesLeft ?? USERNAME_RENAME_MAX}/
              {USERNAME_RENAME_MAX}
            </strong>{" "}
            lần đổi
          </p>
          <form onSubmit={submitRename} className="mt-2 flex gap-2">
            <input
              value={renameDraft}
              onChange={(e) =>
                setRenameDraft(
                  e.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20),
                )
              }
              maxLength={20}
              autoComplete="username"
              spellCheck={false}
              disabled={(user.usernameRenamesLeft ?? USERNAME_RENAME_MAX) <= 0}
              className="app-input flex-1 font-mono text-sm disabled:opacity-50"
              placeholder={user.username}
            />
            <button
              type="submit"
              disabled={
                renameBusy ||
                !renameDraft.trim() ||
                renameDraft.trim() === user.username ||
                (user.usernameRenamesLeft ?? USERNAME_RENAME_MAX) <= 0
              }
              className="shrink-0 rounded-xl bg-[var(--wood-deep)] px-4 text-xs font-bold text-white disabled:opacity-50"
            >
              {renameBusy ? "…" : "Lưu"}
            </button>
          </form>
        </section>

        <section className="mt-4 border-t border-[var(--wood-deep)]/10 pt-3">
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

        <section className="mt-4 grid grid-cols-2 gap-2.5">
          {[
            ["Số dư xu", formatXu(user.balance), true],
            ["Thưởng hôm nay", formatXu(user.winToday), false],
            ["Đã đoán hôm nay", String(user.guessesToday), false],
            [
              "VIP",
              userShowsVip(user)
                ? "VIP"
                : `${(user.roundsPlayed ?? 0).toLocaleString("vi-VN")}/${VIP_ROUNDS_REQUIRED.toLocaleString("vi-VN")} ván`,
              userShowsVip(user),
            ],
          ].map(([label, value, accent]) => (
            <div
              key={String(label)}
              className={`rounded-xl bg-white/60 p-3 ring-1 ring-[var(--wood-deep)]/10 ${accent ? "ring-2 ring-amber-300/50" : ""}`}
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

        <section className="mt-4 border-t border-[var(--wood-deep)]/10 pt-3">
          <p className="play-heading text-sm">Bảo mật</p>
          <p className="mt-0.5 text-[11px] text-[var(--play-muted)]">
            Đổi mật khẩu hoặc xem mã khôi phục (dùng khi quên MK).
          </p>
          <form
            className="mt-2 space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setPwBusy(true);
              setError(null);
              setMsg(null);
              try {
                await changePassword(curPw, newPw);
                clearSession();
                setMsg("Đã đổi mật khẩu — đăng nhập lại.");
                nav("/login", { replace: true });
              } catch (err) {
                setError(err instanceof Error ? err.message : "Lỗi đổi MK");
              } finally {
                setPwBusy(false);
              }
            }}
          >
            <input
              type="password"
              value={curPw}
              onChange={(e) => setCurPw(e.target.value)}
              placeholder="Mật khẩu hiện tại"
              className="app-input"
              required
            />
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="Mật khẩu mới (≥6)"
              className="app-input"
              minLength={6}
              required
            />
            <button
              type="submit"
              disabled={pwBusy}
              className="rounded-xl bg-[var(--wood-deep)] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {pwBusy ? "…" : "Đổi mật khẩu"}
            </button>
          </form>
          <button
            type="button"
            className="mt-2 text-xs font-semibold text-[var(--wood-deep)] underline-offset-2 hover:underline"
            onClick={async () => {
              try {
                const r = await fetchRecoveryCode();
                if (r.recoveryCode) setRecoveryShown(r.recoveryCode);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Lỗi");
              }
            }}
          >
            Hiện mã khôi phục
          </button>
          {recoveryShown && (
            <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1.5 font-mono text-xs font-bold text-amber-900 ring-1 ring-amber-200">
              {recoveryShown}
            </p>
          )}
        </section>
      </details>
    </PlatformShell>
  );
}
