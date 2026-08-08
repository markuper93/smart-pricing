from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timedelta, timezone
import re
import secrets
from ..database import get_db
from ..models.user import User
from ..models.activity import ActivityLog
from ..utils.auth import hash_password, verify_password, create_access_token, get_current_user
from ..config import ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter(prefix="/api/auth", tags=["auth"])

# ── Password validation ──
def validate_password_strength(password: str) -> str:
    """Validate password meets minimum requirements. Returns error message or empty string."""
    if len(password) < 8:
        return "סיסמה חייבת להכיל לפחות 8 תווים"
    if not re.search(r'[A-Z]', password):
        return "סיסמה חייבת להכיל לפחות אות גדולה אחת"
    if not re.search(r'[a-z]', password):
        return "סיסמה חייבת להכיל לפחות אות קטנה אחת"
    if not re.search(r'[0-9]', password):
        return "סיסמה חייבת להכיל לפחות ספרה אחת"
    return ""

class LoginRequest(BaseModel):
    username: str
    password: str

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr  # Validates email format

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="שם משתמש או סיסמה שגויים")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="החשבון מושבת")
    # Always issue a token (even when password change is required)
    token = create_access_token({"sub": str(user.id)})
    # Log login
    db.add(ActivityLog(user_id=user.id, username=user.username, action="login", ip_address=None))
    db.commit()
    # Check OTP first login
    if user.force_password_change and user.otp_code:
        if verify_password(req.password, user.otp_code):
            return {
                "access_token": token,
                "token_type": "bearer",
                "requires_password_change": True,
                "user_id": user.id,
                "is_admin": user.is_admin,
                "username": user.username,
                "message": "נדרש לשנות סיסמה",
            }
    return {
        "access_token": token,
        "token_type": "bearer",
        "requires_password_change": user.force_password_change,
        "user_id": user.id,
        "is_admin": user.is_admin,
        "username": user.username,
    }

@router.post("/logout")
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.add(ActivityLog(user_id=current_user.id, username=current_user.username, action="logout"))
    db.commit()
    return {"message": "התנתקת בהצלחה"}

@router.post("/change-password")
def change_password(req: ChangePasswordRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(req.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="סיסמה נוכחית שגויה")
    error = validate_password_strength(req.new_password)
    if error:
        raise HTTPException(status_code=400, detail=error)
    current_user.hashed_password = hash_password(req.new_password)
    current_user.force_password_change = False
    current_user.otp_code = None
    db.commit()
    return {"message": "סיסמה שונתה בהצלחה"}

@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        # Generic message prevents user enumeration
        return {"message": "אם המייל קיים במערכת, נשלח קישור לאיפוס"}
    token = secrets.token_urlsafe(32)
    user.reset_token = hash_password(token)
    user.reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=1)
    db.commit()
    # TODO: Send email with token via SendGrid — NEVER return token in response
    print(f"[DEV] Password reset token for {user.email}: {token}")
    return {"message": "אם המייל קיים במערכת, נשלח קישור לאיפוס"}

@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    users = db.query(User).filter(User.reset_token_expires > datetime.now(timezone.utc)).all()
    user = None
    for u in users:
        if u.reset_token and verify_password(req.token, u.reset_token):
            user = u
            break
    if not user:
        raise HTTPException(status_code=400, detail="טוקן לא תקין או פג תוקף")
    error = validate_password_strength(req.new_password)
    if error:
        raise HTTPException(status_code=400, detail=error)
    user.hashed_password = hash_password(req.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    user.force_password_change = False
    db.commit()
    return {"message": "סיסמה אופסה בהצלחה"}

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "is_admin": current_user.is_admin,
        "force_password_change": current_user.force_password_change,
    }
