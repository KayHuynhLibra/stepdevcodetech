import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AUTH_CHANGE_PASSWORD,
  AUTH_LOGIN,
  AUTH_RECOVER,
  AUTH_REGISTER,
  api,
  changePassword,
  clearSession,
  getStoredUser,
  getToken,
  homePath,
  postAuthPath,
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
import { getDevicePayload } from "../device";
import { AppShell } from "../components/AppShell";
import { setPlayComplianceAck } from "../compliance";

export type AuthPage = "login" | "register" | "recover" | "changePw";

function roleLabel(role: AuthUser["role"]): string {
  if (role === "mainadmin") return "Mainadmin";
  if (role === "admin") return "Admin";
  return "Player";
}

export default function LoginPage({ page }: { page: AuthPage }) {
  const nav = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [ageOk, setAgeOk] = useState(false);
  const [termsOk, setTermsOk] = useState(false);
  const [requireInvite, setRequireInvite] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(
    () => (location.state as { info?: string } | null)?.info ?? null,
  );
  const [loading, setLoading] = useState(false);
  const guestHref = useMemo(() => guestPlayPath(ensureGuestCode()), []);

  useEffect(() => {
    const msg = (location.state as { info?: string } | null)?.info;
    if (msg) setInfo(msg);
  }, [location.key, location.state]);

  useEffect(() => {
    const token = getToken();
    const user = getStoredUser();

    if (page === "changePw") {
      if (!token || !user) {
        nav(AUTH_LOGIN, { replace: true });
        return;
      }
      if (!user.mustChangePassword) {
        nav(homePath(user), { replace: true });
      }
      return;
    }

    if (token && user) {
      nav(postAuthPath(user), { replace: true });
    }
  }, [page, nav]);

  useEffect(() => {
    if (page !== "register") return;
    let cancelled = false;
    api<{ ok: true; requireInvite: boolean }>("/api/auth/register-config")
      .then((r) => {
        if (!cancelled) setRequireInvite(r.requireInvite !== false);
      })
      .catch(() => {
        if (!cancelled) setRequireInvite(true);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (page === "changePw") {
        await changePassword(password, nextPassword);
        clearSession();
        setPassword("");
        setNextPassword("");
        nav(AUTH_LOGIN, {
          replace: true,
          state: { info: "Đã đổi mật khẩu. Đăng nhập lại với mật khẩu mới." },
        });
        return;
      }
      if (page === "recover") {
        await recoverPassword(username, recoveryCode, nextPassword);
        nav(AUTH_LOGIN, {
          replace: true,
          state: { info: "Đã đặt mật khẩu mới — đăng nhập lại." },
        });
        return;
      }
      const path =
        page === "login" ? "/api/auth/login" : "/api/auth/register";
      if (page === "register") {
        if (!ageOk || !termsOk) {
          setError(
            "Cần xác nhận đủ 18 tuổi và đồng ý Điều khoản / Bảo mật.",
          );
          return;
        }
      }
      const merge = getGuestMergePayload();
      const dev = getDevicePayload();
      const data = await api<{
        ok: true;
        user: AuthUser;
        token: string;
        guestMerged?: boolean;
      }>(path, {
        method: "POST",
        body: JSON.stringify({
          username,
          password,
          ...(page === "register" && requireInvite
            ? { inviteCode: inviteCode.trim().toUpperCase() }
            : {}),
          ...merge,
          ...dev,
        }),
      });
      saveSession(data.token, data.user);
      clearGuestMergePending();
      if (page === "register") setPlayComplianceAck();
      if (data.user.recoveryCode && page === "register") {
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
        setPassword("");
        nav(AUTH_CHANGE_PASSWORD, {
          replace: true,
          state: {
            info: "Tài khoản seed — vui lòng đổi mật khẩu trước khi tiếp tục.",
          },
        });
        return;
      }
      if (data.user.recoveryCode && page === "register") {
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
    page === "changePw"
      ? "Đổi mật khẩu bắt buộc"
      : page === "recover"
        ? "Quên mật khẩu"
        : page === "login"
          ? "Đăng nhập"
          : "Đăng ký tài khoản";

  const changePwUser = page === "changePw" ? getStoredUser() : null;

  const leaveChangePw = () => {
    clearSession();
    setPassword("");
    setNextPassword("");
    setError(null);
    setInfo(null);
    nav(AUTH_LOGIN, { replace: true });
  };

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

          {changePwUser && (
            <div
              className="mb-4 rounded-2xl border border-[var(--gold)]/35 bg-white/75 px-3.5 py-3 shadow-sm"
              aria-live="polite"
            >
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--play-muted)]">
                Đang đổi mật khẩu cho
              </p>
              <p className="play-heading mt-0.5 text-base">
                {changePwUser.username}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="identity-chip identity-chip--code identity-chip--code-lg font-mono">
                  ID {String(changePwUser.code || changePwUser.id).toUpperCase()}
                </span>
                <span className="text-xs font-semibold text-[var(--wood-deep)]">
                  {roleLabel(changePwUser.role)}
                </span>
              </div>
            </div>
          )}

          <form onSubmit={submit} className="space-y-3">
            {page !== "changePw" && (
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
            {page === "register" && requireInvite && (
              <label className="block text-xs font-semibold text-[var(--play-muted)]">
                Mã thành viên (8 ký tự)
                <input
                  value={inviteCode}
                  onChange={(e) =>
                    setInviteCode(
                      e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "")
                        .slice(0, 8),
                    )
                  }
                  maxLength={8}
                  spellCheck={false}
                  autoComplete="off"
                  className="app-input mt-1 font-mono uppercase tracking-wider"
                  required
                  minLength={8}
                />
                <span className="mt-1 block text-[10px] font-medium text-[var(--play-muted)]">
                  Bắt buộc — lấy mã từ admin
                </span>
              </label>
            )}
            {page === "register" && !requireInvite && (
              <p className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[10px] text-emerald-900 ring-1 ring-emerald-200/80">
                Đăng ký mở — không cần mã mời.
              </p>
            )}
            {page === "recover" && (
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
              {page === "changePw"
                ? "Mật khẩu hiện tại"
                : page === "recover"
                  ? "Mật khẩu mới"
                  : "Mật khẩu"}
              <input
                type="password"
                value={page === "recover" ? nextPassword : password}
                onChange={(e) =>
                  page === "recover"
                    ? setNextPassword(e.target.value)
                    : setPassword(e.target.value)
                }
                autoComplete={
                  page === "login" ? "current-password" : "new-password"
                }
                className="app-input mt-1"
                required
                minLength={
                  page === "recover" || page === "register" ? 6 : undefined
                }
              />
            </label>
            {page === "changePw" && (
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

            {page === "register" && (
              <div className="space-y-2 rounded-lg bg-[var(--cream)]/80 px-2.5 py-2 ring-1 ring-[var(--wood-deep)]/10">
                <p className="text-[10px] leading-relaxed text-[var(--play-muted)]">
                  Xu là điểm ảo giải trí — không nạp/rút tiền thật.
                </p>
                <label className="flex cursor-pointer items-start gap-2 text-[11px] text-[var(--play-ink)]">
                  <input
                    type="checkbox"
                    checked={ageOk}
                    onChange={(e) => setAgeOk(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>Tôi đủ 18 tuổi (hoặc tuổi trưởng thành nơi tôi sống).</span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 text-[11px] text-[var(--play-ink)]">
                  <input
                    type="checkbox"
                    checked={termsOk}
                    onChange={(e) => setTermsOk(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    Đồng ý{" "}
                    <Link
                      to="/terms"
                      className="font-bold text-[var(--wood-deep)] underline"
                    >
                      Điều khoản
                    </Link>{" "}
                    &{" "}
                    <Link
                      to="/privacy"
                      className="font-bold text-[var(--wood-deep)] underline"
                    >
                      Bảo mật
                    </Link>
                    .
                  </span>
                </label>
              </div>
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
                : page === "changePw"
                  ? "Đổi mật khẩu"
                  : page === "recover"
                    ? "Đặt mật khẩu mới"
                    : page === "login"
                      ? "Đăng nhập"
                      : "Tạo tài khoản"}
            </button>
          </form>

          {page === "changePw" && (
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={leaveChangePw}
                className="text-xs font-semibold text-[var(--play-ink)] underline-offset-2 hover:underline"
              >
                Đăng nhập tài khoản khác
              </button>
            </div>
          )}

          {page !== "changePw" && (
            <div className="mt-3 space-y-2 text-center">
              {page === "login" && (
                <>
                  <Link
                    to={AUTH_REGISTER}
                    className="block w-full text-xs font-semibold text-[var(--play-ink)] underline-offset-2 hover:underline"
                  >
                    Chưa có tài khoản? Đăng ký
                  </Link>
                  <Link
                    to={AUTH_RECOVER}
                    className="block w-full text-xs font-semibold text-[var(--wood-deep)] underline-offset-2 hover:underline"
                  >
                    Quên mật khẩu?
                  </Link>
                </>
              )}
              {page === "register" && (
                <Link
                  to={AUTH_LOGIN}
                  className="block w-full text-xs font-semibold text-[var(--play-ink)] underline-offset-2 hover:underline"
                >
                  Đã có tài khoản? Đăng nhập
                </Link>
              )}
              {page === "recover" && (
                <Link
                  to={AUTH_LOGIN}
                  className="block w-full text-xs font-semibold text-[var(--play-ink)] underline-offset-2 hover:underline"
                >
                  Quay lại đăng nhập
                </Link>
              )}
            </div>
          )}

          <div className="mt-4 text-center">
            <Link
              to={guestHref}
              className="text-xs font-semibold text-[var(--wood-deep)] underline-offset-2 hover:underline"
            >
              Vào chơi nhanh (khách, tối đa 20 phút) ›
            </Link>
          </div>

          <p className="mt-3 text-center text-[10px] leading-relaxed text-[var(--play-muted)]">
            18+ · xu ảo ·{" "}
            <Link to="/terms" className="underline-offset-2 hover:underline">
              Điều khoản
            </Link>
            {" · "}
            <Link to="/privacy" className="underline-offset-2 hover:underline">
              Bảo mật
            </Link>
          </p>
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
