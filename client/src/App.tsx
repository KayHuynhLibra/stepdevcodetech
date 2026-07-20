import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import {
  AUTH_CHANGE_PASSWORD,
  AUTH_LOGIN,
  getStoredUser,
  getToken,
  homePath,
  isStaff,
  playPath,
  postAuthPath,
  type AuthUser,
  type UserRole,
} from "./auth";
import { ensureGuestCode, guestPlayPath } from "./guest";
import LoginPage from "./pages/LoginPage";
import UserDashboard from "./pages/UserDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import DealDashboard from "./pages/DealDashboard";
import GamePage from "./pages/GamePage";
import ArcanaWheelPage from "./pages/ArcanaWheelPage";

function RequireAuth({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: "user" | "admin" | "mainadmin" | "deal";
}) {
  const token = getToken();
  const user = getStoredUser();
  if (!token || !user) return <Navigate to={AUTH_LOGIN} replace />;
  if (user.mustChangePassword) {
    return <Navigate to={AUTH_CHANGE_PASSWORD} replace />;
  }

  if (role === "mainadmin" && user.role !== "mainadmin") {
    return <Navigate to={homePath(user)} replace />;
  }
  if (role === "admin" && user.role !== "admin") {
    return <Navigate to={homePath(user)} replace />;
  }
  if (role === "deal" && user.role !== "deal") {
    return <Navigate to={homePath(user)} replace />;
  }
  if (role === "user" && (isStaff(user) || user.role === "deal")) {
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
  role?: "user" | "admin" | "mainadmin" | "deal";
}) {
  const { userCode } = useParams();
  const loc = useLocation();
  const token = getToken();
  const user = getStoredUser();

  if (!token || !user) {
    return <Navigate to={AUTH_LOGIN} replace />;
  }
  if (user.mustChangePassword) {
    return <Navigate to={AUTH_CHANGE_PASSWORD} replace />;
  }

  const mine = String(user.code || user.id);
  const param = String(userCode || "");
  const onPlay =
    loc.pathname.endsWith("/play") || loc.pathname.endsWith("/arcana");
  const ownHome = homePath(user);
  const ownPlay = playPath(user);
  // Khi đang ở /arcana mà bị redirect vì sai mã, giữ /arcana
  const ownDest = loc.pathname.endsWith("/arcana")
    ? `${ownHome}/arcana`
    : onPlay
      ? ownPlay
      : ownHome;

  // Role URL không khớp (vd player vào /admin/…)
  if (role === "mainadmin" && user.role !== "mainadmin") {
    return <Navigate to={ownDest} replace />;
  }
  if (role === "admin" && user.role !== "admin") {
    return <Navigate to={ownDest} replace />;
  }
  if (role === "deal" && user.role !== "deal") {
    return <Navigate to={ownDest} replace />;
  }
  if (role === "user" && (isStaff(user) || user.role === "deal")) {
    return <Navigate to={ownDest} replace />;
  }

  // Mã trên URL ≠ mã user đang login
  if (!param || param !== mine) {
    return <Navigate to={ownDest} replace />;
  }

  return <RequireAuth role={role}>{children}</RequireAuth>;
}

/** Khách: chỉ vào được URL đúng mã guest của máy này; đã login → bàn của user. */
function RequireOwnGuest() {
  const { guestCode } = useParams();
  const user = getStoredUser();
  if (getToken() && user) {
    return <Navigate to={postAuthPath(user)} replace />;
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
    return <Navigate to={postAuthPath(user)} replace />;
  }
  return <Navigate to={guestPlayPath(ensureGuestCode())} replace />;
}

function LegacyRoleRedirect(_props: { role: UserRole }) {
  const user = getStoredUser();
  if (!getToken() || !user) return <Navigate to={AUTH_LOGIN} replace />;
  return <Navigate to={postAuthPath(user)} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage page="login" />} />
      <Route path="/register" element={<LoginPage page="register" />} />
      <Route path="/recover" element={<LoginPage page="recover" />} />
      <Route
        path="/change-password"
        element={<LoginPage page="changePw" />}
      />

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
        path="/player/:userCode/arcana"
        element={
          <RequireOwnCode role="user">
            <ArcanaWheelPage />
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
        path="/admin/:userCode/arcana"
        element={
          <RequireOwnCode role="admin">
            <ArcanaWheelPage />
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
      <Route
        path="/mainadmin/:userCode/arcana"
        element={
          <RequireOwnCode role="mainadmin">
            <ArcanaWheelPage />
          </RequireOwnCode>
        }
      />

      <Route
        path="/deal/:userCode"
        element={
          <RequireOwnCode role="deal">
            <DealDashboard />
          </RequireOwnCode>
        }
      />
      <Route
        path="/deal/:userCode/play"
        element={
          <RequireOwnCode role="deal">
            <GamePage />
          </RequireOwnCode>
        }
      />
      <Route
        path="/deal/:userCode/arcana"
        element={
          <RequireOwnCode role="deal">
            <ArcanaWheelPage />
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
            to={
              getToken()
                ? postAuthPath(getStoredUser() as AuthUser)
                : AUTH_LOGIN
            }
            replace
          />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
