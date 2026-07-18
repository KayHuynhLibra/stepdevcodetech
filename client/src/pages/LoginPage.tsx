import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  api,
  getStoredUser,
  getToken,
  homePath,
  saveSession,
  type AuthUser,
} from "../auth";
import { ensureGuestCode, guestPlayPath } from "../guest";
import { AppShell } from "../components/AppShell";

export default function LoginPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const guestHref = useMemo(() => guestPlayPath(ensureGuestCode()), []);

  // Đã login → đưa về đúng URL của user đó
  useEffect(() => {
    const user = getStoredUser();
    if (getToken() && user) {
      nav(homePath(user), { replace: true });
    }
  }, [nav]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const path =
        mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const data = await api<{ ok: true; user: AuthUser; token: string }>(
        path,
        {
          method: "POST",
          body: JSON.stringify({ username, password }),
        },
      );
      saveSession(data.token, data.user);
      nav(homePath(data.user), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi đăng nhập");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell center maxWidth="sm">
      <div className="app-frame w-full px-4 pb-5 pt-8">
        <div className="mb-4 flex items-center gap-3">
          <img
            src="/assets/logo/logo-tarot.png"
            alt=""
            className="h-12 w-12 rounded-full object-cover shadow-md ring-2 ring-white/90"
          />
          <div>
            <h1 className="play-heading text-xl">Đoán bài Tarot</h1>
            <p className="text-xs text-[var(--play-muted)]">
              {mode === "login" ? "Đăng nhập" : "Đăng ký tài khoản"}
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <label className="block text-xs font-semibold text-[var(--play-muted)]">
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="app-input mt-1"
              required
            />
          </label>
          <label className="block text-xs font-semibold text-[var(--play-muted)]">
            Mật khẩu
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              className="app-input mt-1"
              required
            />
          </label>

          {error && (
            <p className="text-center text-xs font-medium text-red-600">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="app-btn-primary">
            {loading
              ? "Đang xử lý…"
              : mode === "login"
                ? "Đăng nhập"
                : "Tạo tài khoản"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError(null);
          }}
          className="mt-3 w-full text-center text-xs font-semibold text-[var(--play-ink)] underline-offset-2 hover:underline"
        >
          {mode === "login"
            ? "Chưa có tài khoản? Đăng ký"
            : "Đã có tài khoản? Đăng nhập"}
        </button>

        <div className="mt-4 text-center">
          <Link
            to={guestHref}
            className="text-xs font-semibold text-teal-700 underline-offset-2 hover:underline"
          >
            Vào chơi nhanh (khách) ›
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
