import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Task, UserProfile, Priority, TaskStatus } from "../types";
import { api } from "../api/api";
import { useAuth } from "../auth/AuthProvider";
import KanbanBoard from "../components/KanbanBoard";
import TaskModal from "../components/TaskModal";
import TaskDetailModal from "../components/TaskDetailModal";
import NotificationsPanel from "../components/NotificationsPanel";
import AdminStatsPanel from "../components/AdminStatsPanel";

export default function DashboardPage({ profile }: { profile: UserProfile }) {
  const { getFreshToken } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tasksRef = useRef<Task[]>([]);

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  const [users, setUsers] = useState<Array<{ uid: string; name: string; department: string }> | null>(null);
  const isAdmin = profile.role === "Admin";

  function isTokenSkewError(err: any) {
    const msg = String(err?.message || err || "");
    return msg.toLowerCase().includes("token used too early");
  }

  const teacherSummary = useMemo(() => {
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10); // UTC date key

    let dueToday = 0;
    let pending = 0;
    let completed = 0;

    for (const t of tasks) {
      const status = String(t.status || "To Do");
      if (status === "Completed") completed += 1;
      else pending += 1;

      if (t.due_date && t.due_date.slice(0, 10) === todayKey) {
        dueToday += 1;
      }
    }

    return { dueToday, pending, completed };
  }, [tasks]);

  const refreshTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getFreshToken();
      const res = await api.listTasks(token);
      setTasks(res.tasks || []);
    } catch (e: any) {
      if (isTokenSkewError(e)) {
        // Suppress spammy token skew errors from the UI.
        setError(null);
      } else {
        setError(e?.message || "Failed to load tasks");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    async function loadUsers() {
      if (!isAdmin) return;
      const token = await getFreshToken();
      const res = await api.listUsers(token);
      setUsers((res.users || []).map((u) => ({ uid: u.uid, name: u.name, department: u.department })));
    }
    if (isAdmin) loadUsers().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  async function moveTask(taskId: string, newStatus: string) {
    // Optimistic UI: update immediately, then persist to backend.
    let beforeSnapshot: Task[] | null = null;
    setTasks((prev) => {
      beforeSnapshot = prev;
      const moved = prev.find((t) => t.id === taskId);
      if (!moved) return prev;

      const rest = prev.filter((t) => t.id !== taskId);
      return [{ ...moved, status: newStatus }, ...rest];
    });

    // Persist in background; retry on token skew so the UI doesn't require manual refresh.
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const token = await getFreshToken();
        await api.updateTask(token, taskId, { status: newStatus });
        return;
      } catch (e: any) {
        if (isTokenSkewError(e)) {
          setError(null);
          if (attempt < maxRetries) {
            await sleep(1200 * (attempt + 1));
            continue;
          }
          return;
        }

        setError(e?.message || "Failed to update task");
        if (beforeSnapshot) setTasks(beforeSnapshot);
        return;
      }
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
        <div>
          <div className="sectionTitle" style={{ marginTop: 0 }}>
            Tasks Kanban
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            Drag and drop tasks between columns. Double-click a card to open details.
          </div>
        </div>
        <button className="btn btnPrimary" onClick={() => setTaskModalOpen(true)}>
          + Create
        </button>
      </div>

      {!isAdmin ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "rgba(59,130,246,0.06)" }}>
            <div className="muted" style={{ fontWeight: 900, fontSize: 12 }}>
              Due Today
            </div>
            <div style={{ fontWeight: 1000, fontSize: 22 }}>{teacherSummary.dueToday}</div>
          </div>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "rgba(234,179,8,0.10)" }}>
            <div className="muted" style={{ fontWeight: 900, fontSize: 12 }}>
              Pending
            </div>
            <div style={{ fontWeight: 1000, fontSize: 22 }}>{teacherSummary.pending}</div>
          </div>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: "rgba(34,197,94,0.08)" }}>
            <div className="muted" style={{ fontWeight: 900, fontSize: 12 }}>
              Completed
            </div>
            <div style={{ fontWeight: 1000, fontSize: 22 }}>{teacherSummary.completed}</div>
          </div>
        </div>
      ) : null}

      <div className="grid2">
        <div>
          {error ? <div style={{ color: "#b91c1c", fontWeight: 800, marginBottom: 10 }}>{error}</div> : null}
          {loading ? <div className="muted">Loading tasks...</div> : null}
          <KanbanBoard
            tasks={tasks}
            onMoveTask={moveTask}
            onOpenTask={(id) => setDetailTaskId(id)}
          />
        </div>

        <div>
          {isAdmin ? <AdminStatsPanel department={undefined} /> : null}
          <div style={{ height: 10 }} />
          <NotificationsPanel />
        </div>
      </div>

      <TaskModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        onCreate={async (payload) => {
          const token = await getFreshToken();
          await api.createTask(token, payload);
          await refreshTasks();
        }}
        isAdmin={isAdmin}
        users={users}
        defaultAssignedTo={profile.uid}
      />

      <TaskDetailModal
        open={!!detailTaskId}
        taskId={detailTaskId}
        onClose={() => setDetailTaskId(null)}
        onTaskUpdated={refreshTasks}
        isAdmin={isAdmin}
        users={users}
      />
    </div>
  );
}

