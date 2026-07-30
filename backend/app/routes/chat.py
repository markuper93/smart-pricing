from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import json
import httpx
from ..database import get_db
from ..models.user import User
from ..models.price_data import PriceList, PriceEntry
from ..utils.auth import get_current_user
from ..config import OPENAI_API_KEY, OPENAI_BASE_URL, AI_MODEL

router = APIRouter(prefix="/api/chat", tags=["chat"])

SYSTEM_PROMPT = """אתה עוזר AI מומחה לניתוח מחירי רכב. אתה מחובר למאגר נתוני מחירונים של יצחק לוי.
תפקידך לענות על שאלות המשתמש לגבי מחירי רכב, שינויים במחירונים, והשוואות בין תקופות.
כללי חשוב:
1. ענה תמיד בעברית
2. אם המשתמש שואל על תקופה שלפני ינואר 2026, ענה: "לצערי יש לי מידע לגבי מה שאתה מחפש רק מינואר 2026, אשמח לעזור בתאריכים האלה."
3. חשב אחוזים ושינויים בצורה מדויקת
4. הצג מספרים עם פסיקים (למשל: 135,000)
5. אם אין לך מידע על דגם ספציפי, אמור זאת בבירור
"""

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[dict]] = []  # [{role: "user"/"assistant", content: "..."}]

def get_context_data(db: Session, user_message: str) -> str:
    """Fetch relevant data from DB based on user query."""
    # Get all price lists
    price_lists = db.query(PriceList).all()
    if not price_lists:
        return "אין עדיין נתוני מחירונים במערכת."
    
    context_parts = [f"מחירונים זמינים: {', '.join(pl.label for pl in price_lists)}"]
    
    # Try to find relevant entries based on keywords in the message
    # Simple keyword matching for car codes or manufacturer names
    all_entries = db.query(PriceEntry).limit(500).all()
    if all_entries:
        # Group by car_code
        code_data = {}
        for e in all_entries:
            if e.car_code not in code_data:
                code_data[e.car_code] = {"manufacturer": e.manufacturer, "model": e.model_name, "prices": []}
            code_data[e.car_code]["prices"].append({"year": e.year, "price": e.price, "road_tax": e.road_tax})
        
        # Check if user mentions any car code or manufacturer
        relevant = []
        for code, data in code_data.items():
            if code in user_message or (data["manufacturer"] and data["manufacturer"] in user_message) or (data["model"] and data["model"] in user_message):
                relevant.append(f"דגם {code} ({data['manufacturer']} {data['model']}): {json.dumps(data['prices'][:5], ensure_ascii=False)}")
        
        if relevant:
            context_parts.append("נתונים רלוונטיים:\n" + "\n".join(relevant[:10]))
    
    return "\n".join(context_parts)

@router.post("/message")
async def chat_message(req: ChatRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="שירות AI לא מוגדר. יש להגדיר OPENAI_API_KEY")
    
    context = get_context_data(db, req.message)
    
    messages = [{"role": "system", "content": SYSTEM_PROMPT + "\n\nנתוני מערכת:\n" + context}]
    for h in (req.history or [])[-10:]:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": req.message})
    
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{OPENAI_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"},
                json={"model": AI_MODEL, "messages": messages, "max_tokens": 1500, "temperature": 0.3},
            )
            resp.raise_for_status()
            data = resp.json()
            reply = data["choices"][0]["message"]["content"]
            return {"reply": reply}
    except httpx.HTTPStatusError:
        raise HTTPException(status_code=502, detail="שגיאת שירות AI")
    except Exception:
        raise HTTPException(status_code=500, detail="שגיאה בתקשורת עם שירות AI")
