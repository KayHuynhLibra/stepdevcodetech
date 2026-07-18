import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  api,
  clearSession,
  getStoredUser,
  getToken,
  saveSession,
  type AuthUser,
} from "../auth";
import { formatXu } from "../cards";
import { AppShell } from "../components/AppShell";

interface Overview {
  ok: true;
  stats: {
    realPlayers: number;
    displayOnline: number;
    phase: string;
    roundNumber: number;
    botTarget: number;
    botActive: number;
    vipPool: number;
  };
  users: AuthUser[];
  botPanel: { targetCount: number; activeCount: number };
}

export default function AdminDashboard() {
  const nav = useNavigate();
  const [me, setMe] = useState<AuthUser | null>(getStoredUser());
  const [data, setData] = useState<Overview | null>(null);
  const [botCount, setBotCount] = useState(25);
  const [msg, setMsg] = useState<string | null>(null);
  const [adjust, setAdjust] = useState<{ userId: string; delta: string }>({
    userId: "",
    delta: "1000",
  });

  const load = useCallback(async () => {
    const overview = await api<Overview>("/api/admin/overview");
    setData(overview);
    setBotCount(overview.stats.botTarget);
  }, []);

  useEffect(() => {
    if (!getToken()) {
      nav("/login", { replace: true });
      return;
    }
    api<{ ok: true; user: AuthUser }>("/api/auth/me")
      .then((r) => {
        if (r.user.role !== "admin") {
          nav("/dashboard", { replace: true });
          return;
        }
        setMe(r.user);
        const token = getToken();
        if (token) saveSession(token, r.user);
        return load();
      })
      .catch(() => {
        clearSession();
        nav("/login", { replace: true });
      });
  }, [nav, load]);

  const logout = () => {
    clearSession();
    nav("/login", { replace: true });
  };

  const applyBots = async () => {
    try {
      await api("/api/admin/bots", {
        method: "POST",
        body: JSON.stringify({ count: botCount }),
      });
      setMsg(`Đã đặt ${botCount} bot`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Lỗi");
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
        }),
      });
      setMsg("Đã cập nhật số dư");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Lỗi");
    }
  };

  if (!me || !data) {
    return (
      <AppShell center maxWidth="lg">
        <p className="text-[var(--play-muted)]">Đang tải admin…</p>
      </AppShell>
    );
  }

  const s = data.stats;

  return (
    <AppShell maxWidth="lg">
      <header className="flex items-center gap-3">
        <img
          src="/assets/logo/logo-tarot.png"
          alt=""
          className="h-11 w-11 rounded-full object-cover shadow-md ring-2 ring-white/90"
        />
        <div className="min-w-0 flex-1">
          <h1 className="play-heading text-lg">Admin Dashboard</h1>
          <p className="text-xs text-[var(--play-muted)]">{me.username}</p>
        </div>
        <button type="button" onClick={logout} className="app-btn-ghost">
          Thoát
        </button>
      </header>

      {msg && (
        <p className="mt-3 text-center text-xs font-semibold text-teal-800">
          {msg}
        </p>
      )}

      <section className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {[
          ["Phase", s.phase],
          ["Ván #", String(s.roundNumber)],
          ["Online thật", String(s.realPlayers)],
          ["Hiển thị", String(s.displayOnline)],
          ["Bot active", String(s.botActive)],
          ["VIP pool", formatXu(s.vipPool)],
        ].map(([label, value]) => (
          <div key={label} className="app-panel p-3">
            <p className="play-section-title !normal-case !tracking-wide">
              {label}
            </p>
            <p className="font-play mt-1 text-sm font-bold text-[var(--play-ink)]">
              {value}
            </p>
          </div>
        ))}
      </section>

      <section className="app-frame mt-4 px-3 py-3">
        <p className="play-heading text-sm">Số lượng bot</p>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={50}
            value={botCount}
            onChange={(e) => setBotCount(Number(e.target.value))}
            className="flex-1 accent-teal-600"
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
            className="rounded-full bg-[#1e3a6e] px-3 py-1.5 text-xs font-bold text-white"
          >
            Áp dụng
          </button>
        </div>
      </section>

      <section className="app-panel mt-4 p-3">
        <p className="play-heading text-sm">Cộng / trừ xu user</p>
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
            {data.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username} ({formatXu(u.balance)} xu) — {u.role}
              </option>
            ))}
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
              className="rounded-xl bg-[#1e3a6e] px-4 text-xs font-bold text-white"
            >
              Cập nhật
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[1000, 10000, -1000, -10000].map((n) => (
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
        <p className="play-heading mb-2 text-sm">
          Danh sách user ({data.users.length})
        </p>
        <ul className="max-h-56 space-y-1.5 overflow-y-auto">
          {data.users.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between rounded-lg bg-white/70 px-2 py-2 text-xs ring-1 ring-[#1e3a6e]/10"
            >
              <div>
                <p className="font-semibold text-[var(--play-ink)]">
                  {u.username}{" "}
                  <span className="text-teal-700">{u.role}</span>
                </p>
                <p className="text-[10px] text-[var(--play-muted)]">
                  Thưởng ngày: {formatXu(u.winToday)} · Đoán: {u.guessesToday}
                </p>
              </div>
              <p className="font-play font-bold text-amber-700 tabular-nums">
                {formatXu(u.balance)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-5 flex gap-2">
        <Link to="/play" className="app-btn-primary flex-1">
          Vào bàn chơi
        </Link>
        <button
          type="button"
          onClick={() => load().then(() => setMsg("Đã làm mới"))}
          className="app-btn-ghost !rounded-xl !px-4 !py-3 !text-xs"
        >
          Refresh
        </button>
      </div>
    </AppShell>
  );
}
