import React, { useEffect, useState } from "react";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Alert from "react-bootstrap/Alert";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import type { Priority, TaskStatus, StaffUser } from "../types";
import { TASK_STATUSES } from "../utils/taskUtils";
import { formatUserOption } from "../utils/formatUser";

export default function TaskModal({
  open,
  onClose,
  onCreate,
  users,
  defaultAssignedTo,
  defaultDepartment,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: {
    title: string;
    description: string;
    assigned_to: string;
    department: string;
    priority: Priority;
    due_date?: string;
    status: TaskStatus;
  }) => Promise<void> | void;
  users: StaffUser[];
  defaultAssignedTo: string;
  defaultDepartment: string;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState(defaultAssignedTo);
  const [department, setDepartment] = useState(defaultDepartment);
  const [priority, setPriority] = useState<Priority>("Medium");
  const [dueDate, setDueDate] = useState<string>("");
  const [status, setStatus] = useState<TaskStatus>("Open");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setAssignedTo(defaultAssignedTo);
    setDepartment(defaultDepartment);
    setPriority("Medium");
    setDueDate("");
    setStatus("Open");
    setError(null);
    setBusy(false);
  }, [open, defaultAssignedTo, defaultDepartment]);

  return (
    <Modal show={open} onHide={onClose} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Create Task</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error ? <Alert variant="danger" className="py-2 small">{error}</Alert> : null}

        <Row className="g-3 mb-3">
          <Col md={6}>
            <Form.Group>
              <Form.Label>Task Title</Form.Label>
              <Form.Control
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Annual Day Schedule"
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label>Due Date (optional)</Form.Label>
              <Form.Control type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Form.Group>
          </Col>
        </Row>

        <Form.Group className="mb-3">
          <Form.Label>Task Details</Form.Label>
          <Form.Control as="textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Form.Group>

        <Row className="g-3 mb-3">
          <Col md={6}>
            <Form.Group>
              <Form.Label>Assigned To</Form.Label>
              <Form.Select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                {users.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {formatUserOption(u)}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label>Department</Form.Label>
              <Form.Control value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="General" />
            </Form.Group>
          </Col>
        </Row>

        <Row className="g-3">
          <Col md={6}>
            <Form.Group>
              <Form.Label>Priority</Form.Label>
              <Form.Select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label>Initial Status</Form.Label>
              <Form.Select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await onCreate({
                title: title.trim(),
                description: description.trim(),
                assigned_to: assignedTo,
                department: department.trim() || "General",
                priority,
                ...(dueDate ? { due_date: dueDate } : {}),
                status,
              });
              onClose();
            } catch (e: any) {
              setError(e?.message || "Failed to create task");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Creating..." : "Create"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
