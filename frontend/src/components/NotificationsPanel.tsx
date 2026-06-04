import React, { useEffect, useState } from "react";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";
import { useAuth } from "../auth/AuthProvider";
import { api } from "../api/api";
import type { NotificationItem } from "../types";
import { IconBell, IconBarChart } from "./ui/StatIcons";

export default function NotificationsPanel({
  summary,
  refreshKey = 0,
}: {
  summary: {
    total: number;
    activeToday: number;
    completionRate: number;
  };
  /** Increment when tasks change so reminders refetch from the API */
  refreshKey?: number;
}) {
  const { getFreshToken } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function isTokenSkewError(err: unknown) {
    const msg = String((err as { message?: string })?.message || err || "");
    return msg.toLowerCase().includes("token used too early");
  }

  async function refresh(quiet = false) {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const token = await getFreshToken();
      const res = await api.listNotifications(token);
      setItems(res.notifications || []);
    } catch (e: unknown) {
      if (isTokenSkewError(e)) {
        setError(null);
      } else {
        setError((e as Error)?.message || "Failed to load notifications");
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  useEffect(() => {
    refresh(refreshKey > 0);
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="sidebarCard">
        <h3 className="sidebarCardTitle">
          <IconBell className="sidebarIconIndigo" size={16} />
          <span>Reminders</span>
        </h3>
        {error ? <Alert variant="danger" className="py-2 small">{error}</Alert> : null}
        {loading ? (
          <div className="d-flex align-items-center gap-2 text-muted small">
            <Spinner animation="border" size="sm" />
            Loading...
          </div>
        ) : null}
        {items.length === 0 && !loading ? (
          <p className="sidebarEmpty">No reminders right now.</p>
        ) : null}
        {items.map((n) => {
          const unread = !n.read_at;
          return (
            <div
              key={n.id}
              className={"notifItem " + (unread ? "notifUnread" : "")}
              style={{ cursor: unread ? "pointer" : "default" }}
              onClick={async () => {
                if (!unread) return;
                const token = await getFreshToken();
                await api.markNotificationRead(token, n.id);
                await refresh();
              }}
            >
              <div className="notifItemTop">
                <span className="notifItemLabel">{unread ? "New" : "Reminder"}</span>
                {n.created_at ? <span className="notifItemDate">{n.created_at.slice(0, 10)}</span> : null}
              </div>
              <div className="notifItemMessage">{n.message}</div>
            </div>
          );
        })}
      </div>

      <div className="sidebarCard">
        <h3 className="sidebarCardTitle">
          <IconBarChart className="sidebarIconIndigo" size={16} />
          <span>Summary</span>
        </h3>
        <div className="summaryRow">
          <span>Total tasks</span>
          <span>{summary.total}</span>
        </div>
        <div className="summaryRow">
          <span>Active today</span>
          <span>{summary.activeToday}</span>
        </div>
        <div className="summaryRow">
          <span>Completion rate</span>
          <span>{summary.completionRate}%</span>
        </div>
      </div>
    </div>
  );
}
