import React, { useEffect, useState } from "react";
import { Routes, Route, useNavigate, NavLink } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import { api } from "./api/api";
import type { UserProfile } from "./types";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import DashboardPage from "./pages/DashboardPage";
import UsersPage from "./pages/UsersPage";
import { isTokenSkewError, withTokenSkewRetry } from "./utils/authErrors";

function TopBar({
  profile,
  onLogout,
}: {
  profile: UserProfile;
  onLogout: () => void;
}) {
  const isAdmin = profile.role === "Admin";
  return (
    <div className="topBar">
      <div className="brand">
        BMS <span>TMS</span>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <nav className="navLinks">
          <NavLink to="/" className={({ isActive }) => "navLink" + (isActive ? " navLinkActive" : "")} end>
            Dashboard
          </NavLink>
          {isAdmin ? (
            <NavLink to="/users" className={({ isActive }) => "navLink" + (isActive ? " navLinkActive" : "")}>
              Employees
            </NavLink>
          ) : null}
        </nav>
        <div className="pill">
          {profile.name} • {profile.role}
        </div>
        <button className="btn btnAccent" onClick={onLogout}>
          Logout
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const { firebaseUser, idToken, loading, getFreshToken, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (!firebaseUser) {
        setProfile(null);
        setBootError(null);
        setBooting(false);
        return;
      }
      setBooting(true);
      setBootError(null);
      try {
        const p = await withTokenSkewRetry(async () => {
          const token = await getFreshToken();
          return api.getMe(token);
        });
        if (!cancelled) setProfile(p);
      } catch (e: any) {
        const msg = e?.message || "Failed to load profile";
        if (!cancelled) {
          setProfile(null);
          if (!isTokenSkewError(e)) {
            setBootError(msg);
          } else {
            setBootError(
              "Sign-in is syncing. Wait a moment and try again, or sync your PC clock (Settings → Time & language)."
            );
          }
          if (msg.toLowerCase().includes("deactivated") || msg.toLowerCase().includes("domain")) {
            await logout();
          }
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, [firebaseUser]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || booting) {
    return (
      <div className="appShell">
        <div className="page">Loading...</div>
      </div>
    );
  }

  if (!firebaseUser || !profile) {
    return (
      <div className="appShell">
        {bootError ? (
          <div className="page" style={{ maxWidth: 520, margin: "0 auto", color: "#b91c1c", fontWeight: 700 }}>
            {bootError}
          </div>
        ) : null}
        <Routes>
          <Route path="/signup" element={<SignupPage />} />
          <Route path="*" element={<LoginPage />} />
        </Routes>
      </div>
    );
  }

  return (
    <div className="appShell">
      <TopBar profile={profile} onLogout={() => logout().then(() => navigate("/"))} />
      <div className="page">
        <Routes>
          <Route path="/" element={<DashboardPage profile={profile} />} />
          <Route path="/users" element={<UsersPage profile={profile} />} />
          <Route path="*" element={<DashboardPage profile={profile} />} />
        </Routes>
      </div>
    </div>
  );
}
