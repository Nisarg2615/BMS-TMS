import React, { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { api } from "../api/api";
import type { NotificationItem } from "../types";

export default function NotificationsPanel() {
  const { getFreshToken } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function isTokenSkewError(err: any) {
    const msg = String(err?.message || err || "");
    return msg.toLowerCase().includes("token used too early");
  }

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const token = await getFreshToken();
      const res = await api.listNotifications(token);
      setItems(res.notifications || []);
    } catch (e: any) {
      if (isTokenSkewError(e)) {
        setError(null);
      } else {
        setError(e?.message || "Failed to load notifications");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="sectionTitle">Reminders</div>
      {error ? <div style={{ color: "#b91c1c", fontWeight: 700 }}>{error}</div> : null}
      {loading ? <div className="muted">Loading...</div> : null}
      <div>
        {items.length === 0 ? <div className="muted">No reminders right now.</div> : null}
        {items.map((n) => {
          const unread = !n.read_at;
          return (
            <div
              key={n.id}
              className={"notifItem " + (unread ? "notifUnread" : "")}
              style={{ cursor: "pointer" }}
              onClick={async () => {
                if (!unread) return;
                const token = await getFreshToken();
                await api.markNotificationRead(token, n.id);
                await refresh();
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 900, fontSize: 13 }}>{unread ? "New" : "Reminder"}</div>
                {n.created_at ? <div className="muted" style={{ fontSize: 12 }}>{n.created_at.slice(0, 10)}</div> : null}
              </div>
              <div style={{ marginTop: 8 }}>{n.message}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

