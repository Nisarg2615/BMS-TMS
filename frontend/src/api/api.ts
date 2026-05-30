import type { UserProfile, Task, NotificationItem, TaskComment, TaskHistoryItem } from "../types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:5000";

export async function apiFetch<T>(
  path: string,
  options: {
    method?: string;
    body?: any;
    idToken?: string | null;
    params?: Record<string, string | number | undefined | null>;
  } = {}
): Promise<T> {
  const url = new URL(API_BASE_URL + path);
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.idToken ? { Authorization: `Bearer ${options.idToken}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = json?.error || json?.message || text || `Request failed (${res.status})`;
    throw new Error(err);
  }
  return json as T;
}

export const api = {
  // Profile
  async getMe(idToken: string) {
    return apiFetch<UserProfile>("/api/me", { idToken });
  },

  async listUsers(idToken: string) {
    return apiFetch<{ users: Array<{ uid: string; name: string; email: string; department: string; role: string }> }>("/api/users", {
      idToken,
    });
  },

  // Tasks
  async listTasks(idToken: string, status?: string, department?: string) {
    return apiFetch<{ tasks: Task[] }>("/api/tasks", { idToken, params: { status, department } });
  },

  async createTask(idToken: string, task: {
    title: string;
    description: string;
    assigned_to: string;
    department: string;
    priority: string;
    due_date: string;
    status: string;
  }) {
    return apiFetch<{ task_id: string }>("/api/tasks", { method: "POST", idToken, body: task });
  },

  async updateTask(idToken: string, taskId: string, updates: Partial<{ status: string; assigned_to: string; due_date: string }>) {
    return apiFetch<{ ok: boolean }>("/api/tasks/" + taskId, { method: "PUT", idToken, body: updates });
  },

  async getTaskDetail(idToken: string, taskId: string) {
    return apiFetch<{ task: Task; comments: TaskComment[]; history: TaskHistoryItem[] }>("/api/tasks/" + taskId, { idToken });
  },

  async addComment(idToken: string, taskId: string, message: string) {
    return apiFetch<{ ok: boolean }>("/api/tasks/" + taskId + "/comments", { method: "POST", idToken, body: { message } });
  },

  // Notifications
  async listNotifications(idToken: string) {
    return apiFetch<{ notifications: NotificationItem[] }>("/api/notifications", { idToken });
  },

  async markNotificationRead(idToken: string, notifId: string) {
    return apiFetch<{ ok: boolean }>("/api/notifications/" + encodeURIComponent(notifId) + "/read", { method: "POST", idToken, body: {} });
  },

  // Admin
  async getAdminStats(idToken: string, department?: string) {
    return apiFetch<any>("/api/admin/stats", { idToken, params: { department } });
  },

  async runReminders(idToken: string) {
    return apiFetch<any>("/api/admin/reminders/run", { method: "POST", idToken });
  },

  // Admin / deletion
  async deleteTask(idToken: string, taskId: string) {
    return apiFetch<{ ok: boolean }>("/api/tasks/" + taskId, { method: "DELETE", idToken });
  },
};

