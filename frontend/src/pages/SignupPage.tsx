import React, { useState } from "react";
import Card from "react-bootstrap/Card";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Alert from "react-bootstrap/Alert";
import Container from "react-bootstrap/Container";
import { useAuth } from "../auth/AuthProvider";
import BrandMark from "../components/ui/BrandMark";

export default function SignupPage() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Container style={{ maxWidth: 560 }}>
      <div className="d-flex align-items-center gap-2 mb-2">
        <BrandMark />
        <span className="fw-bold fs-5">
          BMS <span className="text-primary">TMS</span>
        </span>
      </div>
      <p className="text-muted small mb-3">Create account. We will email a verification link.</p>

      <Card className="shadow-none border">
        <Card.Body>
          {error ? <Alert variant="danger" className="py-2 small">{error}</Alert> : null}
          {statusMsg ? <Alert variant="success" className="py-2 small">{statusMsg}</Alert> : null}

          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@school.com" />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
              />
            </Form.Group>

            <Button
              variant="primary"
              className="w-100"
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
            </Button>
          </Form>

          <p className="text-muted small mt-3 mb-0">
            After you click the verification link, log in using your email/password.
          </p>
        </Card.Body>
      </Card>
    </Container>
  );
}
