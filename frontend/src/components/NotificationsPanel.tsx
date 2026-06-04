import React, { useEffect, useState } from "react";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";
import { useAuth } from "../auth/AuthProvider";
import { api } from "../api/api";
import type { NotificationItem } from "../types";
import { IconBell, IconBarChart } from "../components/ui/StatIcons";

function isUnread(n: NotificationItem): boolean {
  return !n.read_at;
}

export default function NotificationsPanel({
  summary,
  refreshKey = 0,
}: {
  summary: {
    total: number;
    activeToday: number;
    completionRate: number;
  };
  refreshKey?: number;
}) {
  const { getFreshToken } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

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

  const unreadItems = items.filter(isUnread);

  async function markOneRead(notifId: string) {
    setMarkingId(notifId);
    setItems((prev) => prev.filter((n) => n.id !== notifId));
    try {
      const token = await getFreshToken();
      await api.markNotificationRead(token, notifId);
    } catch (e: unknown) {
      setError((e as Error)?.message || "Failed to mark as read");
      await refresh(true);
    } finally {
      setMarkingId(null);
    }
  }

  async function markAllRead() {
    if (unreadItems.length === 0) return;
    setMarkingAll(true);
    const ids = unreadItems.map((n) => n.id);
    setItems((prev) => prev.filter((n) => !ids.includes(n.id)));
    try {
      const token = await getFreshToken();
      await Promise.all(ids.map((id) => api.markNotificationRead(token, id)));
    } catch (e: unknown) {
      setError((e as Error)?.message || "Failed to mark all as read");
      await refresh(true);
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div>
      <div className="sidebarCard remindersCard">
        <div className="remindersCardHeader">
          <h3 className="sidebarCardTitle">
            <IconBell className="sidebarIconIndigo" size={16} />
            <span>Reminders</span>
            {unreadItems.length > 0 ? (
              <span className="remindersCount">{unreadItems.length}</span>
            ) : null}
          </h3>
          {unreadItems.length > 0 ? (
            <button
              type="button"
              className="remindersMarkAllBtn"
              disabled={markingAll}
              onClick={markAllRead}
            >
              {markingAll ? "..." : "Mark all read"}
            </button>
          ) : null}
        </div>
        {error ? <Alert variant="danger" className="py-2 small">{error}</Alert> : null}
        {loading ? (
          <div className="d-flex align-items-center gap-2 text-muted small">
            <Spinner animation="border" size="sm" />
            Loading...
          </div>
        ) : null}
        {!loading && unreadItems.length === 0 ? (
          <p className="sidebarEmpty">No reminders right now.</p>
        ) : null}
        {unreadItems.length > 0 ? (
          <div className="remindersScroll">
            {unreadItems.map((n) => (
              <div key={n.id} className="notifItem notifUnread">
                <div className="notifItemTop">
                  <span className="notifItemLabel">New</span>
                  {n.created_at ? <span className="notifItemDate">{n.created_at.slice(0, 10)}</span> : null}
                </div>
                <div className="notifItemMessage">{n.message}</div>
                <Button
                  variant="link"
                  size="sm"
                  className="notifMarkReadBtn px-0"
                  disabled={markingId === n.id}
                  onClick={() => markOneRead(n.id)}
                >
                  {markingId === n.id ? "..." : "Mark as read"}
                </Button>
              </div>
            ))}
          </div>
        ) : null}
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
