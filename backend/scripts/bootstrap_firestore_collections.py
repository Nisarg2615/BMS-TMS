"""
Bootstrap Firestore collections for the demo.

In Firestore, a "collection" appears in the console only after at least one document exists.
This script creates hidden system documents for:
- users
- tasks
- notifications

The backend filters out tasks with `is_system == True`, so these documents won't show up in the UI.
"""

import json
import os
from datetime import datetime, timedelta, timezone

import firebase_admin
from firebase_admin import credentials, firestore


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _load_env_file() -> None:
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
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
        pass


def _init_firebase_admin():
    if firebase_admin._apps:
        return

    _load_env_file()

    cred_json = os.getenv("FIREBASE_ADMIN_CREDENTIALS_JSON")
    cred_path = os.getenv("FIREBASE_ADMIN_CREDENTIALS_PATH")

    if cred_json:
        cred = credentials.Certificate(json.loads(cred_json))
        firebase_admin.initialize_app(cred)
        return

    if cred_path:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        return

    # Fall back: GOOGLE_APPLICATION_CREDENTIALS
    firebase_admin.initialize_app()


def main():
    _init_firebase_admin()
    db = firestore.client()

    now = _utc_now()
    tomorrow = (now + timedelta(days=1)).date()
    due_date = datetime(tomorrow.year, tomorrow.month, tomorrow.day, tzinfo=timezone.utc)

    created = []

    # users
    users_doc = db.collection("users").document("_system_bootstrap")
    if not users_doc.get().exists:
        users_doc.set(
            {
                "email": "",
                "name": "BMS TMS System",
                "role": "System",
                "department": "System",
                "is_system": True,
                "created_at": now,
                "updated_at": now,
            }
        )
        created.append("users/_system_bootstrap")

    # tasks (hidden)
    tasks_doc = db.collection("tasks").document("_system_bootstrap_task")
    if not tasks_doc.get().exists:
        tasks_doc.set(
            {
                "title": "System Task",
                "description": "Hidden bootstrap document",
                "created_by": "_system",
                "assigned_to": "",
                "department": "System",
                "priority": "Low",
                "due_date": due_date,
                "status": "To Do",
                "created_at": now,
                "updated_at": now,
                "is_system": True,
            }
        )
        created.append("tasks/_system_bootstrap_task")

    # notifications (hidden)
    notifications_doc = db.collection("notifications").document("_system_bootstrap_notification")
    if not notifications_doc.get().exists:
        notifications_doc.set(
            {
                "user_id": "__system__",
                "task_id": "_system_bootstrap_task",
                "type": "system",
                "message": "Hidden bootstrap notification",
                "created_at": now,
                "read_at": None,
                "is_system": True,
            }
        )
        created.append("notifications/_system_bootstrap_notification")

    print(f"Bootstrap complete. Created: {created}")


if __name__ == "__main__":
    main()

