import React, { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { api } from "../api/api";

export default function AdminStatsPanel({ department }: { department?: string }) {
  const { getFreshToken } = useAuth();
  const [stats, setStats] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderMsg, setReminderMsg] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const token = await getFreshToken();
      const res = await api.getAdminStats(token, department);
      setStats(res);
    } catch (e: any) {
      const msg = String(e?.message || e || "");
      if (msg.toLowerCase().includes("token used too early")) {
        setError(null);
      } else {
        setError(e?.message || "Failed to load stats");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department]);

  if (loading) return <div className="muted">Loading stats...</div>;
  if (error) return <div style={{ color: "#b91c1c", fontWeight: 700 }}>{error}</div>;
  if (!stats) return null;

  const Metric = ({ label, value, tint }: { label: string; value: string | number; tint: string }) => (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: tint }}>
      <div className="muted" style={{ fontWeight: 800, fontSize: 12 }}>
        {label}
      </div>
      <div style={{ fontWeight: 900, fontSize: 22 }}>{value}</div>
    </div>
  );

  return (
    <div style={{ marginTop: 10 }}>
      <div className="sectionTitle">Admin Dashboard</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        <Metric label="Tasks" value={stats.tasks_count ?? 0} tint="rgba(59,130,246,0.06)" />
        <Metric label="Due Today" value={stats.due_today ?? 0} tint="rgba(249,115,22,0.08)" />
        <Metric label="Pending" value={stats.pending ?? 0} tint="rgba(234,179,8,0.10)" />
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          className="btn btnAccent"
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
        </button>
        {reminderMsg ? <div className="muted" style={{ fontWeight: 700 }}>{reminderMsg}</div> : null}
      </div>

      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
        <div>
          <div className="label">Top Staff Productivity (Completed)</div>
          {(stats.top_staff_productivity || []).length === 0 ? (
            <div className="muted">No completed tasks yet.</div>
          ) : (
            <div>
              {(stats.top_staff_productivity || []).map((p: any) => (
                <div key={p.uid} className="historyItem" style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 900 }}>{p.uid}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Completed: {p.completed_tasks}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

