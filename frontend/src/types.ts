export type Priority = "Low" | "Medium" | "High";
export type TaskStatus = "To Do" | "In Progress" | "Review" | "Completed";

export type UserProfile = {
  uid: string;
  email: string;
  name: string;
  role: "Admin" | "Teacher" | "Staff" | string;
  department: string;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  created_by: string;
  assigned_to: string;
  department: string;
  priority: Priority | string;
  due_date: string | null;
  status: TaskStatus | string;
  updated_at: string | null;
};

export type TaskComment = {
  id: string;
  author_uid: string;
  author_name: string;
  message: string;
  at: string | null;
};

export type TaskHistoryItem = {
  id: string;
  action: string;
  actor_uid: string;
  at: string | null;
  extra?: any;
};

export type NotificationItem = {
  id: string;
  task_id: string;
  type: string;
  message: string;
  created_at: string | null;
  read_at: string | null;
};

