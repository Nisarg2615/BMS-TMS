import os
import json
from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Any, Dict, Optional, Tuple

from flask import Flask, jsonify, request, g
from flask_cors import CORS
import firebase_admin
from firebase_admin import auth as fb_auth
from firebase_admin import credentials, firestore


STATUS_COLUMNS = ["To Do", "In Progress", "Review", "Completed"]


def _load_env_file() -> None:
    """
    Local dev helper: load `backend/.env` into os.environ if present.
    In production, you should set env vars via the hosting platform.
    """
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if not os.path.exists(env_path):
        return
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for raw in f.readlines():
                line = raw.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" not in line:
                    continue
                key, val = line.split("=", 1)
                key = key.strip()
                val = val.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = val
    except Exception:
        # Don't block app startup if env loading fails.
        pass


_load_env_file()


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_iso_date(value: str) -> datetime:
    # Accepts date-only strings (YYYY-MM-DD) and full ISO strings.
    if not value:
        raise ValueError("due_date is required")
    try:
        # date-only -> assume local date in UTC midnight
        if len(value) == 10 and value[4] == "-" and value[7] == "-":
            dt = datetime.strptime(value, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            return dt
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception as e:
        raise ValueError(f"Invalid due_date: {value}") from e


def _dt_to_firestore_ts(dt: datetime) -> datetime:
    # firebase-admin uses datetime objects as timestamps.
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _dt_to_iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)

    # -------- Firebase Admin init --------
    # One of these env vars should be configured:
    # - FIREBASE_ADMIN_CREDENTIALS_PATH: path to service account json
    # - FIREBASE_ADMIN_CREDENTIALS_JSON: json string of service account
    # - GOOGLE_APPLICATION_CREDENTIALS: path to service account json
    if not firebase_admin._apps:
        cred_path = os.getenv("FIREBASE_ADMIN_CREDENTIALS_PATH")
        cred_json = os.getenv("FIREBASE_ADMIN_CREDENTIALS_JSON")
        if cred_json:
            cred = credentials.Certificate(json.loads(cred_json))
            firebase_admin.initialize_app(cred)
        else:
            # Fall back to default credentials (GOOGLE_APPLICATION_CREDENTIALS)
            if cred_path:
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred)
            else:
                try:
                    firebase_admin.initialize_app()
                except Exception as e:
                    raise RuntimeError(
                        "Firebase Admin is not configured. Set FIREBASE_ADMIN_CREDENTIALS_PATH or FIREBASE_ADMIN_CREDENTIALS_JSON."
                    ) from e

    return app


app = create_app()
db = firestore.client()


def _require_bearer_token() -> str:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise PermissionError("Missing/invalid Authorization header")
    token = auth[len("Bearer ") :].strip()
    if not token:
        raise PermissionError("Missing bearer token")
    return token


def _verify_user_from_token() -> Dict[str, Any]:
    token = _require_bearer_token()
    decoded = fb_auth.verify_id_token(token)
    return decoded


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            decoded = _verify_user_from_token()
            g.firebase_uid = decoded.get("uid")
            g.firebase_email = decoded.get("email")
            g.firebase_name = decoded.get("name") or ""
            g.firebase_picture = decoded.get("picture") or ""
            return fn(*args, **kwargs)
        except Exception as e:
            return jsonify({"error": str(e)}), 401

    return wrapper


def _user_doc(uid: str):
    return db.collection("users").document(uid)


def _get_or_create_user(uid: str, email: Optional[str], name: str) -> Dict[str, Any]:
    ref = _user_doc(uid)
    snap = ref.get()
    if snap.exists:
        return snap.to_dict() or {}

    # Default bootstrap: regular teacher
    user_data = {
        "email": email or "",
        "name": name or "",
        "role": "Teacher",
        "department": "General",
        "created_at": _utc_now(),
        "updated_at": _utc_now(),
    }
    ref.set(user_data, merge=True)
    return user_data


@app.get("/api/healthz")
def healthz():
    return jsonify({"ok": True})


@app.get("/api/me")
@require_auth
def me():
    uid = g.firebase_uid
    email = g.firebase_email
    name = g.firebase_name
    user_data = _get_or_create_user(uid, email, name)
    return jsonify(
        {
            "uid": uid,
            "email": email,
            "name": user_data.get("name") or name,
            "role": user_data.get("role") or "Teacher",
            "department": user_data.get("department") or "General",
        }
    )


@app.get("/api/users")
@require_auth
def list_users():
    # Admin only. Teachers should not be able to pick arbitrary staff.
    uid = g.firebase_uid
    user_snap = _user_doc(uid).get()
    user_data = user_snap.to_dict() if user_snap.exists else {}
    if (user_data.get("role") or "Teacher") != "Admin":
        return jsonify({"error": "Forbidden"}), 403

    users = []
    for snap in db.collection("users").where("role", "in", ["Teacher", "Staff"]).stream():
        data = snap.to_dict() or {}
        users.append({"uid": snap.id, "name": data.get("name", ""), "email": data.get("email", ""), "department": data.get("department", "General"), "role": data.get("role", "Teacher")})

    return jsonify({"users": users})


def _write_history(task_id: str, action: str, actor_uid: str, extra: Optional[Dict[str, Any]] = None):
    payload = {
        "task_id": task_id,
        "action": action,
        "actor_uid": actor_uid,
        "at": _utc_now(),
    }
    if extra:
        payload["extra"] = extra
    db.collection("tasks").document(task_id).collection("history").add(payload)


@app.get("/api/tasks")
@require_auth
def list_tasks():
    uid = g.firebase_uid
    user_snap = _user_doc(uid).get()
    user_data = user_snap.to_dict() if user_snap.exists else {}
    role = user_data.get("role") or "Teacher"
    department = user_data.get("department") or "General"

    status_filter = request.args.get("status")
    if role == "Admin":
        q = db.collection("tasks")
        dept = request.args.get("department")
        if dept:
            q = q.where("department", "==", dept)
    else:
        q = db.collection("tasks").where("assigned_to", "==", uid)
        # Teachers can only see tasks for their own department unless assigned_to matches.
        # Keeping it simple: assigned_to is already the primary filter.
        # Optionally tighten by department if you want:
        # q = q.where("department", "==", department)

    if status_filter and status_filter in STATUS_COLUMNS:
        q = q.where("status", "==", status_filter)

    tasks = []
    for snap in q.stream():
        data = snap.to_dict() or {}
        if data.get("is_system"):
            continue
        tasks.append(
            {
                "id": snap.id,
                "title": data.get("title", ""),
                "description": data.get("description", ""),
                "created_by": data.get("created_by", ""),
                "assigned_to": data.get("assigned_to", ""),
                "department": data.get("department", "General"),
                "priority": data.get("priority", "Medium"),
                "due_date": _dt_to_iso(data.get("due_date")),
                "status": data.get("status", "To Do"),
                "updated_at": _dt_to_iso(data.get("updated_at")),
            }
        )

    return jsonify({"tasks": tasks})


@app.post("/api/tasks")
@require_auth
def create_task():
    uid = g.firebase_uid
    payload = request.get_json(silent=True) or {}

    title = payload.get("title", "").strip()
    description = payload.get("description", "").strip()
    assigned_to = payload.get("assigned_to", "").strip()
    department = payload.get("department") or "General"
    priority = payload.get("priority") or "Medium"
    due_date_raw = payload.get("due_date")
    status = payload.get("status") or "To Do"

    if not title:
        return jsonify({"error": "title is required"}), 400
    if status not in STATUS_COLUMNS:
        return jsonify({"error": f"Invalid status. Must be one of {STATUS_COLUMNS}"}), 400
    if not assigned_to:
        return jsonify({"error": "assigned_to is required (staff uid)"}), 400

    try:
        due_date_dt = _parse_iso_date(due_date_raw)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    task_ref = db.collection("tasks").document()
    now = _utc_now()
    task_data = {
        "title": title,
        "description": description,
        "created_by": uid,
        "assigned_to": assigned_to,
        "department": department,
        "priority": priority,
        "due_date": _dt_to_firestore_ts(due_date_dt),
        "status": status,
        "created_at": now,
        "updated_at": now,
    }
    task_ref.set(task_data)
    _write_history(task_ref.id, "Task created", uid, extra={"status": status, "assigned_to": assigned_to})

    # In-app notification for the assignee.
    try:
        _create_notification_if_missing(
            assigned_to,
            f"task-{task_ref.id}",
            task_ref.id,
            "task_assigned",
            f"New task assigned: {title}",
        )
    except Exception:
        # Notifications should not block task creation.
        pass

    return jsonify({"task_id": task_ref.id}), 201


@app.get("/api/tasks/<task_id>")
@require_auth
def get_task(task_id: str):
    uid = g.firebase_uid
    snap = db.collection("tasks").document(task_id).get()
    if not snap.exists:
        return jsonify({"error": "Task not found"}), 404

    data = snap.to_dict() or {}
    if data.get("is_system"):
        return jsonify({"error": "Task not found"}), 404
    role = (_user_doc(uid).get().to_dict() or {}).get("role") or "Teacher"
    if role != "Admin" and data.get("assigned_to") != uid:
        return jsonify({"error": "Forbidden"}), 403

    comments = []
    for c in snap.reference.collection("comments").order_by("at").stream():
        cd = c.to_dict() or {}
        comments.append(
            {
                "id": c.id,
                "author_uid": cd.get("author_uid"),
                "author_name": cd.get("author_name", ""),
                "message": cd.get("message", ""),
                "at": _dt_to_iso(cd.get("at")),
            }
        )

    history = []
    for h in snap.reference.collection("history").order_by("at").stream():
        hd = h.to_dict() or {}
        history.append(
            {
                "id": h.id,
                "action": hd.get("action", ""),
                "actor_uid": hd.get("actor_uid", ""),
                "at": _dt_to_iso(hd.get("at")),
                "extra": hd.get("extra"),
            }
        )

    return jsonify(
        {
            "task": {
                "id": snap.id,
                **{k: v for k, v in data.items() if k not in {"due_date"}},
                "due_date": _dt_to_iso(data.get("due_date")),
            },
            "comments": comments,
            "history": history,
        }
    )


@app.put("/api/tasks/<task_id>")
@require_auth
def update_task(task_id: str):
    uid = g.firebase_uid
    snap = db.collection("tasks").document(task_id).get()
    if not snap.exists:
        return jsonify({"error": "Task not found"}), 404

    data = snap.to_dict() or {}
    role = (_user_doc(uid).get().to_dict() or {}).get("role") or "Teacher"
    if role != "Admin" and data.get("assigned_to") != uid:
        return jsonify({"error": "Forbidden"}), 403

    payload = request.get_json(silent=True) or {}
    updates: Dict[str, Any] = {}
    status_changed = False
    assigned_changed = False
    due_changed = False
    new_status: Optional[str] = None
    new_assigned_to: Optional[str] = None
    new_due_date_raw: Optional[str] = None

    if "status" in payload:
        new_status = payload.get("status")
        if new_status not in STATUS_COLUMNS:
            return jsonify({"error": f"Invalid status. Must be one of {STATUS_COLUMNS}"}), 400
        if new_status != data.get("status"):
            updates["status"] = new_status
            updates["updated_at"] = _utc_now()
            _write_history(task_id, "Status updated", uid, extra={"from": data.get("status"), "to": new_status})
            status_changed = True

    if "assigned_to" in payload:
        new_assigned = (payload.get("assigned_to") or "").strip()
        if not new_assigned:
            return jsonify({"error": "assigned_to cannot be empty"}), 400
        if new_assigned != data.get("assigned_to"):
            updates["assigned_to"] = new_assigned
            updates["updated_at"] = _utc_now()
            _write_history(task_id, "Reassigned", uid, extra={"from": data.get("assigned_to"), "to": new_assigned})
            assigned_changed = True
            new_assigned_to = new_assigned

    if "due_date" in payload:
        due_date_raw = payload.get("due_date")
        try:
            due_date_dt = _parse_iso_date(due_date_raw)
        except Exception as e:
            return jsonify({"error": str(e)}), 400
        updates["due_date"] = _dt_to_firestore_ts(due_date_dt)
        updates["updated_at"] = _utc_now()
        _write_history(task_id, "Due date updated", uid, extra={"due_date": due_date_raw})
        due_changed = True
        new_due_date_raw = due_date_raw

    if not updates:
        return jsonify({"error": "No valid updates provided"}), 400

    snap.reference.update(updates)

    # In-app notifications for important changes.
    # These are best-effort and should never block the main update.
    try:
        final_assignee = updates.get("assigned_to", data.get("assigned_to"))
        date_key = _utc_date_key()

        if status_changed and final_assignee and new_status:
            _create_notification_if_missing(
                str(final_assignee),
                f"status-{task_id}-{date_key}-{new_status}",
                task_id,
                "status_update",
                f"Task status updated to: {new_status}",
            )

        if assigned_changed and new_assigned_to:
            _create_notification_if_missing(
                str(new_assigned_to),
                f"reassigned-{task_id}-{date_key}",
                task_id,
                "reassigned",
                f"You have been assigned task: {data.get('title', 'Task')}",
            )

        if due_changed and final_assignee and new_due_date_raw:
            _create_notification_if_missing(
                str(final_assignee),
                f"due-{task_id}-{date_key}",
                task_id,
                "due_date_updated",
                f"Task due date updated. New due date: {str(new_due_date_raw)}",
            )
    except Exception:
        pass

    return jsonify({"ok": True})


def _delete_subcollection(doc_ref, subcollection_name: str) -> None:
    # Best-effort recursive delete for demo data.
    for snap in doc_ref.collection(subcollection_name).stream():
        snap.reference.delete()


@app.delete("/api/tasks/<task_id>")
@require_auth
def delete_task(task_id: str):
    uid = g.firebase_uid
    snap = db.collection("tasks").document(task_id).get()
    if not snap.exists:
        return jsonify({"error": "Task not found"}), 404

    data = snap.to_dict() or {}
    if data.get("is_system"):
        return jsonify({"error": "Forbidden"}), 403

    role = (_user_doc(uid).get().to_dict() or {}).get("role") or "Teacher"
    created_by = data.get("created_by")
    assigned_to = data.get("assigned_to")

    # Allow admin to delete anything; others can delete only if they created or are assignee.
    if role != "Admin" and created_by != uid and assigned_to != uid:
        return jsonify({"error": "Forbidden"}), 403

    # Delete subcollections first.
    _delete_subcollection(snap.reference, "comments")
    _delete_subcollection(snap.reference, "history")
    snap.reference.delete()

    return jsonify({"ok": True})


@app.post("/api/tasks/<task_id>/comments")
@require_auth
def add_comment(task_id: str):
    uid = g.firebase_uid
    payload = request.get_json(silent=True) or {}
    message = payload.get("message", "").strip()
    if not message:
        return jsonify({"error": "message is required"}), 400

    snap = db.collection("tasks").document(task_id).get()
    if not snap.exists:
        return jsonify({"error": "Task not found"}), 404
    data = snap.to_dict() or {}
    role = (_user_doc(uid).get().to_dict() or {}).get("role") or "Teacher"
    if role != "Admin" and data.get("assigned_to") != uid:
        return jsonify({"error": "Forbidden"}), 403

    author_snap = _user_doc(uid).get()
    author = author_snap.to_dict() if author_snap.exists else {}
    author_name = author.get("name", g.firebase_name or "")

    snap.reference.collection("comments").add(
        {
            "author_uid": uid,
            "author_name": author_name,
            "message": message,
            "at": _utc_now(),
        }
    )
    _write_history(task_id, "Comment added", uid, extra={"message_preview": message[:120]})
    return jsonify({"ok": True}), 201


def _notification_doc(user_id: str, notif_id: str):
    # Notifications are stored at top-level to make querying by user easy.
    return db.collection("notifications").document(f"{user_id}:{notif_id}")


def _utc_date_key(dt: Optional[datetime] = None) -> str:
    if dt is None:
        dt = _utc_now()
    return dt.astimezone(timezone.utc).strftime("%Y%m%d")


def _create_notification(user_id: str, notif_id: str, task_id: str, type_: str, message: str):
    ref = _notification_doc(user_id, notif_id)
    ref.set(
        {
            "user_id": user_id,
            "task_id": task_id,
            "type": type_,
            "message": message,
            "created_at": _utc_now(),
            "read_at": None,
        },
        merge=False,
    )


def _create_notification_if_missing(user_id: str, notif_id: str, task_id: str, type_: str, message: str) -> bool:
    ref = _notification_doc(user_id, notif_id)
    if ref.get().exists:
        return False
    _create_notification(user_id, notif_id, task_id, type_, message)
    return True


@app.get("/api/notifications")
@require_auth
def list_notifications():
    uid = g.firebase_uid
    limit = int(request.args.get("limit", "50"))
    limit = max(1, min(limit, 200))

    notifications = []
    # Demo-safe query:
    # Avoid `where(...).order_by(...)` because Firestore may require a composite index,
    # which causes errors during the demo.
    q = db.collection("notifications").where("user_id", "==", uid).limit(limit)
    tmp = []
    for snap in q.stream():
        nd = snap.to_dict() or {}
        tmp.append(
            {
                "id": snap.id,
                "task_id": nd.get("task_id"),
                "type": nd.get("type"),
                "message": nd.get("message"),
                "created_at": _dt_to_iso(nd.get("created_at")),
                "read_at": _dt_to_iso(nd.get("read_at")),
            }
        )

    # Sort client-side after retrieval.
    def _created_key(n: Dict[str, Any]):
        created = n.get("created_at")
        return created or ""

    notifications = sorted(tmp, key=_created_key, reverse=True)
    return jsonify({"notifications": notifications[:limit]})


@app.post("/api/notifications/<notif_id>/read")
@require_auth
def mark_notification_read(notif_id: str):
    uid = g.firebase_uid
    # `notif_id` is the full Firestore document id returned by `/api/notifications`.
    ref = db.collection("notifications").document(notif_id)
    snap = ref.get()
    if not snap.exists:
        return jsonify({"error": "Notification not found"}), 404
    data = snap.to_dict() or {}
    if data.get("user_id") != uid:
        return jsonify({"error": "Forbidden"}), 403

    if data.get("read_at"):
        return jsonify({"ok": True})

    ref.update({"read_at": _utc_now()})
    return jsonify({"ok": True})


@app.get("/api/admin/stats")
@require_auth
def admin_stats():
    uid = g.firebase_uid
    user_snap = _user_doc(uid).get()
    user_data = user_snap.to_dict() if user_snap.exists else {}
    role = user_data.get("role") or "Teacher"
    if role != "Admin":
        return jsonify({"error": "Forbidden"}), 403

    dept = request.args.get("department")

    # Define "today" window in UTC (you can switch to local time later).
    now = _utc_now()
    start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    end = start + timedelta(days=1)

    q = db.collection("tasks")
    if dept:
        q = q.where("department", "==", dept)

    all_tasks = list(q.stream())
    visible_tasks = []
    for s in all_tasks:
        d = s.to_dict() or {}
        if d.get("is_system"):
            continue
        visible_tasks.append(s)

    tasks_count = len(visible_tasks)

    due_today = 0
    completed = 0
    pending = 0

    # Per staff productivity
    completed_by_user: Dict[str, int] = {}
    assigned_in_dept = set()

    for s in visible_tasks:
        d = s.to_dict() or {}
        assigned_in_dept.add(d.get("assigned_to"))
        status = d.get("status") or "To Do"
        if status == "Completed":
            completed += 1
            completed_by_user[d.get("assigned_to")] = completed_by_user.get(d.get("assigned_to"), 0) + 1
        else:
            pending += 1
        dd = d.get("due_date")
        if isinstance(dd, datetime):
            if start <= dd < end:
                due_today += 1

    # Department breakdown
    dept_tasks = {}
    if dept:
        dept_tasks = {dept: tasks_count}
    else:
        # Aggregate with a simple scan for now (scale is small).
        for s in visible_tasks:
            d = s.to_dict() or {}
            dept_name = d.get("department") or "General"
            dept_tasks[dept_name] = dept_tasks.get(dept_name, 0) + 1

    productivity = [
        {"uid": u, "completed_tasks": c}
        for u, c in sorted(completed_by_user.items(), key=lambda x: x[1], reverse=True)
        if u
    ][:10]

    return jsonify(
        {
            "tasks_count": tasks_count,
            "due_today": due_today,
            "pending": pending,
            "completed": completed,
            "department_breakdown": dept_tasks,
            "top_staff_productivity": productivity,
        }
    )


@app.post("/api/admin/reminders/run")
@require_auth
def run_reminders_now():
    # Manual trigger endpoint for admin. Daily automation can be run via VPS cron.
    uid = g.firebase_uid
    user_snap = _user_doc(uid).get()
    user_data = user_snap.to_dict() if user_snap.exists else {}
    role = user_data.get("role") or "Teacher"
    if role != "Admin":
        return jsonify({"error": "Forbidden"}), 403

    try:
        from src.scheduler.reminders import run_daily_reminders

        created = run_daily_reminders(db=db)
        return jsonify({"ok": True, "created": created})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    # Dev only. For production use gunicorn.
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=True)

