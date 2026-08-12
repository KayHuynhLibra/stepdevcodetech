import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  api,
  getToken,
  saveSession,
  VIP_ROUNDS_REQUIRED,
  type AuthUser,
} from "../../../auth";
import { normalizeAvatar } from "../../../avatars";
import { formatXu } from "../../../cards";
import { CultivationChip } from "../../CultivationChip";

export type AdminUserRow = {
  id: string;
  code: string;
  username: string;
  role: string;
  balance: number;
  balances?: { play?: number; social?: number };
  isVip?: boolean;
  vipGranted?: boolean;
  banned?: boolean;
  muted?: boolean;
  roundsPlayed?: number;
  winToday?: number;
  guessesToday?: number;
  outcomeMode?: "normal" | "win" | "lose";
  outcomeWinPct?: number;
  cultivationRank?: string | null;
  avatar?: string;
  hideFromLeaderboard?: boolean;
  hideNickname?: boolean;
};

export type LiveGuestRow = {
  socketId: string;
  name: string;
  guestCode?: string;
  balance: number;
  inOrphan?: boolean;
};

export function UsersAdminPanel({
  users,
  liveGuests,
  me,
  botTarget,
  onMsg,
  onReload,
  onOpenPwReset,
  onMeUpdate,
}: {
  users: AuthUser[];
  liveGuests?: LiveGuestRow[];
  me: AuthUser;
  botTarget: number;
  onMsg: (s: string) => void;
  onReload: () => void | Promise<void>;
  onOpenPwReset: (u: {
    id: string;
    username: string;
    code?: string;
    role: string;
  }) => void;
  onMeUpdate?: (user: AuthUser) => void;
}) {
  const [botCount, setBotCount] = useState(botTarget);
  const [adjust, setAdjust] = useState<{
    userId: string;
    delta: string;
    lane: "play" | "social";
  }>({ userId: "", delta: "", lane: "play" });
  const [guestAdjust, setGuestAdjust] = useState<{ key: string; delta: string }>(
    { key: "", delta: "" },
  );
  const [userFilter, setUserFilter] = useState("");
  const [userQuick, setUserQuick] = useState<
    "all" | "vip" | "banned" | "muted"
  >("all");
  const [codeDrafts, setCodeDrafts] = useState<Record<string, string>>({});
  const [codeBusyId, setCodeBusyId] = useState<string | null>(null);

  useEffect(() => {
    setBotCount(botTarget);
  }, [botTarget]);

  const filteredUsers = useMemo(
    () =>
      users.filter((u) => {
        if (userQuick === "vip" && !u.isVip) return false;
        if (userQuick === "banned" && !u.banned) return false;
        if (userQuick === "muted" && !u.muted) return false;
        const q = userFilter.trim().toLowerCase();
        if (!q) return true;
        return `${u.username} ${u.code} ${u.id} ${u.role} ${u.cultivationRank ?? ""}`
          .toLowerCase()
          .includes(q);
      }),
    [users, userFilter, userQuick],
  );

  const applyBots = async () => {
    try {
      await api("/api/admin/bots", {
        method: "POST",
        body: JSON.stringify({ count: botCount }),
      });
      onMsg(`Đã đặt ${botCount} bot`);
      await onReload();
    } catch (e) {
      onMsg(e instanceof Error ? e.message : "Lỗi");
    }
  };

  const applyAdjust = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api("/api/admin/adjust-balance", {
        method: "POST",
        body: JSON.stringify({
          userId: adjust.userId,
          delta: Number(adjust.delta),
          lane: adjust.lane,
        }),
      });
      onMsg(
        `Đã cập nhật ${adjust.lane === "social" ? "xu quà" : "xu chơi"} user`,
      );
      await onReload();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi");
    }
  };

  const applyGuestAdjust = async (e: FormEvent) => {
    e.preventDefault();
    const key = guestAdjust.key.trim();
    const delta = Number(guestAdjust.delta);
    if (!key || !Number.isFinite(delta) || delta === 0) {
      onMsg("Chọn khách và nhập delta");
      return;
    }
    try {
      await api("/api/admin/guest/adjust-balance", {
        method: "POST",
        body: JSON.stringify({ socketId: key, delta }),
      });
      onMsg("Đã cập nhật số dư khách (bàn Tarot)");
      setGuestAdjust({ key: "", delta: "" });
      await onReload();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi");
    }
  };

  const setUserOutcome = async (
    userId: string,
    mode: "normal" | "win" | "lose",
  ) => {
    try {
      await api("/api/admin/user-outcome", {
        method: "POST",
        body: JSON.stringify({ userId, mode }),
      });
      onMsg(
        mode === "normal"
          ? "Đã về Normal"
          : mode === "win"
            ? "User: ưu tiên WIN"
            : "User: ưu tiên LOSE",
      );
      await onReload();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi");
    }
  };

  const setUserVip = async (userId: string, isVip: boolean) => {
    try {
      await api("/api/admin/user-vip", {
        method: "POST",
        body: JSON.stringify({ userId, isVip }),
      });
      onMsg(isVip ? "Đã cấp VIP10K" : "Đã tắt VIP10K");
      await onReload();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi");
    }
  };

  const setUserCode = async (userId: string, code: string) => {
    if (codeBusyId) return;
    setCodeBusyId(userId);
    try {
      const r = await api<{ ok: true; user: AuthUser }>("/api/admin/user-code", {
        method: "POST",
        body: JSON.stringify({ userId, code }),
      });
      onMsg(`Đã đổi ID → ${r.user.code}`);
      setCodeDrafts((d) => {
        const next = { ...d };
        delete next[userId];
        return next;
      });
      if (me.id === userId) {
        const token = getToken();
        if (token) saveSession(token, { ...me, ...r.user });
        onMeUpdate?.({ ...me, ...r.user });
      }
      await onReload();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi đổi ID");
    } finally {
      setCodeBusyId(null);
    }
  };

  const setUserRole = async (
    userId: string,
    role: "user" | "deal" | "onl" | "tutien" | "mod",
  ) => {
    try {
      await api("/api/mainadmin/user-role", {
        method: "POST",
        body: JSON.stringify({ userId, role }),
      });
      onMsg("Đã cập nhật role");
      await onReload();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi đổi role");
    }
  };

  const setUserLeaderboardHide = async (userId: string, hidden: boolean) => {
    try {
      await api("/api/mainadmin/user-leaderboard-hide", {
        method: "POST",
        body: JSON.stringify({ userId, hidden }),
      });
      onMsg(hidden ? "Đã ẩn khỏi bảng xếp hạng" : "Đã hiện trên bảng xếp hạng");
      await onReload();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi ẩn BXH");
    }
  };

  const setUserHideNickname = async (userId: string, hidden: boolean) => {
    try {
      await api("/api/mainadmin/user-hide-nickname", {
        method: "POST",
        body: JSON.stringify({ userId, hidden }),
      });
      onMsg(hidden ? "Đã ẩn nick công khai" : "Đã hiện nick công khai");
      await onReload();
      if (userId === me.id) {
        const token = getToken();
        if (token) {
          try {
            const r = await api<{ ok: true; user: AuthUser }>("/api/auth/me");
            saveSession(token, r.user);
            onMeUpdate?.(r.user);
          } catch {
            /* ignore */
          }
        }
      }
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi ẩn nick");
    }
  };

  const setUserBan = async (userId: string, banned: boolean) => {
    try {
      const reason = banned
        ? window.prompt("Lý do khóa (tuỳ chọn)", "Vi phạm") ?? "Vi phạm"
        : "";
      await api("/api/admin/user-ban", {
        method: "POST",
        body: JSON.stringify({ userId, banned, reason }),
      });
      onMsg(banned ? "Đã khóa tài khoản" : "Đã mở khóa");
      await onReload();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi");
    }
  };

  const setUserMute = async (
    userId: string,
    opts: { minutes?: number; permanent?: boolean; off?: boolean },
  ) => {
    try {
      await api("/api/admin/user-mute", {
        method: "POST",
        body: JSON.stringify({
          userId,
          minutes: opts.off ? 0 : (opts.minutes ?? 0),
          permanent: !!opts.permanent,
        }),
      });
      onMsg(
        opts.off
          ? "Đã unmute"
          : opts.permanent
            ? "Mute vĩnh viễn"
            : `Mute ${opts.minutes} phút`,
      );
      await onReload();
    } catch (err) {
      onMsg(err instanceof Error ? err.message : "Lỗi");
    }
  };

  return (
    <>
              <>
                <section className="app-frame mt-4 px-3 py-3">
                  <p className="play-heading text-sm">Số lượng bot</p>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={50}
                      value={botCount}
                      onChange={(e) => setBotCount(Number(e.target.value))}
                      className="flex-1 accent-[var(--amber)]"
                    />
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={botCount}
                      onChange={(e) => setBotCount(Number(e.target.value))}
                      className="app-input w-16 !px-2 !py-1 text-center"
                    />
                    <button
                      type="button"
                      onClick={applyBots}
                      className="rounded-full bg-[var(--wood-deep)] px-3 py-1.5 text-xs font-bold text-white"
                    >
                      Áp dụng
                    </button>
                  </div>
                </section>
      
                <section className="app-panel mt-4 p-3">
                  <p className="play-heading text-sm">
                    Cộng / trừ xu user (chọn làn chơi / quà)
                  </p>
                  <form onSubmit={applyAdjust} className="mt-2 space-y-2">
                    <select
                      value={adjust.userId}
                      onChange={(e) =>
                        setAdjust((a) => ({ ...a, userId: e.target.value }))
                      }
                      className="app-input"
                      required
                    >
                      <option value="">Chọn user…</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.username} · ID {u.code || "—"} (chơi{" "}
                          {formatXu(u.balances?.play ?? u.balance)}
                          {" · quà "}
                          {formatXu(u.balances?.social ?? 0)}) — {u.role}
                        </option>
                      ))}
                    </select>
                    <select
                      value={adjust.lane}
                      onChange={(e) =>
                        setAdjust((a) => ({
                          ...a,
                          lane: e.target.value === "social" ? "social" : "play",
                        }))
                      }
                      className="app-input"
                    >
                      <option value="play">Xu chơi (cược/game)</option>
                      <option value="social">Xu quà (MXH)</option>
                    </select>
                    <div className="flex gap-2">
                      <input
                        value={adjust.delta}
                        onChange={(e) =>
                          setAdjust((a) => ({ ...a, delta: e.target.value }))
                        }
                        placeholder="Delta (+/-)"
                        className="app-input flex-1"
                      />
                      <button
                        type="submit"
                        className="rounded-xl bg-[var(--wood-deep)] px-4 text-xs font-bold text-white"
                      >
                        Cập nhật
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[100, 1000, -100, -1000].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() =>
                            setAdjust((a) => ({ ...a, delta: String(n) }))
                          }
                          className="app-btn-ghost !text-[10px]"
                        >
                          {n > 0 ? `+${formatXu(n)}` : formatXu(n)}
                        </button>
                      ))}
                    </div>
                  </form>
                </section>
      
                <section className="app-panel mt-4 p-3">
                  <p className="play-heading text-sm">
                    Cộng / trừ xu khách (Tarot online)
                  </p>
                  <p className="mt-1 text-[10px] text-white/45">
                    Chỉ khách đang ở bàn hoặc orphan ván hiện tại. Arcana cần đăng
                    nhập.
                  </p>
                  <form onSubmit={applyGuestAdjust} className="mt-2 space-y-2">
                    <select
                      value={guestAdjust.key}
                      onChange={(e) =>
                        setGuestAdjust((a) => ({ ...a, key: e.target.value }))
                      }
                      className="app-input"
                    >
                      <option value="">Chọn khách online…</option>
                      {(liveGuests ?? []).map((g) => (
                        <option key={g.socketId} value={g.socketId}>
                          {g.name}
                          {g.guestCode ? ` · ${g.guestCode}` : ""} (
                          {formatXu(g.balance)} xu)
                          {g.inOrphan ? " · orphan" : ""}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <input
                        value={guestAdjust.delta}
                        onChange={(e) =>
                          setGuestAdjust((a) => ({ ...a, delta: e.target.value }))
                        }
                        placeholder="Delta (+/-)"
                        className="app-input flex-1"
                      />
                      <button
                        type="submit"
                        className="rounded-xl bg-[var(--wood-deep)] px-4 text-xs font-bold text-white"
                      >
                        Cập nhật
                      </button>
                    </div>
                  </form>
                  {(liveGuests?.length ?? 0) === 0 && (
                    <p className="mt-2 text-[11px] text-white/40">
                      Không có khách trên bàn Tarot.
                    </p>
                  )}
                </section>
      
                <section className="app-panel mt-4 p-3">
                  <p className="play-heading mb-1 text-sm">
                    Chỉnh ID user · Danh sách ({filteredUsers.length}/
                    {users.length})
                  </p>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    <input
                      value={userFilter}
                      onChange={(e) => setUserFilter(e.target.value)}
                      placeholder="Lọc username / ID…"
                      className="app-input !py-1.5 text-xs sm:!max-w-xs"
                    />
                    {(
                      [
                        ["all", "Tất cả"],
                        ["vip", "VIP"],
                        ["banned", "Ban"],
                        ["muted", "Mute"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setUserQuick(id)}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          userQuick === id
                            ? "bg-[var(--wood-deep)] text-white"
                            : "bg-white text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="mb-2 text-[11px] text-[var(--play-muted)]">
                    Mỗi user: ô ID + nút <strong>Lưu ID</strong> (3–8 chữ/số, không
                    trùng). Mode Lose/Normal/Win khi user có đặt xu. VIP hiện ID nền
                    vàng nổi.
                  </p>
                  <ul className="max-h-80 space-y-2 overflow-y-auto">
                    {filteredUsers.map((u) => {
                      const om = u.outcomeMode ?? "normal";
                      const granted = !!u.vipGranted;
                      const rounds = u.roundsPlayed ?? 0;
                      const vip = !!u.isVip;
                      const vipLabel = granted
                        ? "VIP10K"
                        : rounds >= VIP_ROUNDS_REQUIRED
                          ? "đủ 10k ván"
                          : null;
                      const draft =
                        codeDrafts[u.id] !== undefined
                          ? codeDrafts[u.id]!
                          : u.code || "";
                      return (
                        <li
                          key={u.id}
                          className="rounded-lg bg-white/70 px-2 py-2 text-xs ring-1 ring-[var(--wood-deep)]/10"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <img
                                src={normalizeAvatar(u.avatar)}
                                alt=""
                                className="h-8 w-8 rounded-full object-cover"
                                onError={(e) => {
                                  const el = e.currentTarget;
                                  if (el.src.includes("avatar-default")) return;
                                  el.src = "/assets/ui/avatar-default.png";
                                }}
                              />
                              <div className="min-w-0">
                                <p className="font-semibold text-[var(--play-ink)]">
                                  {u.username}{" "}
                                  <span className="text-[var(--wood-deep)]">{u.role}</span>
                                  {vip && (
                                    <span className="ml-1 text-amber-700">
                                      VIP{vipLabel ? ` · ${vipLabel}` : ""}
                                    </span>
                                  )}
                                </p>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1">
                                  <CultivationChip rank={u.cultivationRank} />
                                </div>
                                <p className="text-[10px] text-[var(--play-muted)]">
                                  <span
                                    className={`identity-chip identity-chip--code${
                                      vip ? " identity-chip--code-vip" : ""
                                    } !text-[9px]`}
                                  >
                                    ID {u.code || "—"}
                                  </span>{" "}
                                  · {rounds.toLocaleString("vi-VN")} ván · Thưởng:{" "}
                                  {formatXu(u.winToday)} · Đoán: {u.guessesToday}
                                </p>
                              </div>
                            </div>
                            <p className="shrink-0 font-play font-bold text-amber-700 tabular-nums">
                              {formatXu(u.balance)}
                            </p>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1">
                            <input
                              value={draft}
                              onChange={(e) =>
                                setCodeDrafts((d) => ({
                                  ...d,
                                  [u.id]: e.target.value.toUpperCase(),
                                }))
                              }
                              maxLength={8}
                              placeholder="ID mới"
                              className="app-input !w-24 !px-2 !py-1 !text-[11px] font-mono uppercase"
                              title="ID riêng 3–8 chữ/số"
                            />
                            <button
                              type="button"
                              disabled={
                                codeBusyId === u.id ||
                                !draft.trim() ||
                                draft.trim().toUpperCase() === (u.code || "")
                              }
                              onClick={() => setUserCode(u.id, draft)}
                              className="rounded-full bg-[var(--wood-deep)] px-2.5 py-1 text-[10px] font-bold text-white disabled:opacity-40"
                            >
                              {codeBusyId === u.id ? "…" : "Lưu ID"}
                            </button>
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
                                onClick={() => setUserOutcome(u.id, mode)}
                                className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                  om === mode
                                    ? mode === "win"
                                      ? "bg-emerald-600 text-white"
                                      : mode === "lose"
                                        ? "bg-rose-600 text-white"
                                        : "bg-[var(--wood-deep)] text-white"
                                    : "bg-white text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20"
                                }`}
                              >
                                {mode === "win" && om === "win"
                                  ? `Win ${u.outcomeWinPct ?? 100}%`
                                  : label}
                              </button>
                            ))}
                            {om === "win" && (
                              <span className="rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-bold text-emerald-900 ring-1 ring-emerald-300/60">
                                Inter → User Win % để chỉnh 80–100
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => setUserVip(u.id, !granted)}
                              className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                granted
                                  ? "bg-amber-500 text-[#1a1208]"
                                  : "bg-white text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20"
                              }`}
                            >
                              {granted ? "VIP10K ✓" : "VIP10K"}
                            </button>
                            {me.role === "mainadmin" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setUserLeaderboardHide(u.id, !u.hideFromLeaderboard)
                                  }
                                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                    u.hideFromLeaderboard
                                      ? "bg-slate-700 text-white"
                                      : "bg-white text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20"
                                  }`}
                                >
                                  {u.hideFromLeaderboard ? "BXH ẩn ✓" : "Ẩn BXH"}
                                </button>
                              )}
                            {me.role === "mainadmin" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setUserHideNickname(u.id, !u.hideNickname)
                                  }
                                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                    u.hideNickname
                                      ? "bg-indigo-800 text-white"
                                      : "bg-white text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20"
                                  }`}
                                >
                                  {u.hideNickname ? "Nick ẩn ✓" : "Ẩn nick"}
                                </button>
                              )}
                            <button
                              type="button"
                              onClick={() => setUserBan(u.id, !u.banned)}
                              className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                u.banned
                                  ? "bg-rose-600 text-white"
                                  : "bg-white text-rose-700 ring-1 ring-rose-300/60"
                              }`}
                            >
                              {u.banned ? "Mở khóa" : "Khóa"}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                u.muted
                                  ? setUserMute(u.id, { off: true })
                                  : setUserMute(u.id, { minutes: 30 })
                              }
                              className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20"
                            >
                              {u.muted ? "Unmute" : "Mute 30p"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setUserMute(u.id, { permanent: true })}
                              className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20"
                            >
                              Mute ∞
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenPwReset(u)}
                              className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[var(--play-ink)] ring-1 ring-[var(--wood-deep)]/20"
                            >
                              Reset MK
                            </button>
                            {me.role === "mainadmin" &&
                              u.role !== "mainadmin" && (
                                <>
                                  {u.role !== "deal" && (
                                    <button
                                      type="button"
                                      onClick={() => setUserRole(u.id, "deal")}
                                      className="rounded-full bg-teal-700 px-2.5 py-1 text-[10px] font-bold text-white"
                                    >
                                      Cấp Deal
                                    </button>
                                  )}
                                  {u.role === "deal" && (
                                    <button
                                      type="button"
                                      onClick={() => setUserRole(u.id, "user")}
                                      className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[var(--play-ink)] ring-1 ring-teal-600/40"
                                    >
                                      Thu Deal
                                    </button>
                                  )}
                                  {u.role !== "onl" && (
                                    <button
                                      type="button"
                                      onClick={() => setUserRole(u.id, "onl")}
                                      className="rounded-full bg-sky-700 px-2.5 py-1 text-[10px] font-bold text-white"
                                    >
                                      Cấp Onl
                                    </button>
                                  )}
                                  {u.role === "onl" && (
                                    <button
                                      type="button"
                                      onClick={() => setUserRole(u.id, "user")}
                                      className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[var(--play-ink)] ring-1 ring-sky-600/40"
                                    >
                                      Thu Onl
                                    </button>
                                  )}
                                  {u.role !== "tutien" && (
                                    <button
                                      type="button"
                                      onClick={() => setUserRole(u.id, "tutien")}
                                      className="rounded-full bg-violet-800 px-2.5 py-1 text-[10px] font-bold text-white"
                                    >
                                      Cấp Tu Tiên
                                    </button>
                                  )}
                                  {u.role === "tutien" && (
                                    <button
                                      type="button"
                                      onClick={() => setUserRole(u.id, "user")}
                                      className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[var(--play-ink)] ring-1 ring-violet-700/40"
                                    >
                                      Thu Tu Tiên
                                    </button>
                                  )}
                                  {u.role !== "mod" && (
                                    <button
                                      type="button"
                                      onClick={() => setUserRole(u.id, "mod")}
                                      className="rounded-full bg-indigo-800 px-2.5 py-1 text-[10px] font-bold text-white"
                                    >
                                      Cấp Mod
                                    </button>
                                  )}
                                  {u.role === "mod" && (
                                    <button
                                      type="button"
                                      onClick={() => setUserRole(u.id, "user")}
                                      className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[var(--play-ink)] ring-1 ring-indigo-700/40"
                                    >
                                      Thu Mod
                                    </button>
                                  )}
                                </>
                              )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              </>
    </>
  );
}
