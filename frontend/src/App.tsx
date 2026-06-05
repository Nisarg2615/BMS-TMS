import React, { useEffect, useState } from "react";
import { Routes, Route, useNavigate, NavLink } from "react-router-dom";
import Container from "react-bootstrap/Container";
import Navbar from "react-bootstrap/Navbar";
import Nav from "react-bootstrap/Nav";
import Button from "react-bootstrap/Button";
import Spinner from "react-bootstrap/Spinner";
import Alert from "react-bootstrap/Alert";
import { useAuth } from "./auth/AuthProvider";
import { api } from "./api/api";
import type { UserProfile } from "./types";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import DashboardPage from "./pages/DashboardPage";
import UsersPage from "./pages/UsersPage";
import { isTokenSkewError, withTokenSkewRetry } from "./utils/authErrors";
import { userInitials } from "./utils/avatar";
import BrandMark from "./components/ui/BrandMark";

function TopBar({
  profile,
  onLogout,
}: {
  profile: UserProfile;
  onLogout: () => void;
}) {
  const isAdmin = profile.role === "Admin";
  const initials = userInitials(profile.name, profile.email);

  return (
    <Navbar expand="md" className="navbar-tms py-2">
      <Container fluid className="px-3">
        <Navbar.Brand className="d-flex align-items-center gap-2 mb-0">
          <BrandMark />
          <span className="fw-bold text-dark">
            BMS <span className="text-primary">TMS</span>
          </span>
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="tms-nav" aria-label="Toggle navigation" />
        <Navbar.Collapse id="tms-nav">
          <div className="tms-navbar-menu">
            <Nav className="tms-navbar-links">
              <NavLink
                to="/"
                className={({ isActive }) => "nav-link nav-link-tms" + (isActive ? " active" : "")}
                end
              >
                Dashboard
              </NavLink>
              {isAdmin ? (
                <NavLink
                  to="/users"
                  className={({ isActive }) => "nav-link nav-link-tms" + (isActive ? " active" : "")}
                >
                  Employees
                </NavLink>
              ) : null}
            </Nav>
            <div className="tms-navbar-footer">
              <div className="userChip">
                <div className="userAvatar" title={profile.email}>
                  {initials}
                </div>
                <span className="userChipText">
                  {profile.name || profile.email} · {profile.role}
                </span>
              </div>
              <Button variant="outline-primary" size="sm" className="tms-logout-btn" onClick={onLogout}>
                Logout
              </Button>
            </div>
          </div>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default function App() {
  const { firebaseUser, idToken, loading, getFreshToken, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!firebaseUser) {
      setProfile(null);
      setBootError(null);
      setBooting(false);
      return;
    }

    let active = true;
    const uid = firebaseUser.uid;

    (async () => {
      setBooting(true);
      setBootError(null);
      try {
        const p = await withTokenSkewRetry(async () => {
          const token = await getFreshToken();
          return api.getMe(token);
        });
        if (active) setProfile(p);
      } catch (e: any) {
        if (!active) return;
        const msg = e?.message || "Failed to load profile";
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
      } finally {
        if (active) setBooting(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [firebaseUser?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || booting) {
    return (
      <div className="appShell d-flex align-items-center justify-content-center min-vh-100">
        <Spinner animation="border" variant="primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    );
  }

  if (!firebaseUser || !profile) {
    return (
      <div className="authPage">
        {bootError ? <Alert variant="danger" className="authBootError mb-3">{bootError}</Alert> : null}
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
      <Container fluid className="py-3 px-3">
        <Routes>
          <Route path="/" element={<DashboardPage profile={profile} />} />
          <Route path="/users" element={<UsersPage profile={profile} />} />
          <Route path="*" element={<DashboardPage profile={profile} />} />
        </Routes>
      </Container>
    </div>
  );
}
