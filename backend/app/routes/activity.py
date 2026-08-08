from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta, timezone
import json

from ..database import get_db
from ..models.user import User
from ..models.activity import ActivityLog
from ..utils.auth import get_current_user, require_admin

router = APIRouter(prefix="/api/activity", tags=["activity"])

class LogRequest(BaseModel):
    action: str
    details: Optional[dict] = None

# ── Log an activity (called by frontend) ──
@router.post("/log")
def log_activity(
    req: LogRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent", "")[:500]

    entry = ActivityLog(
        user_id=current_user.id,
        username=current_user.username,
        action=req.action,
        details=json.dumps(req.details, ensure_ascii=False) if req.details else None,
        ip_address=ip,
        user_agent=ua,
    )
    db.add(entry)
    db.commit()
    return {"ok": True}

# ── Admin: view all activity logs ──
@router.get("/logs")
def get_logs(
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    hours: int = 24,
    limit: int = 200,
    offset: int = 0,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    q = db.query(ActivityLog).filter(ActivityLog.created_at >= cutoff)

    if user_id:
        q = q.filter(ActivityLog.user_id == user_id)
    if action:
        q = q.filter(ActivityLog.action == action)

    total = q.count()
    logs = q.order_by(desc(ActivityLog.created_at)).offset(offset).limit(limit).all()

    return {
        "total": total,
        "logs": [
            {
                "id": l.id,
                "user_id": l.user_id,
                "username": l.username,
                "action": l.action,
                "details": json.loads(l.details) if l.details else None,
                "ip_address": l.ip_address,
                "created_at": l.created_at.isoformat() if l.created_at else None,
            }
            for l in logs
        ],
    }

# ── Admin: user activity summary ──
@router.get("/summary")
def activity_summary(
    hours: int = 24,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

    # Group by user + action
    rows = (
        db.query(
            ActivityLog.user_id,
            ActivityLog.username,
            ActivityLog.action,
            func.count().label("count"),
            func.max(ActivityLog.created_at).label("last_at"),
        )
        .filter(ActivityLog.created_at >= cutoff)
        .group_by(ActivityLog.user_id, ActivityLog.username, ActivityLog.action)
        .order_by(desc("last_at"))
        .all()
    )

    # Group by user
    users = {}
    for row in rows:
        uid = row.user_id
        if uid not in users:
            users[uid] = {
                "user_id": uid,
                "username": row.username,
                "actions": [],
                "last_active": None,
            }
        users[uid]["actions"].append({
            "action": row.action,
            "count": row.count,
            "last_at": row.last_at.isoformat() if row.last_at else None,
        })
        if not users[uid]["last_active"] or (row.last_at and row.last_at.isoformat() > users[uid]["last_active"]):
            users[uid]["last_active"] = row.last_at.isoformat() if row.last_at else None

    return {"users": list(users.values()), "hours": hours}

# ── Admin: online users (activity in last 5 min) ──
@router.get("/online")
def online_users(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=5)
    rows = (
        db.query(
            ActivityLog.user_id,
            ActivityLog.username,
            func.max(ActivityLog.created_at).label("last_active"),
        )
        .filter(ActivityLog.created_at >= cutoff)
        .group_by(ActivityLog.user_id, ActivityLog.username)
        .all()
    )
    return {
        "online": [
            {
                "user_id": r.user_id,
                "username": r.username,
                "last_active": r.last_active.isoformat() if r.last_active else None,
            }
            for r in rows
        ]
    }
