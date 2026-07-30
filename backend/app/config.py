import os
import sys
from dotenv import load_dotenv

load_dotenv()

# ── Security: SECRET_KEY MUST be set via environment variable ──
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    # In production this is fatal; in local dev we generate one (but warn)
    if os.getenv("ENVIRONMENT") == "production":
        print("[FATAL] SECRET_KEY environment variable is not set! Exiting.")
        sys.exit(1)
    import secrets
    SECRET_KEY = secrets.token_hex(32)
    print("[WARNING] SECRET_KEY not set — using random key (tokens invalidate on restart)")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("TOKEN_EXPIRE_MINUTES", "480"))  # 8 hours default

# Database — supports both SQLite (local dev) and PostgreSQL (production)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./smart_pricing.db")
# Render provides postgres:// but SQLAlchemy 2.x needs postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Max upload size: 10MB
MAX_UPLOAD_SIZE_MB = int(os.getenv("MAX_UPLOAD_SIZE_MB", "10"))

# Admin seed credentials — MUST be set in production
DEFAULT_ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@smartpricing.co.il")
DEFAULT_ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
DEFAULT_ADMIN_PASS = os.getenv("ADMIN_PASS")
if not DEFAULT_ADMIN_PASS:
    if os.getenv("ENVIRONMENT") == "production":
        print("[FATAL] ADMIN_PASS environment variable is not set! Exiting.")
        sys.exit(1)
    DEFAULT_ADMIN_PASS = "ChangeMe123!"
    print("[WARNING] ADMIN_PASS not set — using default (CHANGE THIS!)")

# AI Chat
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
AI_MODEL = os.getenv("AI_MODEL", "gpt-4o-mini")

# CORS origins — comma-separated in env, defaults to localhost for dev
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")

# Rate limiting (requests per window)
LOGIN_RATE_LIMIT = int(os.getenv("LOGIN_RATE_LIMIT", "5"))       # 5 attempts
FORGOT_RATE_LIMIT = int(os.getenv("FORGOT_RATE_LIMIT", "3"))     # 3 requests
RATE_LIMIT_WINDOW = int(os.getenv("RATE_LIMIT_WINDOW", "300"))   # 5 minutes
