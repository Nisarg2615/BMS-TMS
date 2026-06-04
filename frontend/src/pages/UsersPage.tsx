import React, { useEffect, useState } from "react";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import Form from "react-bootstrap/Form";
import Table from "react-bootstrap/Table";
import Alert from "react-bootstrap/Alert";
import Badge from "react-bootstrap/Badge";
import Spinner from "react-bootstrap/Spinner";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import type { StaffUser, UserProfile } from "../types";
import { api } from "../api/api";
import { useAuth } from "../auth/AuthProvider";

export default function UsersPage({ profile }: { profile: UserProfile }) {
  const { getFreshToken } = useAuth();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Teacher");
  const [department, setDepartment] = useState("General");

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const token = await getFreshToken();
      const res = await api.listAdminUsers(token);
      setUsers(res.users || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load employees");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setFormOpen(false);
    setEditId(null);
    setName("");
    setEmail("");
    setRole("Teacher");
    setDepartment("General");
  }

  function openEdit(u: StaffUser) {
    setFormOpen(true);
    setEditId(u.uid);
    setName(u.name);
    setEmail(u.email);
    setRole(u.role);
    setDepartment(u.department);
  }

  if (profile.role !== "Admin") {
    return <p className="text-muted">Admin access required.</p>;
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-end flex-wrap gap-2 mb-3">
        <div>
          <h2 className="h5 fw-semibold mb-1">Employee Management</h2>
          <p className="text-muted small mb-0">
            Pre-register staff before their first Google sign-in. Deactivated users cannot log in.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            resetForm();
            setFormOpen(true);
          }}
        >
          + Add Employee
        </Button>
      </div>

      {error ? <Alert variant="danger" className="py-2 small">{error}</Alert> : null}
      {loading ? (
        <div className="d-flex align-items-center gap-2 text-muted small mb-3">
          <Spinner animation="border" size="sm" />
          Loading employees...
        </div>
      ) : null}

      {formOpen ? (
        <Card className="mb-3 shadow-none border">
          <Card.Body>
            <Card.Title className="h6 mb-3">{editId ? "Edit Employee" : "Add Employee"}</Card.Title>
            <Row className="g-3 mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Name</Form.Label>
                  <Form.Control value={name} onChange={(e) => setName(e.target.value)} />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={!!editId}
                    placeholder="name@school.edu"
                  />
                </Form.Group>
              </Col>
            </Row>
            <Row className="g-3 mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Role</Form.Label>
                  <Form.Select value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="Teacher">Teacher</option>
                    <option value="Staff">Staff</option>
                    <option value="Admin">Admin</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Department</Form.Label>
                  <Form.Control value={department} onChange={(e) => setDepartment(e.target.value)} />
                </Form.Group>
              </Col>
            </Row>
            <div className="d-flex gap-2 justify-content-end">
              <Button variant="outline-secondary" size="sm" onClick={resetForm}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={async () => {
                  setError(null);
                  try {
                    const token = await getFreshToken();
                    if (editId) {
                      await api.updateAdminUser(token, editId, { name, role, department });
                    } else {
                      await api.createAdminUser(token, { email: email.trim(), name: name.trim(), role, department });
                    }
                    resetForm();
                    await refresh();
                  } catch (e: any) {
                    setError(e?.message || "Save failed");
                  }
                }}
              >
                Save
              </Button>
            </div>
          </Card.Body>
        </Card>
      ) : null}

      <Card className="shadow-none border">
        <div className="table-responsive">
          <Table hover className="mb-0 align-middle small">
            <thead className="table-light">
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Department</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.uid}>
                  <td>{u.name || "—"}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.department}</td>
                  <td>
                    {u.pending_signup ? (
                      <Badge bg="warning" text="dark">
                        Pending signup
                      </Badge>
                    ) : u.active ? (
                      <Badge bg="success">Active</Badge>
                    ) : (
                      <Badge bg="secondary">Inactive</Badge>
                    )}
                  </td>
                  <td>
                    <div className="d-flex gap-2 flex-wrap">
                      <Button variant="outline-secondary" size="sm" onClick={() => openEdit(u)}>
                        Edit
                      </Button>
                      {!u.pending_signup && u.uid !== profile.uid ? (
                        <Button
                          variant={u.active ? "outline-warning" : "outline-success"}
                          size="sm"
                          disabled={busyId === u.uid}
                          onClick={async () => {
                            setBusyId(u.uid);
                            try {
                              const token = await getFreshToken();
                              await api.updateAdminUser(token, u.uid, { active: !u.active });
                              await refresh();
                            } catch (e: any) {
                              setError(e?.message || "Update failed");
                            } finally {
                              setBusyId(null);
                            }
                          }}
                        >
                          {u.active ? "Deactivate" : "Reactivate"}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
