from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import json
import os
from ..database import get_db
from ..models.user import User, TrackingGroup, TrackingItem
from ..models.price_data import PriceList, PriceEntry
from ..utils.auth import get_current_user
from ..utils.pdf_export import generate_pdf
from ..utils.excel_export import generate_excel

router = APIRouter(prefix="/api/reports", tags=["reports"])

class CompareRequest(BaseModel):
    group_id: int
    month_a_id: int  # Base month price_list id
    month_b_id: int  # New month price_list id

def run_comparison(db: Session, group: TrackingGroup, month_a_id: int, month_b_id: int):
    pl_a = db.query(PriceList).filter(PriceList.id == month_a_id).first()
    pl_b = db.query(PriceList).filter(PriceList.id == month_b_id).first()
    if not pl_a or not pl_b:
        raise HTTPException(status_code=404, detail="מחירון לא נמצא")
    
    items = db.query(TrackingItem).filter(TrackingItem.group_id == group.id).all()
    if not items:
        raise HTTPException(status_code=400, detail="הקבוצה ריקה")
    
    results = []
    for item in items:
        years = json.loads(item.years) if item.years else []
        entries_a = db.query(PriceEntry).filter(PriceEntry.price_list_id == month_a_id, PriceEntry.car_code == item.car_code).all()
        entries_b = db.query(PriceEntry).filter(PriceEntry.price_list_id == month_b_id, PriceEntry.car_code == item.car_code).all()
        
        for year in years:
            ea = next((e for e in entries_a if e.year == year), None)
            eb = next((e for e in entries_b if e.year == year), None)
            
            price_a = ea.price if ea and ea.price else 0
            price_b = eb.price if eb and eb.price else 0
            tax_a = ea.road_tax if ea and ea.road_tax else 0
            tax_b = eb.road_tax if eb and eb.road_tax else 0
            
            price_diff = price_b - price_a
            tax_diff = tax_b - tax_a
            pct_change = ((price_b - price_a) / price_a * 100) if price_a else 0
            
            diff_sign = "+" if price_diff > 0 else ""
            tax_diff_sign = "+" if tax_diff > 0 else ""
            
            results.append({
                "קוד יצחק לוי": item.car_code,
                "יצרן": ea.manufacturer if ea else (eb.manufacturer if eb else ""),
                "שנה": year,
                "דגם": ea.model_name if ea else (eb.model_name if eb else ""),
                f"מחירון [{pl_b.label}] (שינוי)": f"{price_b:,.0f} ({diff_sign}{price_diff:,.0f})" if price_b else "-",
                f"עליה לכביש [{pl_b.label}] (שינוי)": f"{tax_b:,.0f} ({tax_diff_sign}{tax_diff:,.0f})" if tax_b else "-",
                "שינוי באחוז": f"{pct_change:.2f}%",
                "_pct_raw": pct_change,
            })
    
    # Calculate average
    pct_values = [r["_pct_raw"] for r in results if r["_pct_raw"] != 0]
    avg_pct = sum(pct_values) / len(pct_values) if pct_values else 0
    
    # Clean internal fields
    for r in results:
        del r["_pct_raw"]
    
    return results, avg_pct, pl_a.label, pl_b.label

@router.post("/compare")
def compare(req: CompareRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    group = db.query(TrackingGroup).filter(TrackingGroup.id == req.group_id, TrackingGroup.user_id == current_user.id).first()
    if not group:
        raise HTTPException(status_code=404, detail="קבוצה לא נמצאה")
    
    results, avg_pct, label_a, label_b = run_comparison(db, group, req.month_a_id, req.month_b_id)
    title = f"השוואת מחירונים: {label_a} מול {label_b} — {group.name}"
    return {"title": title, "data": results, "average_change": round(avg_pct, 2)}

@router.post("/export/pdf")
def export_pdf(req: CompareRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    group = db.query(TrackingGroup).filter(TrackingGroup.id == req.group_id, TrackingGroup.user_id == current_user.id).first()
    if not group:
        raise HTTPException(status_code=404, detail="קבוצה לא נמצאה")
    results, avg_pct, label_a, label_b = run_comparison(db, group, req.month_a_id, req.month_b_id)
    title = f"השוואת מחירונים: {label_a} מול {label_b} — {group.name}"
    filename = f"report_{label_a}_{label_b}.pdf".replace(" ", "_").replace(":", "-")
    # Sanitize filename - ASCII only for compatibility
    import re as _re
    filename = _re.sub(r'[^\x00-\x7F]', '', filename)
    filename = _re.sub(r'[^a-zA-Z0-9\-_\.]', '_', filename)
    if not filename.endswith('.pdf') or filename == '.pdf':
        filename = 'report.pdf'
    filepath = generate_pdf(results, title, avg_pct, filename)
    return FileResponse(filepath, filename=filename, media_type="application/pdf")

@router.post("/export/excel")
def export_excel(req: CompareRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    group = db.query(TrackingGroup).filter(TrackingGroup.id == req.group_id, TrackingGroup.user_id == current_user.id).first()
    if not group:
        raise HTTPException(status_code=404, detail="קבוצה לא נמצאה")
    results, avg_pct, label_a, label_b = run_comparison(db, group, req.month_a_id, req.month_b_id)
    title = f"השוואת מחירונים: {label_a} מול {label_b}"
    filename = f"report_{label_a}_{label_b}.xlsx".replace(" ", "_").replace(":", "-")
    import re as _re
    filename = _re.sub(r'[^\x00-\x7F]', '', filename)
    filename = _re.sub(r'[^a-zA-Z0-9\-_\.]', '_', filename)
    if not filename.endswith('.xlsx') or filename == '.xlsx':
        filename = 'report.xlsx'
    filepath = generate_excel(results, title, avg_pct, filename)

    # Return as JSON with base64 data (bypasses corporate file-download filters)
    import base64
    with open(filepath, 'rb') as f:
        file_data = base64.b64encode(f.read()).decode('utf-8')
    os.remove(filepath)
    return {"filename": filename, "data": file_data, "type": "xlsx"}
