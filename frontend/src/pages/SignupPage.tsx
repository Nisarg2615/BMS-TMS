import React, { useState } from "react";
import { useAuth } from "../auth/AuthProvider";

export default function SignupPage() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="page" style={{ maxWidth: 560, margin: "0 auto" }}>
      <div className="brand" style={{ fontSize: 24, marginBottom: 6 }}>
        BMS <span>TMS</span>
      </div>
      <div className="muted" style={{ marginBottom: 16 }}>
        Create account. We will email a verification link.
      </div>

      <div style={{ border: "1px solid #e2e8f0", borderRadius: 18, padding: 16, background: "#fff" }}>
        {error ? (
          <div style={{ marginBottom: 12, color: "#b91c1c", fontWeight: 700 }}>{error}</div>
        ) : null}
        {statusMsg ? (
          <div style={{ marginBottom: 12, color: "#0f766e", fontWeight: 800 }}>{statusMsg}</div>
        ) : null}

        <div style={{ marginBottom: 12 }}>
          <div className="label">Email</div>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@school.com" />
        </div>

        <div style={{ marginBottom: 12 }}>
          <div className="label">Password</div>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password"
          />
        </div>

        <button
          className="btn btnPrimary"
          disabled={busy || !email.trim() || !password.trim()}
          onClick={async () => {
            setBusy(true);
            setError(null);
            setStatusMsg(null);
            try {
              await signUp(email.trim(), password);
              setStatusMsg("Verification email sent. Please check your inbox and verify.");
            } catch (e: any) {
              setError(e?.message || "Signup failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Creating..." : "Create & Send Verification"}
        </button>

        <div className="muted" style={{ marginTop: 12, fontSize: 12 }}>
          After you click the verification link, log in using your email/password.
        </div>
      </div>
    </div>
  );
}

