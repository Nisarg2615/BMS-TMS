import React, { useEffect, useState } from "react";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import Form from "react-bootstrap/Form";
import Table from "react-bootstrap/Table";
import Alert from "react-bootstrap/Alert";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Spinner from "react-bootstrap/Spinner";
import { useAuth } from "../auth/AuthProvider";
import { api } from "../api/api";
import type { ActivityLogItem, AdminStats } from "../types";

function MetricCard({ label, value, tint }: { label: string; value: string | number; tint: string }) {
  return (
    <Col xs={6} md={4}>
      <Card className="h-100 shadow-none border" style={{ background: tint }}>
        <Card.Body className="py-2 px-3">
          <div className="text-muted small fw-semibold">{label}</div>
          <div className="fw-bold fs-5">{value}</div>
        </Card.Body>
      </Card>
    </Col>
  );
}

export default function AdminStatsPanel({
  department,
  createdFrom,
  createdTo,
  onDateRangeChange,
}: {
  department?: string;
  createdFrom: string;
  createdTo: string;
  onDateRangeChange: (from: string, to: string) => void;
}) {
  const { getFreshToken } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [activity, setActivity] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderMsg, setReminderMsg] = useState<string | null>(null);
  const [localFrom, setLocalFrom] = useState(createdFrom);
  const [localTo, setLocalTo] = useState(createdTo);

  useEffect(() => {
    setLocalFrom(createdFrom);
    setLocalTo(createdTo);
  }, [createdFrom, createdTo]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const token = await getFreshToken();
      const params = {
        department,
        created_from: createdFrom || undefined,
        created_to: createdTo || undefined,
      };
      const [res, act] = await Promise.all([
        api.getAdminStats(token, params),
        api.getAdminActivity(token, 20),
      ]);
      setStats(res);
      setActivity(act.activity || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department, createdFrom, createdTo]);

  if (loading && !stats) {
    return (
      <div className="d-flex align-items-center gap-2 text-muted small mb-3">
        <Spinner animation="border" size="sm" />
        Loading stats...
      </div>
    );
  }
  if (error) return <Alert variant="danger" className="py-2 small mb-3">{error}</Alert>;
  if (!stats) return null;

  return (
    <Card className="mb-3 shadow-none border">
      <Card.Body>
        <Card.Title className="h6 mb-3">Admin Dashboard</Card.Title>

        <Row className="g-2 mb-2">
          <Col sm={6}>
            <Form.Group>
              <Form.Label className="small">Created From</Form.Label>
              <Form.Control type="date" size="sm" value={localFrom} onChange={(e) => setLocalFrom(e.target.value)} />
            </Form.Group>
          </Col>
          <Col sm={6}>
            <Form.Group>
              <Form.Label className="small">Created To</Form.Label>
              <Form.Control type="date" size="sm" value={localTo} onChange={(e) => setLocalTo(e.target.value)} />
            </Form.Group>
          </Col>
        </Row>
        <Button variant="outline-secondary" size="sm" className="mb-3" onClick={() => onDateRangeChange(localFrom, localTo)}>
          Apply Date Filter
        </Button>

        <Row className="g-2 mb-3">
          <MetricCard label="Total Tasks" value={stats.tasks_count ?? 0} tint="rgba(59,130,246,0.06)" />
          <MetricCard label="Open" value={stats.open ?? 0} tint="rgba(148,163,184,0.12)" />
          <MetricCard label="In Progress" value={stats.in_progress ?? 0} tint="rgba(59,130,246,0.10)" />
          <MetricCard label="Completed" value={stats.completed ?? 0} tint="rgba(34,197,94,0.08)" />
          <MetricCard label="On Hold / Review" value={stats.on_hold_review ?? 0} tint="rgba(234,179,8,0.10)" />
          <MetricCard label="Overdue" value={stats.overdue ?? 0} tint="rgba(239,68,68,0.08)" />
          <MetricCard label="Due Today" value={stats.due_today ?? 0} tint="rgba(249,115,22,0.08)" />
          <MetricCard label="Users (Total)" value={stats.users_total ?? 0} tint="rgba(59,130,246,0.06)" />
          <MetricCard label="Users (Active)" value={stats.users_active ?? 0} tint="rgba(34,197,94,0.08)" />
        </Row>

        <div className="d-flex gap-2 align-items-center flex-wrap mb-3">
          <Button
            variant="warning"
            size="sm"
            disabled={reminderBusy}
            onClick={async () => {
              setReminderBusy(true);
              setReminderMsg(null);
              try {
                const token = await getFreshToken();
                const res = await api.runReminders(token);
                setReminderMsg(`Reminders created: ${res?.created ?? 0}`);
                await refresh();
              } catch (e: any) {
                setReminderMsg(e?.message || "Failed to run reminders");
              } finally {
                setReminderBusy(false);
              }
            }}
          >
            {reminderBusy ? "Running..." : "Run Reminders Now"}
          </Button>
          {reminderMsg ? <span className="text-muted small fw-semibold">{reminderMsg}</span> : null}
        </div>

        <h6 className="small fw-semibold text-muted mb-2">Recent System Activity</h6>
        {activity.length === 0 ? (
          <p className="text-muted small mb-3">No activity yet.</p>
        ) : (
          <div className="table-responsive mb-3">
            <Table size="sm" hover className="mb-0">
              <thead className="table-light">
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Task</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((a) => (
                  <tr key={a.id}>
                    <td>{a.at ? a.at.slice(0, 16).replace("T", " ") : "—"}</td>
                    <td>{a.action}</td>
                    <td>{a.task_title || a.task_id}</td>
                    <td>{a.actor_name}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}

        <h6 className="small fw-semibold text-muted mb-2">Top Staff Productivity (Completed)</h6>
        {(stats.top_staff_productivity || []).length === 0 ? (
          <p className="text-muted small mb-0">No completed tasks yet.</p>
        ) : (
          <div>
            {(stats.top_staff_productivity || []).map((p) => (
              <div key={p.uid} className="historyItem mb-2">
                <div className="fw-semibold small">{p.uid}</div>
                <div className="text-muted small">Completed: {p.completed_tasks}</div>
              </div>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
