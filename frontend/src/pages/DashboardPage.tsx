import React, { useEffect, useMemo, useRef, useState } from "react";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";
import type { Task, UserProfile, StaffUser } from "../types";
import { api } from "../api/api";
import { useAuth } from "../auth/AuthProvider";
import KanbanBoard from "../components/KanbanBoard";
import TaskModal from "../components/TaskModal";
import TaskDetailModal from "../components/TaskDetailModal";
import NotificationsPanel from "../components/NotificationsPanel";
import AdminStatsPanel from "../components/AdminStatsPanel";
import { filterTasks, isTaskOverdue } from "../utils/taskUtils";
import { IconCalendar, IconClock, IconCheckCircle, IconAlertCircle } from "../components/ui/StatIcons";

type ViewMode = "board" | "my";

export default function DashboardPage({ profile }: { profile: UserProfile }) {
  const { getFreshToken } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tasksRef = useRef<Task[]>([]);

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [notifRefreshKey, setNotifRefreshKey] = useState(0);

  const isAdmin = profile.role === "Admin";

  function bumpNotifications() {
    setNotifRefreshKey((k) => k + 1);
  }

  const assignedTasks = useMemo(
    () => filterTasks(tasks, "assigned", profile.uid),
    [tasks, profile.uid]
  );
  const createdTasks = useMemo(
    () => filterTasks(tasks, "created", profile.uid),
    [tasks, profile.uid]
  );
  const myTasks = assignedTasks;
  const overdueCount = useMemo(() => tasks.filter((t) => isTaskOverdue(t)).length, [tasks]);

  const teacherSummary = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    let dueToday = 0;
    let pending = 0;
    let completed = 0;
    for (const t of tasks) {
      const status = String(t.status || "Open");
      if (status === "Completed") completed += 1;
      else pending += 1;
      if (t.due_date && t.due_date.slice(0, 10) === todayKey) dueToday += 1;
    }
    return { dueToday, pending, completed, overdue: overdueCount };
  }, [tasks, overdueCount]);

  const refreshTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getFreshToken();
      const res = await api.listTasks(token, {
        created_from: isAdmin && createdFrom ? createdFrom : undefined,
        created_to: isAdmin && createdTo ? createdTo : undefined,
      });
      setTasks(res.tasks || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createdFrom, createdTo]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    async function loadUsers() {
      try {
        const token = await getFreshToken();
        const res = await api.listUsers(token);
        setUsers(res.users || []);
      } catch {
        setUsers([]);
      }
    }
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function moveTask(taskId: string, newStatus: string) {
    let beforeSnapshot: Task[] | null = null;
    setTasks((prev) => {
      beforeSnapshot = prev;
      const moved = prev.find((t) => t.id === taskId);
      if (!moved) return prev;
      const rest = prev.filter((t) => t.id !== taskId);
      return [{ ...moved, status: newStatus }, ...rest];
    });

    try {
      const token = await getFreshToken();
      await api.updateTask(token, taskId, { status: newStatus });
      bumpNotifications();
    } catch (e: any) {
      setError(e?.message || "Failed to update task");
      if (beforeSnapshot) setTasks(beforeSnapshot);
    }
  }

  const boardTasks = viewMode === "my" && !isAdmin ? myTasks : tasks;

  const sidebarSummary = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => String(t.status) === "Completed").length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return {
      total,
      activeToday: teacherSummary.dueToday,
      completionRate,
    };
  }, [tasks, teacherSummary.dueToday]);

  const statCards = [
    { label: "Due Today", value: teacherSummary.dueToday, icon: <IconCalendar />, boxClass: "statIconIndigo" },
    { label: "Pending", value: teacherSummary.pending, icon: <IconClock />, boxClass: "statIconAmber" },
    { label: "Completed", value: teacherSummary.completed, icon: <IconCheckCircle />, boxClass: "statIconGreen" },
    { label: "Overdue", value: teacherSummary.overdue, icon: <IconAlertCircle />, boxClass: "statIconRed" },
  ];

  return (
    <div className="dashboardPage">
      <div className="dashboardHeader">
        <div>
          <h1 className="pageHeading">
            {isAdmin ? "All Tasks" : viewMode === "my" ? "My Tasks" : "Tasks"}
          </h1>
          <p className="pageSub">
            Drag tasks between columns. Double-click a card for details.
            {!isAdmin && overdueCount > 0 ? ` · ${overdueCount} overdue` : null}
          </p>
        </div>
        <div className="dashboardHeaderActions">
          {!isAdmin ? (
            <div className="tmsTabs">
              <button
                type="button"
                className={"tmsTab" + (viewMode === "board" ? " tmsTabActive" : "")}
                onClick={() => setViewMode("board")}
              >
                All Related
              </button>
              <button
                type="button"
                className={"tmsTab" + (viewMode === "my" ? " tmsTabActive" : "")}
                onClick={() => setViewMode("my")}
              >
                My Tasks
              </button>
            </div>
          ) : null}
          <button type="button" className="tmsBtnCreate" onClick={() => setTaskModalOpen(true)}>
            + Create
          </button>
        </div>
      </div>

      <div className="statsGrid">
        {statCards.map((s) => (
          <div key={s.label} className="statCard">
            <div className={"statIconBox " + s.boxClass}>{s.icon}</div>
            <div>
              <p className="statLabel">{s.label}</p>
              <p className="statValue">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid2">
        <div className="grid2Main">
          {error ? <Alert variant="danger" className="py-2 small mb-2">{error}</Alert> : null}
          {loading ? (
            <div className="d-flex align-items-center gap-2 text-muted small mb-2">
              <Spinner animation="border" size="sm" />
              Loading tasks...
            </div>
          ) : null}

          {!isAdmin && viewMode === "board" ? (
            <div className="boardStack">
              <div className="boardSection">
                <p className="sectionLabel">Assigned to Me</p>
                <KanbanBoard
                  tasks={assignedTasks}
                  onMoveTask={moveTask}
                  onOpenTask={(id) => setDetailTaskId(id)}
                />
              </div>
              <div className="boardSection">
                <p className="sectionLabel">Tasks I Created</p>
                <KanbanBoard
                  tasks={createdTasks}
                  onMoveTask={moveTask}
                  onOpenTask={(id) => setDetailTaskId(id)}
                />
              </div>
            </div>
          ) : (
            <KanbanBoard tasks={boardTasks} onMoveTask={moveTask} onOpenTask={(id) => setDetailTaskId(id)} />
          )}
        </div>

        <aside className="grid2Side">
          {isAdmin ? (
            <AdminStatsPanel
              department={undefined}
              createdFrom={createdFrom}
              createdTo={createdTo}
              onDateRangeChange={(from, to) => {
                setCreatedFrom(from);
                setCreatedTo(to);
              }}
            />
          ) : null}
          <NotificationsPanel summary={sidebarSummary} refreshKey={notifRefreshKey} />
        </aside>
      </div>

      <TaskModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        onCreate={async (payload) => {
          const token = await getFreshToken();
          await api.createTask(token, payload);
          await refreshTasks();
          bumpNotifications();
        }}
        users={users.length ? users : [{ uid: profile.uid, name: profile.name, email: profile.email, department: profile.department, role: profile.role, active: true }]}
        defaultAssignedTo={profile.uid}
        defaultDepartment={profile.department}
      />

      <TaskDetailModal
        open={!!detailTaskId}
        taskId={detailTaskId}
        onClose={() => setDetailTaskId(null)}
        onTaskUpdated={async () => {
          await refreshTasks();
          bumpNotifications();
        }}
        currentUserId={profile.uid}
        isAdmin={isAdmin}
        users={users.length ? users : [{ uid: profile.uid, name: profile.name, email: profile.email, department: profile.department, role: profile.role, active: true }]}
      />
    </div>
  );
}
