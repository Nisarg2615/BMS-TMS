import React, { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="page" style={{ maxWidth: 520, margin: "0 auto" }}>
      <div className="brand" style={{ fontSize: 24, marginBottom: 6 }}>
        BMS <span>TMS</span>
      </div>
      <div className="muted" style={{ marginBottom: 16 }}>
        Login using your school email.
      </div>

      <div style={{ border: "1px solid #e2e8f0", borderRadius: 18, padding: 16, background: "#fff" }}>
        <div style={{ marginBottom: 12 }}>
          <div className="label">Continue with</div>
          <button
            className="btn"
            style={{
              width: "100%",
              marginTop: 6,
              borderColor: "rgba(59,130,246,0.35)",
              background: "rgba(59,130,246,0.08)",
            }}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await signInWithGoogle();
              } catch (e: any) {
                setError(e?.message || "Google sign-in failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Opening Google..." : "Continue with Google"}
          </button>
        </div>

        <div style={{ height: 1, background: "#e2e8f0", margin: "14px 0" }} />

        <div style={{ marginBottom: 12 }}>
          <div className="label">Email / Password</div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div className="label">School Email</div>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@school.com" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div className="label">Password</div>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
          />
        </div>

        {error && (
          <div style={{ marginBottom: 12, color: "#b91c1c", fontWeight: 700 }}>
            {error}
          </div>
        )}

        <button
          className="btn btnPrimary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await signIn(email.trim(), password);
            } catch (e: any) {
              setError(e?.message || "Login failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Signing in..." : "Login"}
        </button>

        <div className="muted" style={{ marginTop: 12, fontSize: 12 }}>
          If you are a new teacher, ask admin to set your role/department in the system.
        </div>

        <div style={{ marginTop: 12, display: "flex", justifyContent: "center" }}>
          <button
            className="btn"
            style={{ borderColor: "rgba(249,115,22,0.30)", background: "rgba(249,115,22,0.06)", fontWeight: 800 }}
            disabled={busy}
            onClick={() => navigate("/signup")}
          >
            Create new account
          </button>
        </div>
      </div>
    </div>
  );
}

