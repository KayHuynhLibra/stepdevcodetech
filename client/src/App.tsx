import { useState } from "react";
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
import { ComplianceGate } from "./components/ComplianceGate";
import { hasPlayComplianceAck } from "./compliance";
import { ensureGuestCode, guestPlayPath } from "./guest";
import LoginPage from "./pages/LoginPage";
import LegalPage from "./pages/LegalPage";
import UserDashboard from "./pages/UserDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import DealDashboard from "./pages/DealDashboard";
import GamePage from "./pages/GamePage";
import ArcanaWheelPage from "./pages/ArcanaWheelPage";

type DashRole =
  | "user"
  | "admin"
  | "mainadmin"
  | "deal"
  | "tutien"
  | "mod"
  | "eco"
  | "audit";

function isNonPlayerRole(role: UserRole): boolean {
  return (
    isStaff({ role }) ||
    role === "deal" ||
    role === "tutien" ||
    role === "mod" ||
    role === "eco" ||
    role === "audit"
  );
}

function RequireAuth({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: DashRole;
}) {
  const token = getToken();
  const user = getStoredUser();
  if (!token || !user) return <Navigate to={AUTH_LOGIN} replace />;
  if (user.mustChangePassword) {
    return <Navigate to={AUTH_CHANGE_PASSWORD} replace />;
  }

  if (role && role !== "user" && user.role !== role) {
    return <Navigate to={homePath(user)} replace />;
  }
  if (role === "user" && isNonPlayerRole(user.role)) {
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
  role?: DashRole;
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

  const mine = String(user.code || user.id).toUpperCase();
  const param = String(userCode || "").toUpperCase();
  const onPlay =
    loc.pathname.endsWith("/play") || loc.pathname.endsWith("/arcana");
  const ownHome = homePath(user);
  const ownPlay = playPath(user);
  const ownDest = loc.pathname.endsWith("/arcana")
    ? `${ownHome}/arcana`
    : onPlay
      ? ownPlay
      : ownHome;

  if (role && role !== "user" && user.role !== role) {
    return <Navigate to={ownDest} replace />;
  }
  if (role === "user" && isNonPlayerRole(user.role)) {
    return <Navigate to={ownDest} replace />;
  }

  if (!param || param !== mine) {
    return <Navigate to={ownDest} replace />;
  }

  return <RequireAuth role={role}>{children}</RequireAuth>;
}

function RequireOwnGuest() {
  const { guestCode } = useParams();
  const user = getStoredUser();
  const [ack, setAck] = useState(() => hasPlayComplianceAck());
  if (getToken() && user) {
    return <Navigate to={postAuthPath(user)} replace />;
  }

  const mine = ensureGuestCode();
  const param = (guestCode || "").toUpperCase();
  if (!param || param !== mine) {
    return <Navigate to={guestPlayPath(mine)} replace />;
  }
  if (!ack) {
    return (
      <ComplianceGate
        title="Chơi khách — xác nhận 18+"
        onAccepted={() => setAck(true)}
      />
    );
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
      <Route path="/terms" element={<LegalPage doc="terms" />} />
      <Route path="/privacy" element={<LegalPage doc="privacy" />} />

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
        path="/eco/:userCode"
        element={
          <RequireOwnCode role="eco">
            <AdminDashboard />
          </RequireOwnCode>
        }
      />
      <Route
        path="/eco/:userCode/play"
        element={
          <RequireOwnCode role="eco">
            <GamePage />
          </RequireOwnCode>
        }
      />
      <Route
        path="/eco/:userCode/arcana"
        element={
          <RequireOwnCode role="eco">
            <ArcanaWheelPage />
          </RequireOwnCode>
        }
      />

      <Route
        path="/audit/:userCode"
        element={
          <RequireOwnCode role="audit">
            <AdminDashboard />
          </RequireOwnCode>
        }
      />
      <Route
        path="/audit/:userCode/play"
        element={
          <RequireOwnCode role="audit">
            <GamePage />
          </RequireOwnCode>
        }
      />
      <Route
        path="/audit/:userCode/arcana"
        element={
          <RequireOwnCode role="audit">
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

      <Route
        path="/tutien/:userCode"
        element={
          <RequireOwnCode role="tutien">
            <AdminDashboard />
          </RequireOwnCode>
        }
      />
      <Route
        path="/tutien/:userCode/play"
        element={
          <RequireOwnCode role="tutien">
            <GamePage />
          </RequireOwnCode>
        }
      />
      <Route
        path="/tutien/:userCode/arcana"
        element={
          <RequireOwnCode role="tutien">
            <ArcanaWheelPage />
          </RequireOwnCode>
        }
      />

      <Route
        path="/mod/:userCode"
        element={
          <RequireOwnCode role="mod">
            <AdminDashboard />
          </RequireOwnCode>
        }
      />
      <Route
        path="/mod/:userCode/play"
        element={
          <RequireOwnCode role="mod">
            <GamePage />
          </RequireOwnCode>
        }
      />
      <Route
        path="/mod/:userCode/arcana"
        element={
          <RequireOwnCode role="mod">
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
      <Route path="/eco" element={<LegacyRoleRedirect role="eco" />} />
      <Route path="/audit" element={<LegacyRoleRedirect role="audit" />} />
      <Route path="/deal" element={<LegacyRoleRedirect role="deal" />} />
      <Route path="/tutien" element={<LegacyRoleRedirect role="tutien" />} />
      <Route path="/mod" element={<LegacyRoleRedirect role="mod" />} />
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
      <Route path="*" element={<Navigate to={AUTH_LOGIN} replace />} />
    </Routes>
  );
}
