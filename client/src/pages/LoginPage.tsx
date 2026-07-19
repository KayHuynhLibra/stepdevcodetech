import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  api,
  changePassword,
  clearSession,
  getStoredUser,
  getToken,
  homePath,
  recoverPassword,
  saveSession,
  type AuthUser,
} from "../auth";
import {
  clearGuestMergePending,
  ensureGuestCode,
  getGuestMergePayload,
  guestPlayPath,
} from "../guest";
import { AppShell } from "../components/AppShell";

type Mode = "login" | "register" | "changePw" | "recover";

export default function LoginPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const guestHref = useMemo(() => guestPlayPath(ensureGuestCode()), []);

  useEffect(() => {
    const user = getStoredUser();
    if (getToken() && user) {
      if (user.mustChangePassword) {
        setMode("changePw");
        return;
      }
      nav(homePath(user), { replace: true });
    }
  }, [nav]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "changePw") {
        await changePassword(password, nextPassword);
        clearSession();
        setMode("login");
        setPassword("");
        setNextPassword("");
        setInfo("Đã đổi mật khẩu. Đăng nhập lại với mật khẩu mới.");
        return;
      }
      if (mode === "recover") {
        await recoverPassword(username, recoveryCode, nextPassword);
        setMode("login");
        setPassword("");
        setNextPassword("");
        setRecoveryCode("");
        setInfo("Đã đặt mật khẩu mới — đăng nhập lại.");
        return;
      }
      const path =
        mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const merge = getGuestMergePayload();
      const data = await api<{
        ok: true;
        user: AuthUser;
        token: string;
        guestMerged?: boolean;
      }>(path, {
        method: "POST",
        body: JSON.stringify({ username, password, ...merge }),
      });
      saveSession(data.token, data.user);
      clearGuestMergePending();
      if (data.user.recoveryCode && mode === "register") {
        setInfo(
          `Lưu mã khôi phục: ${data.user.recoveryCode} (cần khi quên mật khẩu)`,
        );
      }
      if (data.guestMerged) {
        setInfo((prev) =>
          prev
            ? `${prev} · Đã mang xu/avatar khách sang tài khoản.`
            : "Đã mang xu/avatar khách sang tài khoản.",
        );
      }
      if (data.user.mustChangePassword) {
        setMode("changePw");
        setPassword("");
        setInfo("Tài khoản seed — vui lòng đổi mật khẩu trước khi tiếp tục.");
        return;
      }
      if (data.user.recoveryCode && mode === "register") {
        // Cho user đọc mã trước khi vào app
        window.setTimeout(() => nav(homePath(data.user), { replace: true }), 2200);
        return;
      }
      nav(homePath(data.user), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi đăng nhập");
    } finally {
      setLoading(false);
    }
  };

  const title =
    mode === "changePw"
      ? "Đổi mật khẩu bắt buộc"
      : mode === "recover"
        ? "Quên mật khẩu"
        : mode === "login"
          ? "Đăng nhập"
          : "Đăng ký tài khoản";

  return (
    <AppShell center maxWidth="sm">
      <div className="w-full">
        <div className="app-frame w-full px-4 pb-5 pt-8">
          <div className="mb-4 flex items-center gap-3">
            <img
              src="/assets/logo/logo-tarot.png"
              alt=""
              className="h-12 w-12 rounded-full object-cover shadow-md ring-2 ring-white/90"
            />
            <div>
              <h1 className="play-heading text-xl tracking-wide">
                SOFIAORE-TAROT
              </h1>
              <p className="text-xs text-[var(--play-muted)]">{title}</p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode !== "changePw" && (
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
            )}
            {mode === "recover" && (
              <label className="block text-xs font-semibold text-[var(--play-muted)]">
                Mã khôi phục
                <input
                  value={recoveryCode}
                  onChange={(e) =>
                    setRecoveryCode(e.target.value.toUpperCase())
                  }
                  className="app-input mt-1 font-mono uppercase"
                  required
                  spellCheck={false}
                />
              </label>
            )}
            <label className="block text-xs font-semibold text-[var(--play-muted)]">
              {mode === "changePw"
                ? "Mật khẩu hiện tại"
                : mode === "recover"
                  ? "Mật khẩu mới"
                  : "Mật khẩu"}
              <input
                type="password"
                value={mode === "recover" ? nextPassword : password}
                onChange={(e) =>
                  mode === "recover"
                    ? setNextPassword(e.target.value)
                    : setPassword(e.target.value)
                }
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                className="app-input mt-1"
                required
                minLength={mode === "recover" || mode === "register" ? 6 : undefined}
              />
            </label>
            {mode === "changePw" && (
              <label className="block text-xs font-semibold text-[var(--play-muted)]">
                Mật khẩu mới
                <input
                  type="password"
                  value={nextPassword}
                  onChange={(e) => setNextPassword(e.target.value)}
                  autoComplete="new-password"
                  className="app-input mt-1"
                  minLength={6}
                  required
                />
              </label>
            )}

            {error && (
              <p className="text-center text-xs font-medium text-red-600">
                {error}
              </p>
            )}
            {info && (
              <p className="text-center text-xs font-medium text-[var(--wood-deep)]">
                {info}
              </p>
            )}

            <button type="submit" disabled={loading} className="app-btn-primary">
              {loading
                ? "Đang xử lý…"
                : mode === "changePw"
                  ? "Đổi mật khẩu"
                  : mode === "recover"
                    ? "Đặt mật khẩu mới"
                    : mode === "login"
                      ? "Đăng nhập"
                      : "Tạo tài khoản"}
            </button>
          </form>

          {mode !== "changePw" && (
            <div className="mt-3 space-y-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setError(null);
                  setInfo(null);
                }}
                className="w-full text-xs font-semibold text-[var(--play-ink)] underline-offset-2 hover:underline"
              >
                {mode === "login"
                  ? "Chưa có tài khoản? Đăng ký"
                  : mode === "register"
                    ? "Đã có tài khoản? Đăng nhập"
                    : "Quay lại đăng nhập"}
              </button>
              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("recover");
                    setError(null);
                    setInfo(null);
                  }}
                  className="w-full text-xs font-semibold text-[var(--wood-deep)] underline-offset-2 hover:underline"
                >
                  Quên mật khẩu?
                </button>
              )}
              {mode === "recover" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                    setInfo(null);
                  }}
                  className="w-full text-xs font-semibold text-[var(--play-ink)] underline-offset-2 hover:underline"
                >
                  Quay lại đăng nhập
                </button>
              )}
            </div>
          )}

          <div className="mt-4 text-center">
            <Link
              to={guestHref}
              className="text-xs font-semibold text-[var(--wood-deep)] underline-offset-2 hover:underline"
            >
              Vào chơi nhanh (khách) ›
            </Link>
          </div>
        </div>

        <aside className="login-dedication mx-auto mt-4 max-w-[16rem]">
          <p className="login-dedication-text">
            Chúc Bé Sofia và các bạn chọt đỡ ghiền
          </p>
        </aside>
      </div>
    </AppShell>
  );
}
