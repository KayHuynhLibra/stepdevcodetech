import { lazy, useState, type ReactNode } from "react";
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
  type UserRole,
} from "./auth";
import { ComplianceGate } from "./components/ComplianceGate";
import { hasPlayComplianceAck } from "./compliance";
import { ensureGuestCode, guestHomePath } from "./guest";
import LoginPage from "./pages/LoginPage";
import LegalPage from "./pages/LegalPage";
import {
  LazyArcanaWheelPage,
  LazyBoiBaiPage,
  LazyGamePage,
  LazyOlympusCasinoPage,
  withGameSuspense,
} from "./platform/lazyGames";

const UserDashboard = lazy(() => import("./pages/UserDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const DealDashboard = lazy(() => import("./pages/DealDashboard"));
const GuestLobbyPage = lazy(() => import("./pages/GuestLobbyPage"));

type DashRole =
  | "user"
  | "admin"
  | "mainadmin"
  | "deal"
  | "tutien"
  | "mod"
  | "eco"
  | "audit"
  | "sgift"
  | "ring"
  | "pm";

function isNonPlayerRole(role: UserRole): boolean {
  return (
    isStaff({ role }) ||
    role === "deal" ||
    role === "tutien" ||
    role === "mod" ||
    role === "eco" ||
    role === "audit" ||
    role === "sgift" ||
    role === "ring" ||
    role === "pm"
  );
}

function RequireAuth({
  children,
  role,
}: {
  children: ReactNode;
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
 * Sai mã / sai khu → đẩy về đường dẫn của chính họ (giữ bàn nếu đang chơi).
 */
function RequireOwnCode({
  children,
  role,
}: {
  children: ReactNode;
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
  const ownHome = homePath(user);
  const ownDest = loc.pathname.endsWith("/arcana")
    ? `${ownHome}/arcana`
    : loc.pathname.endsWith("/boi-bai")
      ? `${ownHome}/boi-bai`
      : loc.pathname.endsWith("/olympus")
        ? `${ownHome}/olympus`
        : loc.pathname.endsWith("/play")
          ? playPath(user)
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

/** Guest gate — children = lazy page của bàn đang vào. */
function RequireOwnGuest({ children }: { children: ReactNode }) {
  const { guestCode } = useParams();
  const user = getStoredUser();
  const [ack, setAck] = useState(() => hasPlayComplianceAck());
  if (getToken() && user) {
    return <Navigate to={postAuthPath(user)} replace />;
  }

  const mine = ensureGuestCode();
  const param = (guestCode || "").toUpperCase();
  if (!param || param !== mine) {
    return <Navigate to={guestHomePath(mine)} replace />;
  }
  if (!ack) {
    return (
      <ComplianceGate
        title="Chơi khách — xác nhận 18+"
        onAccepted={() => setAck(true)}
      />
    );
  }
  return <>{children}</>;
}

function GuestEntry() {
  const user = getStoredUser();
  if (getToken() && user) {
    return <Navigate to={postAuthPath(user)} replace />;
  }
  return <Navigate to={guestHomePath(ensureGuestCode())} replace />;
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
            {withGameSuspense(<UserDashboard />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/player/:userCode/play"
        element={
          <RequireOwnCode role="user">
            {withGameSuspense(<LazyGamePage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/player/:userCode/arcana"
        element={
          <RequireOwnCode role="user">
            {withGameSuspense(<LazyArcanaWheelPage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/player/:userCode/boi-bai"
        element={
          <RequireOwnCode role="user">
            {withGameSuspense(<LazyBoiBaiPage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/player/:userCode/olympus"
        element={
          <RequireOwnCode role="user">
            {withGameSuspense(<LazyOlympusCasinoPage />)}
          </RequireOwnCode>
        }
      />

      <Route
        path="/admin/:userCode"
        element={
          <RequireOwnCode role="admin">
            {withGameSuspense(<AdminDashboard />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/admin/:userCode/play"
        element={
          <RequireOwnCode role="admin">
            {withGameSuspense(<LazyGamePage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/admin/:userCode/arcana"
        element={
          <RequireOwnCode role="admin">
            {withGameSuspense(<LazyArcanaWheelPage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/admin/:userCode/boi-bai"
        element={
          <RequireOwnCode role="admin">
            {withGameSuspense(<LazyBoiBaiPage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/admin/:userCode/olympus"
        element={
          <RequireOwnCode role="admin">
            {withGameSuspense(<LazyOlympusCasinoPage />)}
          </RequireOwnCode>
        }
      />

      <Route
        path="/mainadmin/:userCode"
        element={
          <RequireOwnCode role="mainadmin">
            {withGameSuspense(<AdminDashboard />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/mainadmin/:userCode/play"
        element={
          <RequireOwnCode role="mainadmin">
            {withGameSuspense(<LazyGamePage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/mainadmin/:userCode/arcana"
        element={
          <RequireOwnCode role="mainadmin">
            {withGameSuspense(<LazyArcanaWheelPage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/mainadmin/:userCode/boi-bai"
        element={
          <RequireOwnCode role="mainadmin">
            {withGameSuspense(<LazyBoiBaiPage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/mainadmin/:userCode/olympus"
        element={
          <RequireOwnCode role="mainadmin">
            {withGameSuspense(<LazyOlympusCasinoPage />)}
          </RequireOwnCode>
        }
      />

      <Route
        path="/eco/:userCode"
        element={
          <RequireOwnCode role="eco">
            {withGameSuspense(<AdminDashboard />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/eco/:userCode/play"
        element={
          <RequireOwnCode role="eco">
            {withGameSuspense(<LazyGamePage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/eco/:userCode/arcana"
        element={
          <RequireOwnCode role="eco">
            {withGameSuspense(<LazyArcanaWheelPage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/eco/:userCode/boi-bai"
        element={
          <RequireOwnCode role="eco">
            {withGameSuspense(<LazyBoiBaiPage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/eco/:userCode/olympus"
        element={
          <RequireOwnCode role="eco">
            {withGameSuspense(<LazyOlympusCasinoPage />)}
          </RequireOwnCode>
        }
      />

      <Route
        path="/audit/:userCode"
        element={
          <RequireOwnCode role="audit">
            {withGameSuspense(<AdminDashboard />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/audit/:userCode/play"
        element={
          <RequireOwnCode role="audit">
            {withGameSuspense(<LazyGamePage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/audit/:userCode/arcana"
        element={
          <RequireOwnCode role="audit">
            {withGameSuspense(<LazyArcanaWheelPage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/audit/:userCode/boi-bai"
        element={
          <RequireOwnCode role="audit">
            {withGameSuspense(<LazyBoiBaiPage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/audit/:userCode/olympus"
        element={
          <RequireOwnCode role="audit">
            {withGameSuspense(<LazyOlympusCasinoPage />)}
          </RequireOwnCode>
        }
      />

      <Route
        path="/sgift/:userCode"
        element={
          <RequireOwnCode role="sgift">
            {withGameSuspense(<AdminDashboard />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/sgift/:userCode/play"
        element={
          <RequireOwnCode role="sgift">
            {withGameSuspense(<LazyGamePage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/sgift/:userCode/arcana"
        element={
          <RequireOwnCode role="sgift">
            {withGameSuspense(<LazyArcanaWheelPage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/sgift/:userCode/boi-bai"
        element={
          <RequireOwnCode role="sgift">
            {withGameSuspense(<LazyBoiBaiPage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/sgift/:userCode/olympus"
        element={
          <RequireOwnCode role="sgift">
            {withGameSuspense(<LazyOlympusCasinoPage />)}
          </RequireOwnCode>
        }
      />

      <Route
        path="/ring/:userCode"
        element={
          <RequireOwnCode role="ring">
            {withGameSuspense(<AdminDashboard />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/ring/:userCode/play"
        element={
          <RequireOwnCode role="ring">
            {withGameSuspense(<LazyGamePage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/ring/:userCode/arcana"
        element={
          <RequireOwnCode role="ring">
            {withGameSuspense(<LazyArcanaWheelPage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/ring/:userCode/boi-bai"
        element={
          <RequireOwnCode role="ring">
            {withGameSuspense(<LazyBoiBaiPage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/ring/:userCode/olympus"
        element={
          <RequireOwnCode role="ring">
            {withGameSuspense(<LazyOlympusCasinoPage />)}
          </RequireOwnCode>
        }
      />

      <Route
        path="/pm/:userCode"
        element={
          <RequireOwnCode role="pm">
            {withGameSuspense(<AdminDashboard />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/pm/:userCode/play"
        element={
          <RequireOwnCode role="pm">
            {withGameSuspense(<LazyGamePage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/pm/:userCode/arcana"
        element={
          <RequireOwnCode role="pm">
            {withGameSuspense(<LazyArcanaWheelPage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/pm/:userCode/boi-bai"
        element={
          <RequireOwnCode role="pm">
            {withGameSuspense(<LazyBoiBaiPage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/pm/:userCode/olympus"
        element={
          <RequireOwnCode role="pm">
            {withGameSuspense(<LazyOlympusCasinoPage />)}
          </RequireOwnCode>
        }
      />

      <Route
        path="/deal/:userCode"
        element={
          <RequireOwnCode role="deal">
            {withGameSuspense(<DealDashboard />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/deal/:userCode/play"
        element={
          <RequireOwnCode role="deal">
            {withGameSuspense(<LazyGamePage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/deal/:userCode/arcana"
        element={
          <RequireOwnCode role="deal">
            {withGameSuspense(<LazyArcanaWheelPage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/deal/:userCode/boi-bai"
        element={
          <RequireOwnCode role="deal">
            {withGameSuspense(<LazyBoiBaiPage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/deal/:userCode/olympus"
        element={
          <RequireOwnCode role="deal">
            {withGameSuspense(<LazyOlympusCasinoPage />)}
          </RequireOwnCode>
        }
      />

      <Route
        path="/tutien/:userCode"
        element={
          <RequireOwnCode role="tutien">
            {withGameSuspense(<AdminDashboard />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/tutien/:userCode/play"
        element={
          <RequireOwnCode role="tutien">
            {withGameSuspense(<LazyGamePage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/tutien/:userCode/arcana"
        element={
          <RequireOwnCode role="tutien">
            {withGameSuspense(<LazyArcanaWheelPage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/tutien/:userCode/boi-bai"
        element={
          <RequireOwnCode role="tutien">
            {withGameSuspense(<LazyBoiBaiPage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/tutien/:userCode/olympus"
        element={
          <RequireOwnCode role="tutien">
            {withGameSuspense(<LazyOlympusCasinoPage />)}
          </RequireOwnCode>
        }
      />

      <Route
        path="/mod/:userCode"
        element={
          <RequireOwnCode role="mod">
            {withGameSuspense(<AdminDashboard />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/mod/:userCode/play"
        element={
          <RequireOwnCode role="mod">
            {withGameSuspense(<LazyGamePage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/mod/:userCode/arcana"
        element={
          <RequireOwnCode role="mod">
            {withGameSuspense(<LazyArcanaWheelPage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/mod/:userCode/boi-bai"
        element={
          <RequireOwnCode role="mod">
            {withGameSuspense(<LazyBoiBaiPage />)}
          </RequireOwnCode>
        }
      />
      <Route
        path="/mod/:userCode/olympus"
        element={
          <RequireOwnCode role="mod">
            {withGameSuspense(<LazyOlympusCasinoPage />)}
          </RequireOwnCode>
        }
      />

      <Route
        path="/guest/:guestCode"
        element={withGameSuspense(<GuestLobbyPage />)}
      />
      <Route
        path="/guest/:guestCode/play"
        element={
          <RequireOwnGuest>
            {withGameSuspense(<LazyGamePage />)}
          </RequireOwnGuest>
        }
      />
      <Route
        path="/guest/:guestCode/arcana"
        element={
          <RequireOwnGuest>
            {withGameSuspense(<LazyArcanaWheelPage />)}
          </RequireOwnGuest>
        }
      />
      <Route
        path="/guest/:guestCode/olympus"
        element={
          <RequireOwnGuest>
            {withGameSuspense(<LazyOlympusCasinoPage />)}
          </RequireOwnGuest>
        }
      />
      <Route
        path="/guest/:guestCode/boi-bai"
        element={
          <RequireOwnGuest>
            {withGameSuspense(<LazyBoiBaiPage />)}
          </RequireOwnGuest>
        }
      />
      <Route path="/play" element={<GuestEntry />} />

      <Route path="/player" element={<LegacyRoleRedirect role="user" />} />
      <Route path="/admin" element={<LegacyRoleRedirect role="admin" />} />
      <Route
        path="/mainadmin"
        element={<LegacyRoleRedirect role="mainadmin" />}
      />
      <Route path="/eco" element={<LegacyRoleRedirect role="eco" />} />
      <Route path="/audit" element={<LegacyRoleRedirect role="audit" />} />
      <Route path="/sgift" element={<LegacyRoleRedirect role="sgift" />} />
      <Route path="/ring" element={<LegacyRoleRedirect role="ring" />} />
      <Route path="/pm" element={<LegacyRoleRedirect role="pm" />} />
      <Route path="/deal" element={<LegacyRoleRedirect role="deal" />} />
      <Route path="/tutien" element={<LegacyRoleRedirect role="tutien" />} />
      <Route path="/mod" element={<LegacyRoleRedirect role="mod" />} />
      <Route path="/dashboard" element={<LegacyRoleRedirect role="user" />} />

      <Route
        path="/"
        element={
          getToken() && getStoredUser() ? (
            <Navigate to={postAuthPath(getStoredUser()!)} replace />
          ) : (
            <Navigate to={AUTH_LOGIN} replace />
          )
        }
      />
      <Route path="*" element={<Navigate to={AUTH_LOGIN} replace />} />
    </Routes>
  );
}
