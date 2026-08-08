from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import List, Optional
import os
import json
import secrets
from ..database import get_db
from ..models.user import User, TrackingGroup, TrackingItem
from ..models.price_data import PriceList, PriceEntry
from ..utils.auth import hash_password, require_admin
from ..utils.csv_parser import parse_csv
from ..config import UPLOAD_DIR

router = APIRouter(prefix="/api/admin", tags=["admin"])

# ── User Management ──
class CreateUserRequest(BaseModel):
    email: EmailStr
    username: str

class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    is_active: bool
    force_password_change: bool
    is_admin: bool
    class Config:
        from_attributes = True

@router.get("/users", response_model=List[UserResponse])
def list_users(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return db.query(User).filter(User.is_admin == False).all()

@router.post("/users")
def create_user(req: CreateUserRequest, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    if db.query(User).filter((User.email == req.email) | (User.username == req.username)).first():
        raise HTTPException(status_code=400, detail="משתמש עם מייל או שם משתמש זה כבר קיים")
    otp = secrets.token_urlsafe(8)
    user = User(
        email=req.email,
        username=req.username,
        hashed_password=hash_password(otp),
        force_password_change=True,
        otp_code=hash_password(otp),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {**UserResponse.model_validate(user).model_dump(), "otp": otp}

@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="משתמש לא נמצא")
    db.delete(user)
    db.commit()
    return {"message": "משתמש נמחק"}

@router.post("/users/{user_id}/reset-password")
def admin_reset_password(user_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="משתמש לא נמצא")
    otp = secrets.token_urlsafe(8)
    user.hashed_password = hash_password(otp)
    user.otp_code = hash_password(otp)
    user.force_password_change = True
    db.commit()
    return {"message": "סיסמה אופסה", "new_otp": otp}

@router.post("/users/{user_id}/inject-defaults")
def inject_default_group(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Create a default group for a user. Copies items from the global default template if it exists."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="משתמש לא נמצא")
    existing = db.query(TrackingGroup).filter(
        TrackingGroup.user_id == user_id, TrackingGroup.is_default == True
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="כבר קיימת קבוצת ברירת מחדל")
    
    group = TrackingGroup(name="ברירת מחדל", user_id=user_id, is_default=True, is_visible=True)
    db.add(group)
    db.commit()
    db.refresh(group)
    
    # Copy items from the global default template if it exists
    template = db.query(TrackingGroup).filter(TrackingGroup.name == "__default_template__").first()
    if template:
        template_items = db.query(TrackingItem).filter(TrackingItem.group_id == template.id).all()
        for ti in template_items:
            db.add(TrackingItem(group_id=group.id, car_code=ti.car_code, years=ti.years))
        db.commit()
    
    return {"message": "קבוצת ברירת מחדל נוספה", "group_id": group.id}


class ToggleVisibilityRequest(BaseModel):
    is_visible: bool

@router.patch("/groups/{group_id}/visibility")
def toggle_group_visibility(
    group_id: int,
    req: ToggleVisibilityRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin toggles visibility of a group for a user."""
    group = db.query(TrackingGroup).filter(TrackingGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="קבוצה לא נמצאה")
    group.is_visible = req.is_visible
    db.commit()
    return {"message": f"נראות הקבוצה {'הופעלה' if req.is_visible else 'הוסתרה'}", "group_id": group.id, "is_visible": group.is_visible}


@router.delete("/groups/{group_id}")
def admin_delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin can delete any group (used for re-injecting defaults)."""
    group = db.query(TrackingGroup).filter(TrackingGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="קבוצה לא נמצאה")
    db.delete(group)
    db.commit()
    return {"message": "קבוצה נמחקה"}


@router.get("/default-groups")
def list_default_groups(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """List all users and whether they have a default group, with visibility status."""
    users = db.query(User).filter(User.is_admin == False).all()
    result = []
    for u in users:
        default_group = db.query(TrackingGroup).filter(
            TrackingGroup.user_id == u.id, TrackingGroup.is_default == True
        ).first()
        result.append({
            "user_id": u.id,
            "username": u.username,
            "email": u.email,
            "has_default_group": default_group is not None,
            "group_id": default_group.id if default_group else None,
            "is_visible": default_group.is_visible if default_group else False,
            "items_count": db.query(TrackingItem).filter(TrackingItem.group_id == default_group.id).count() if default_group else 0,
        })
    return result


class SetDefaultTemplateRequest(BaseModel):
    items: List[dict]  # [{car_code: "481", years: [2022,2023]}]

@router.post("/default-template")
def set_default_template(
    req: SetDefaultTemplateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Set the global default group template. When admin injects defaults for a user, items are copied from here."""
    # Find or create the template group
    template = db.query(TrackingGroup).filter(TrackingGroup.name == "__default_template__").first()
    if not template:
        template = TrackingGroup(name="__default_template__", user_id=admin.id, is_default=False, is_visible=False)
        db.add(template)
        db.commit()
        db.refresh(template)
    
    # Replace items
    db.query(TrackingItem).filter(TrackingItem.group_id == template.id).delete()
    for item in req.items:
        db.add(TrackingItem(group_id=template.id, car_code=item["car_code"], years=json.dumps(item.get("years", []))))
    db.commit()
    
    return {"message": "תבנית ברירת מחדל עודכנה", "items_count": len(req.items)}


@router.get("/default-template")
def get_default_template(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Get the current default group template items."""
    template = db.query(TrackingGroup).filter(TrackingGroup.name == "__default_template__").first()
    if not template:
        return {"items": [], "exists": False}
    items = db.query(TrackingItem).filter(TrackingItem.group_id == template.id).all()
    
    # Get model names from PriceEntry
    result_items = []
    for i in items:
        # Find model name from any price entry with this car_code
        pe = db.query(PriceEntry).filter(PriceEntry.car_code == i.car_code).first()
        model_name = pe.model_name if pe else ""
        result_items.append({
            "car_code": i.car_code,
            "years": json.loads(i.years),
            "model_name": model_name or "",
        })
    
    return {
        "exists": True,
        "items": result_items,
    }

# ── CSV Upload ──
@router.post("/upload-csv")
async def upload_csv(
    file: UploadFile = File(...),
    month: str = Form(...),
    year: int = Form(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="רק קבצי CSV מותרים")
    
    label = f"{month} {year}"
    existing = db.query(PriceList).filter(PriceList.label == label).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"מחירון {label} כבר קיים במערכת")
    
    # Save file
    safe_label = label.replace(" ", "_")
    filepath = os.path.join(UPLOAD_DIR, f"{safe_label}_{file.filename}")
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    
    # Parse CSV
    try:
        entries = parse_csv(filepath)
    except Exception as e:
        os.remove(filepath)
        raise HTTPException(status_code=400, detail=f"שגיאה בניתוח CSV: {str(e)}")
    
    # Store in DB
    price_list = PriceList(filename=file.filename, month=month, year=year, label=label)
    db.add(price_list)
    db.commit()
    db.refresh(price_list)
    
    for entry in entries:
        pe = PriceEntry(
            price_list_id=price_list.id,
            car_code=entry["car_code"],
            manufacturer=entry.get("manufacturer"),
            model_name=entry.get("model_name"),
            year=entry.get("year"),
            price=entry.get("price"),
            road_tax=entry.get("road_tax"),
            raw_data=entry.get("raw_data"),
        )
        db.add(pe)
    db.commit()
    
    return {"message": f"הועלו {len(entries)} רשומות עבור {label}", "price_list_id": price_list.id, "entries_count": len(entries)}

@router.get("/price-lists")
def list_price_lists(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    lists = db.query(PriceList).order_by(PriceList.year.desc(), PriceList.month.desc()).all()
    return [{"id": pl.id, "label": pl.label, "filename": pl.filename, "entries_count": db.query(PriceEntry).filter(PriceEntry.price_list_id == pl.id).count()} for pl in lists]

@router.delete("/price-lists/{list_id}")
def delete_price_list(list_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    pl = db.query(PriceList).filter(PriceList.id == list_id).first()
    if not pl:
        raise HTTPException(status_code=404, detail="מחירון לא נמצא")
    db.query(PriceEntry).filter(PriceEntry.price_list_id == list_id).delete()
    db.delete(pl)
    db.commit()
    return {"message": "מחירון נמחק"}
