import { Navigate, Route, Routes } from "react-router-dom";
import { getStoredUser, getToken } from "./auth";
import LoginPage from "./pages/LoginPage";
import UserDashboard from "./pages/UserDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import GamePage from "./pages/GamePage";

function RequireAuth({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: "user" | "admin";
}) {
  const token = getToken();
  const user = getStoredUser();
  if (!token || !user) return <Navigate to="/login" replace />;
  if (role === "admin" && user.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <UserDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAuth role="admin">
            <AdminDashboard />
          </RequireAuth>
        }
      />
      <Route path="/play" element={<GamePage />} />
      <Route
        path="/"
        element={
          <Navigate
            to={
              getToken()
                ? getStoredUser()?.role === "admin"
                  ? "/admin"
                  : "/dashboard"
                : "/login"
            }
            replace
          />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
