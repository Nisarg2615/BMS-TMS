import React, { useEffect, useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import { api } from "./api/api";
import type { UserProfile } from "./types";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import DashboardPage from "./pages/DashboardPage";

function TopBar({
  profile,
  onLogout,
}: {
  profile: UserProfile;
  onLogout: () => void;
}) {
  return (
    <div className="topBar">
      <div className="brand">
        BMS <span>TMS</span>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
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
  const [booting, setBooting] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (!firebaseUser) {
        setProfile(null);
        setBooting(false);
        return;
      }
      setBooting(true);
      try {
        const token = idToken ?? (await getFreshToken());
        const p = await api.getMe(token);
        if (!cancelled) setProfile(p);
      } catch (e) {
        if (!cancelled) {
          setProfile(null);
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
          <Route path="*" element={<DashboardPage profile={profile} />} />
        </Routes>
      </div>
    </div>
  );
}

