from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import json
from ..database import get_db
from ..models.user import User, TrackingGroup, TrackingItem
from ..models.price_data import PriceList, PriceEntry
from ..utils.auth import get_current_user

router = APIRouter(prefix="/api/user", tags=["user"])

# ── Available Car Codes ──
@router.get("/car-codes")
def get_car_codes(
    search: str = "",
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get unique car codes with their manufacturer and model. Supports search and pagination."""
    from sqlalchemy import func, text
    
    # Use a subquery to get distinct car_code with first occurrence of manufacturer/model
    subq = (
        db.query(
            PriceEntry.car_code,
            func.min(PriceEntry.manufacturer).label("manufacturer"),
            func.min(PriceEntry.model_name).label("model_name"),
        )
        .group_by(PriceEntry.car_code)
    )
    
    if search:
        pattern = f"%{search}%"
        subq = subq.having(
            func.min(PriceEntry.car_code).like(pattern)
            | func.min(PriceEntry.manufacturer).like(pattern)
            | func.min(PriceEntry.model_name).like(pattern)
        )
    
    total = subq.count()
    rows = subq.offset(offset).limit(limit).all()
    
    return {
        "total": total,
        "items": [{"car_code": r[0], "manufacturer": r[1] or "", "model_name": r[2] or ""} for r in rows],
    }

@router.get("/car-codes/{car_code}/years")
def get_years_for_code(car_code: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from sqlalchemy import func
    years = (
        db.query(PriceEntry.year)
        .filter(PriceEntry.car_code == car_code, PriceEntry.year > 0)
        .distinct()
        .order_by(PriceEntry.year)
        .all()
    )
    return [y[0] for y in years]

# ── Tracking Groups ──
class CreateGroupRequest(BaseModel):
    name: str
    items: List[dict]  # [{car_code: "481", years: [2022,2023]}]

class UpdateGroupRequest(BaseModel):
    name: Optional[str] = None
    items: Optional[List[dict]] = None

@router.get("/groups")
def list_groups(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Non-admin users only see visible groups; admin sees all
    # Always filter out internal template groups (names starting with __)
    query = db.query(TrackingGroup).filter(
        TrackingGroup.user_id == current_user.id,
        TrackingGroup.name != '__default_template__',
    )
    if not current_user.is_admin:
        query = query.filter(TrackingGroup.is_visible == True)
    groups = query.all()
    result = []
    for g in groups:
        items = db.query(TrackingItem).filter(TrackingItem.group_id == g.id).all()
        result.append({
            "id": g.id,
            "name": g.name,
            "is_default": g.is_default,
            "is_visible": g.is_visible,
            "created_at": g.created_at.isoformat() if g.created_at else None,
            "items": [{"id": i.id, "car_code": i.car_code, "years": json.loads(i.years)} for i in items],
        })
    return result

@router.post("/groups")
def create_group(req: CreateGroupRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    group = TrackingGroup(name=req.name, user_id=current_user.id)
    db.add(group)
    db.commit()
    db.refresh(group)
    for item in req.items:
        ti = TrackingItem(group_id=group.id, car_code=item["car_code"], years=json.dumps(item.get("years", [])))
        db.add(ti)
    db.commit()
    return {"id": group.id, "name": group.name, "message": "קבוצה נוצרה בהצלחה"}

@router.put("/groups/{group_id}")
def update_group(group_id: int, req: UpdateGroupRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    group = db.query(TrackingGroup).filter(TrackingGroup.id == group_id, TrackingGroup.user_id == current_user.id).first()
    if not group:
        raise HTTPException(status_code=404, detail="קבוצה לא נמצאה")
    if req.name:
        group.name = req.name
    if req.items is not None:
        db.query(TrackingItem).filter(TrackingItem.group_id == group_id).delete()
        for item in req.items:
            ti = TrackingItem(group_id=group.id, car_code=item["car_code"], years=json.dumps(item.get("years", [])))
            db.add(ti)
    db.commit()
    return {"message": "קבוצה עודכנה"}

@router.delete("/groups/{group_id}")
def delete_group(group_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    group = db.query(TrackingGroup).filter(TrackingGroup.id == group_id, TrackingGroup.user_id == current_user.id).first()
    if not group:
        raise HTTPException(status_code=404, detail="קבוצה לא נמצאה")
    db.delete(group)
    db.commit()
    return {"message": "קבוצה נמחקה"}


# ── Add/Remove individual items from a group ──
class AddItemRequest(BaseModel):
    car_code: str
    years: List[int]

class RemoveItemRequest(BaseModel):
    car_code: str

@router.post("/groups/{group_id}/items")
def add_item_to_group(
    group_id: int,
    req: AddItemRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a single car code+years to an existing group (no need to rebuild)."""
    group = db.query(TrackingGroup).filter(TrackingGroup.id == group_id, TrackingGroup.user_id == current_user.id).first()
    if not group:
        raise HTTPException(status_code=404, detail="קבוצה לא נמצאה")
    # Check if already exists
    existing = db.query(TrackingItem).filter(TrackingItem.group_id == group_id, TrackingItem.car_code == req.car_code).first()
    if existing:
        # Update years
        existing.years = json.dumps(req.years)
        db.commit()
        return {"message": "שנתונים עודכנו", "car_code": req.car_code}
    ti = TrackingItem(group_id=group_id, car_code=req.car_code, years=json.dumps(req.years))
    db.add(ti)
    db.commit()
    return {"message": "רכב נוסף לקבוצה", "car_code": req.car_code}


@router.delete("/groups/{group_id}/items/{car_code}")
def remove_item_from_group(
    group_id: int,
    car_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a single car code from a group."""
    group = db.query(TrackingGroup).filter(TrackingGroup.id == group_id, TrackingGroup.user_id == current_user.id).first()
    if not group:
        raise HTTPException(status_code=404, detail="קבוצה לא נמצאה")
    item = db.query(TrackingItem).filter(TrackingItem.group_id == group_id, TrackingItem.car_code == car_code).first()
    if not item:
        raise HTTPException(status_code=404, detail="רכב לא נמצא בקבוצה")
    db.delete(item)
    db.commit()
    return {"message": "רכב הוסר מהקבוצה", "car_code": car_code}

# ── Available Price Lists (for comparison dropdowns) ──
MONTH_ORDER = {
    "ינואר": 1, "פברואר": 2, "מרץ": 3, "אפריל": 4,
    "מאי": 5, "יוני": 6, "יולי": 7, "אוגוסט": 8,
    "ספטמבר": 9, "אוקטובר": 10, "נובמבר": 11, "דצמבר": 12,
}

@router.get("/price-lists")
def get_available_price_lists(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lists = db.query(PriceList).all()
    # Sort chronologically: year ascending, then month by Hebrew calendar order
    lists.sort(key=lambda pl: (pl.year, MONTH_ORDER.get(pl.month, 0)), reverse=True)
    return [{"id": pl.id, "label": pl.label} for pl in lists]
