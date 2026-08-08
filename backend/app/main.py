from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from collections import defaultdict
import time
import json
from .database import engine, Base, SessionLocal
from .models.user import User, TrackingGroup, TrackingItem
from .models.price_data import PriceList, PriceEntry
from .models.activity import ActivityLog
from .routes import auth, admin, user, reports, chat, activity
from .utils.auth import hash_password
from .config import (
    DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASS,
    CORS_ORIGINS, LOGIN_RATE_LIMIT, FORGOT_RATE_LIMIT, RATE_LIMIT_WINDOW,
)

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="מחירון חכם - Smart Price List", version="1.0.0")

# ── CORS ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Security Headers Middleware ──
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    # CSP — allow Vercel frontend + API calls
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: blob:; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    )
    return response

# ── Rate Limiting Middleware (in-memory, per-IP) ──
_rate_store: dict = defaultdict(list)  # ip -> [timestamps]

RATE_LIMITED_PATHS = {
    "/api/auth/login": LOGIN_RATE_LIMIT,
    "/api/auth/forgot-password": FORGOT_RATE_LIMIT,
}

@app.middleware("http")
async def rate_limit(request: Request, call_next):
    path = request.url.path
    if path in RATE_LIMITED_PATHS:
        client_ip = request.client.host if request.client else "unknown"
        key = f"{client_ip}:{path}"
        now = time.time()
        window = RATE_LIMIT_WINDOW
        max_requests = RATE_LIMITED_PATHS[path]

        # Clean old entries
        _rate_store[key] = [t for t in _rate_store[key] if now - t < window]

        if len(_rate_store[key]) >= max_requests:
            return JSONResponse(
                status_code=429,
                content={"detail": f"יותר מדי ניסיונות. נסה שוב בעוד {window // 60} דקות."},
            )
        _rate_store[key].append(now)

    return await call_next(request)

# ── Upload Size Limit Middleware ──
@app.middleware("http")
async def limit_upload_size(request: Request, call_next):
    if request.method == "POST" and "/upload" in request.url.path:
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > 10 * 1024 * 1024:  # 10MB
            return JSONResponse(
                status_code=413,
                content={"detail": "קובץ גדול מדי. מקסימום 10MB."},
            )
    return await call_next(request)

# Include routers
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(user.router)
app.include_router(reports.router)
app.include_router(chat.router)
app.include_router(activity.router)

@app.on_event("startup")
def seed_admin():
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.is_admin == True).first()
        if not existing:
            admin = User(
                email=DEFAULT_ADMIN_EMAIL,
                username=DEFAULT_ADMIN_USERNAME,
                hashed_password=hash_password(DEFAULT_ADMIN_PASS),
                is_admin=True,
                is_active=True,
            )
            db.add(admin)
            db.commit()
            print(f"[SEED] Admin created: {DEFAULT_ADMIN_USERNAME}")
    finally:
        db.close()

@app.get("/api/health")
def health():
    return {"status": "ok", "app": "מחירון חכם"}
