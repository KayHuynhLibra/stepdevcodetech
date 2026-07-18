import { useEffect, useState } from "react";
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

export default function UserDashboard() {
  const nav = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(getStoredUser());
  const [error, setError] = useState<string | null>(null);

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
        if (r.user.role === "admin") nav("/admin", { replace: true });
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

  if (!user) {
    return (
      <AppShell center>
        <p className="text-[var(--play-muted)]">Đang tải…</p>
      </AppShell>
    );
  }

  return (
    <AppShell maxWidth="md">
      <header className="flex items-center gap-3">
        <img
          src="/assets/ui/avatar-default.png"
          alt=""
          className="h-12 w-12 rounded-full object-cover shadow-md ring-2 ring-white/90"
        />
        <div className="min-w-0 flex-1">
          <h1 className="play-heading truncate text-lg">
            Xin chào, {user.username}
          </h1>
          <p className="text-xs text-[var(--play-muted)]">
            Dashboard người chơi
          </p>
        </div>
        <button type="button" onClick={logout} className="app-btn-ghost">
          Thoát
        </button>
      </header>

      {error && (
        <p className="mt-3 text-center text-xs text-red-600">{error}</p>
      )}

      <section className="mt-5 grid grid-cols-2 gap-2.5">
        {[
          ["Số dư xu", formatXu(user.balance), true],
          ["Thưởng hôm nay", formatXu(user.winToday), false],
          ["Đã đoán hôm nay", String(user.guessesToday), false],
          ["Vai trò", "Player", false],
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
        <Link to="/play" className="app-btn-primary mt-4">
          Vào bàn Tarot
        </Link>
      </div>
    </AppShell>
  );
}
