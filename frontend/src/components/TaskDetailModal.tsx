import React, { useEffect, useMemo, useState } from "react";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Alert from "react-bootstrap/Alert";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Badge from "react-bootstrap/Badge";
import type { Task, TaskComment, TaskHistoryItem, TaskStatus, StaffUser } from "../types";
import { api } from "../api/api";
import { useAuth } from "../auth/AuthProvider";
import { TASK_STATUSES, isTaskOverdue } from "../utils/taskUtils";
import { formatUserOption } from "../utils/formatUser";

export default function TaskDetailModal({
  open,
  taskId,
  onClose,
  onTaskUpdated,
  currentUserId,
  isAdmin,
  users,
}: {
  open: boolean;
  taskId: string | null;
  onClose: () => void;
  onTaskUpdated: () => Promise<void> | void;
  currentUserId: string;
  isAdmin: boolean;
  users: StaffUser[];
}) {
  const { getFreshToken } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [history, setHistory] = useState<TaskHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(true);

  const [newMessage, setNewMessage] = useState("");
  const [busyComment, setBusyComment] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);
  const [busyClose, setBusyClose] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !taskId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = await getFreshToken();
        const res = await api.getTaskDetail(token, taskId);
        if (cancelled) return;
        setTask(res.task);
        setComments(res.comments);
        setHistory(res.history);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load task");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [open, taskId, getFreshToken]);

  useEffect(() => {
    if (!open) {
      setTask(null);
      setComments([]);
      setHistory([]);
      setNewMessage("");
      setError(null);
      setDeleteError(null);
      setBusyDelete(false);
      setBusyClose(false);
    }
  }, [open]);

  const statusOptions: TaskStatus[] = useMemo(() => [...TASK_STATUSES], []);

  async function reloadTask() {
    if (!task) return;
    const token = await getFreshToken();
    const res = await api.getTaskDetail(token, task.id);
    setTask(res.task);
    setComments(res.comments);
    setHistory(res.history);
  }

  async function updateStatus(newStatus: TaskStatus) {
    if (!task) return;
    const token = await getFreshToken();
    await api.updateTask(token, task.id, { status: newStatus });
    await onTaskUpdated();
    await reloadTask();
  }

  async function updateAssignment(newAssignedTo: string) {
    if (!task) return;
    const token = await getFreshToken();
    await api.updateTask(token, task.id, { assigned_to: newAssignedTo });
    await onTaskUpdated();
    await reloadTask();
  }

  async function updateDueDate(newDueDate: string) {
    if (!task) return;
    const token = await getFreshToken();
    await api.updateTask(token, task.id, { due_date: newDueDate });
    await onTaskUpdated();
    await reloadTask();
  }

  const overdue = task ? isTaskOverdue(task) : false;
  const canReassign = Boolean(task && (isAdmin || task.created_by === currentUserId));
  const assignee = task ? users.find((u) => u.uid === task.assigned_to) : null;

  return (
    <Modal show={open && !!taskId} onHide={onClose} size="lg" centered scrollable>
      <Modal.Header closeButton>
        <div>
          <Modal.Title>Task Detail</Modal.Title>
          <div className="text-muted small">Press Esc or click outside to close.</div>
        </div>
      </Modal.Header>
      <Modal.Body>
        {error ? <Alert variant="danger" className="py-2 small">{error}</Alert> : null}
        {loading ? <div className="text-muted">Loading...</div> : null}
        {deleteError ? <Alert variant="danger" className="py-2 small">{deleteError}</Alert> : null}

        {task ? (
          <>
            <div className={"detailHeader" + (overdue ? " detailHeaderOverdue" : "")}>
              <Row className="g-3">
                <Col md={8}>
                  <Form.Label className="text-muted small mb-1">Title</Form.Label>
                  <div className="fw-bold">{task.title}</div>
                </Col>
                <Col md={4}>
                  <Form.Label className="text-muted small mb-1">Due</Form.Label>
                  <div className="fw-semibold">{task.due_date ? task.due_date.slice(0, 10) : "—"}</div>
                  {overdue ? <Badge bg="danger" className="mt-1">Overdue</Badge> : null}
                </Col>
              </Row>
            </div>

            <Form.Label className="text-muted small">Description</Form.Label>
            <p className="text-muted small lh-base">{task.description || "—"}</p>

            <Row className="g-3 mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Status</Form.Label>
                  <Form.Select value={String(task.status)} onChange={(e) => updateStatus(e.target.value as TaskStatus)}>
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Label className="text-muted small">Department</Form.Label>
                <div className="fw-semibold">{task.department}</div>
              </Col>
            </Row>

            <Row className="g-3 mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>{canReassign ? "Reassign To" : "Assigned To"}</Form.Label>
                  {canReassign ? (
                    <Form.Select value={String(task.assigned_to || "")} onChange={(e) => updateAssignment(e.target.value)}>
                      {users.map((u) => (
                        <option key={u.uid} value={u.uid}>
                          {formatUserOption(u)}
                        </option>
                      ))}
                    </Form.Select>
                  ) : (
                    <div className="fw-semibold">{assignee ? formatUserOption(assignee) : task.assigned_to || "—"}</div>
                  )}
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Update Due Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={task.due_date ? task.due_date.slice(0, 10) : ""}
                    onChange={(e) => updateDueDate(e.target.value)}
                  />
                </Form.Group>
              </Col>
            </Row>

            <h6 className="fw-semibold mb-2">Comments</h6>
            <div className="commentBox">
              {comments.length === 0 ? <div className="text-muted small">No comments yet.</div> : null}
              {comments.map((c) => (
                <div key={c.id} className="comment">
                  <div className="fw-semibold small">{c.author_name || c.author_uid}</div>
                  <div className="commentMsg">{c.message}</div>
                  {c.at ? <div className="text-muted small mt-1">{c.at.slice(0, 19).replace("T", " ")}</div> : null}
                </div>
              ))}

              <Form.Group className="mt-3">
                <Form.Label>Add a comment</Form.Label>
                <Form.Control as="textarea" rows={2} value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
              </Form.Group>
              <div className="d-flex justify-content-end mt-2">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={busyComment || !newMessage.trim()}
                  onClick={async () => {
                    setBusyComment(true);
                    try {
                      const token = await getFreshToken();
                      await api.addComment(token, task.id, newMessage.trim());
                      setNewMessage("");
                      await onTaskUpdated();
                      await reloadTask();
                    } finally {
                      setBusyComment(false);
                    }
                  }}
                >
                  {busyComment ? "Posting..." : "Post"}
                </Button>
              </div>
            </div>

            <div className="d-flex justify-content-between align-items-center mt-3 mb-2">
              <h6 className="fw-semibold mb-0">Activity History</h6>
              <Button variant="outline-secondary" size="sm" onClick={() => setHistoryOpen((v) => !v)}>
                {historyOpen ? "Collapse" : "Expand"}
              </Button>
            </div>
            {historyOpen ? (
              <div style={{ maxHeight: 240, overflow: "auto" }}>
                {history.length === 0 ? <div className="text-muted small">No history yet.</div> : null}
                {history
                  .slice()
                  .reverse()
                  .map((h) => (
                    <div key={h.id} className="historyItem">
                      <div className="fw-semibold small">{h.action}</div>
                      <div className="text-muted small mt-1">
                        {h.at ? h.at.slice(0, 19).replace("T", " ") : "—"} · {h.actor_name || h.actor_uid}
                      </div>
                    </div>
                  ))}
              </div>
            ) : null}
          </>
        ) : null}
      </Modal.Body>
      <Modal.Footer>
        {task && String(task.status) !== "Completed" ? (
          <Button
            variant="primary"
            disabled={busyClose}
            onClick={async () => {
              setBusyClose(true);
              try {
                await updateStatus("Completed");
              } finally {
                setBusyClose(false);
              }
            }}
          >
            {busyClose ? "Closing..." : "Close Task"}
          </Button>
        ) : null}
        {task && task.created_by === currentUserId ? (
          <Button
            variant="danger"
            disabled={busyDelete}
            onClick={async () => {
              if (!window.confirm("Delete this task? This cannot be undone.")) return;
              setBusyDelete(true);
              setDeleteError(null);
              try {
                const token = await getFreshToken();
                await api.deleteTask(token, task.id);
                await onTaskUpdated();
                onClose();
              } catch (e: any) {
                setDeleteError(e?.message || "Failed to delete task");
              } finally {
                setBusyDelete(false);
              }
            }}
          >
            {busyDelete ? "Deleting..." : "Delete"}
          </Button>
        ) : null}
        <Button variant="outline-secondary" onClick={onClose}>
          Back
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
