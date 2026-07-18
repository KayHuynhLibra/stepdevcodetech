import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import {
  getStoredUser,
  getToken,
  homePath,
  isStaff,
  playPath,
  type AuthUser,
  type UserRole,
} from "./auth";
import { ensureGuestCode, guestPlayPath } from "./guest";
import LoginPage from "./pages/LoginPage";
import UserDashboard from "./pages/UserDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import GamePage from "./pages/GamePage";

function RequireAuth({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: "user" | "admin" | "mainadmin";
}) {
  const token = getToken();
  const user = getStoredUser();
  if (!token || !user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword) return <Navigate to="/login" replace />;

  if (role === "mainadmin" && user.role !== "mainadmin") {
    return <Navigate to={homePath(user)} replace />;
  }
  if (role === "admin" && user.role !== "admin") {
    return <Navigate to={homePath(user)} replace />;
  }
  if (role === "user" && isStaff(user)) {
    return <Navigate to={homePath(user)} replace />;
  }
  return children;
}

/**
 * URL phải đúng role + đúng mã của user đang login.
 * Sai mã / sai khu → đẩy về đường dẫn của chính họ (giữ /play nếu đang chơi).
 */
function RequireOwnCode({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: "user" | "admin" | "mainadmin";
}) {
  const { userCode } = useParams();
  const loc = useLocation();
  const token = getToken();
  const user = getStoredUser();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }
  if (user.mustChangePassword) {
    return <Navigate to="/login" replace />;
  }

  const mine = (user.code || user.id).toUpperCase();
  const param = (userCode || "").toUpperCase();
  const onPlay = loc.pathname.endsWith("/play");
  const ownHome = homePath(user);
  const ownPlay = playPath(user);

  // Role URL không khớp (vd player vào /admin/…)
  if (role === "mainadmin" && user.role !== "mainadmin") {
    return <Navigate to={onPlay ? ownPlay : ownHome} replace />;
  }
  if (role === "admin" && user.role !== "admin") {
    return <Navigate to={onPlay ? ownPlay : ownHome} replace />;
  }
  if (role === "user" && isStaff(user)) {
    return <Navigate to={onPlay ? ownPlay : ownHome} replace />;
  }

  // Mã trên URL ≠ mã user đang login
  if (!param || param !== mine) {
    return <Navigate to={onPlay ? ownPlay : ownHome} replace />;
  }

  return <RequireAuth role={role}>{children}</RequireAuth>;
}

/** Khách: chỉ vào được URL đúng mã guest của máy này; đã login → bàn của user. */
function RequireOwnGuest() {
  const { guestCode } = useParams();
  const user = getStoredUser();
  if (getToken() && user) {
    return <Navigate to={playPath(user)} replace />;
  }

  const mine = ensureGuestCode();
  const param = (guestCode || "").toUpperCase();
  if (!param || param !== mine) {
    return <Navigate to={guestPlayPath(mine)} replace />;
  }
  return <GamePage />;
}

function GuestEntry() {
  const user = getStoredUser();
  if (getToken() && user) {
    return <Navigate to={playPath(user)} replace />;
  }
  return <Navigate to={guestPlayPath(ensureGuestCode())} replace />;
}

function LegacyRoleRedirect(_props: { role: UserRole }) {
  const user = getStoredUser();
  if (!getToken() || !user) return <Navigate to="/login" replace />;
  return <Navigate to={homePath(user)} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/player/:userCode"
        element={
          <RequireOwnCode role="user">
            <UserDashboard />
          </RequireOwnCode>
        }
      />
      <Route
        path="/player/:userCode/play"
        element={
          <RequireOwnCode role="user">
            <GamePage />
          </RequireOwnCode>
        }
      />

      <Route
        path="/admin/:userCode"
        element={
          <RequireOwnCode role="admin">
            <AdminDashboard />
          </RequireOwnCode>
        }
      />
      <Route
        path="/admin/:userCode/play"
        element={
          <RequireOwnCode role="admin">
            <GamePage />
          </RequireOwnCode>
        }
      />

      <Route
        path="/mainadmin/:userCode"
        element={
          <RequireOwnCode role="mainadmin">
            <AdminDashboard />
          </RequireOwnCode>
        }
      />
      <Route
        path="/mainadmin/:userCode/play"
        element={
          <RequireOwnCode role="mainadmin">
            <GamePage />
          </RequireOwnCode>
        }
      />

      <Route path="/guest/:guestCode/play" element={<RequireOwnGuest />} />
      <Route path="/play" element={<GuestEntry />} />

      <Route path="/player" element={<LegacyRoleRedirect role="user" />} />
      <Route path="/admin" element={<LegacyRoleRedirect role="admin" />} />
      <Route
        path="/mainadmin"
        element={<LegacyRoleRedirect role="mainadmin" />}
      />
      <Route path="/dashboard" element={<LegacyRoleRedirect role="user" />} />

      <Route
        path="/"
        element={
          <Navigate
            to={getToken() ? homePath(getStoredUser() as AuthUser) : "/login"}
            replace
          />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
