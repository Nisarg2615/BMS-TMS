import React from "react";
import Container from "react-bootstrap/Container";
import Card from "react-bootstrap/Card";
import Alert from "react-bootstrap/Alert";
import BrandMark from "./ui/BrandMark";

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="appShell min-vh-100 py-4">
          <Container style={{ maxWidth: 640 }}>
            <div className="d-flex align-items-center gap-2 mb-2">
              <BrandMark />
              <span className="fw-bold fs-5">
                BMS <span className="text-primary">TMS</span>
              </span>
            </div>
            <Card className="shadow-none border">
              <Card.Body>
                <Alert variant="danger" className="py-2">
                  <strong>Something went wrong</strong>
                  <div className="small mt-1">The app hit a runtime error while loading.</div>
                </Alert>
                <pre className="bg-danger-subtle border border-danger-subtle rounded p-3 small mb-0 overflow-auto text-danger">
                  {this.state.error.message}
                </pre>
              </Card.Body>
            </Card>
          </Container>
        </div>
      );
    }

    return this.props.children;
  }
}
