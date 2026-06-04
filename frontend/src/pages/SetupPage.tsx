import React from "react";
import Container from "react-bootstrap/Container";
import Card from "react-bootstrap/Card";
import BrandMark from "../components/ui/BrandMark";

export default function SetupPage() {
  return (
    <div className="appShell min-vh-100 py-4">
      <Container style={{ maxWidth: 640 }}>
        <div className="d-flex align-items-center gap-2 mb-2">
          <BrandMark />
          <span className="fw-bold fs-5">
            BMS <span className="text-primary">TMS</span>
          </span>
        </div>
        <p className="text-muted small mb-3">Firebase is not configured yet, so the app cannot load.</p>

        <Card className="shadow-none border">
          <Card.Body>
            <Card.Title className="h6">Create `frontend/.env`</Card.Title>
            <pre className="bg-light border rounded p-3 small mb-0 overflow-auto">{`VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_API_BASE_URL=http://localhost:5000`}</pre>

            <Card.Title className="h6 mt-4">Also start the backend</Card.Title>
            <pre className="bg-light border rounded p-3 small mb-0 overflow-auto">{`# backend/.env
FIREBASE_ADMIN_CREDENTIALS_PATH=C:\\path\\to\\service-account.json

# then run:
python backend/app.py`}</pre>

            <p className="text-muted small mt-3 mb-0">
              Get these values from the Firebase Console under Project settings. After saving `.env`, restart
              the frontend dev server.
            </p>
          </Card.Body>
        </Card>
      </Container>
    </div>
  );
}
