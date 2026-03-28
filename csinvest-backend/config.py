import os
from typing import List, Optional
from dotenv import load_dotenv


class _Singleton(type):
    _instances = {}

    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            cls._instances[cls] = super(_Singleton, cls).__call__(*args, **kwargs)
        return cls._instances[cls]


class Config(metaclass=_Singleton):

    def __init__(self) -> None:
        load_dotenv()

        self.CSFLOAT_API_KEYS: List[str] = [k.strip() for k in os.getenv("CSFLOAT_API_KEY", "").split(',') if k.strip()]
        # Primary key for backward compatibility or simple access
        self.CSFLOAT_API_KEY: str = self.CSFLOAT_API_KEYS[0] if self.CSFLOAT_API_KEYS else ""
        
        self.CSFLOAT_ENCRYPTION_KEY: str = os.getenv("CSFLOAT_ENCRYPTION_KEY", "")
        self.CSFLOAT_ENCRYPTION_LEGACY_KEYS: List[str] = [
            key.strip()
            for key in os.getenv("CSFLOAT_ENCRYPTION_LEGACY_KEYS", "").split(',')
            if key.strip() and key.strip() != self.CSFLOAT_ENCRYPTION_KEY
        ]

        self.SECRET_KEY: str = os.getenv("SECRET_KEY", "")
        if not self.SECRET_KEY:
            raise ValueError("SECRET_KEY is missing in environment (.env)")
        self.PASSWORD_SALT: str = os.getenv("PASSWORD_SALT", "csinvest_static_salt")
        expire_raw = (os.getenv("ACCESS_TOKEN_EXPIRE_SECONDS", "3600") or "").strip()
        self.ACCESS_TOKEN_EXPIRE_SECONDS: int = int(expire_raw) if expire_raw else 0
        self.AUTH_COOKIE_NAME: str = (os.getenv("AUTH_COOKIE_NAME", "csinvest_access_token") or "csinvest_access_token").strip()
        self.AUTH_COOKIE_SECURE: bool = (os.getenv("AUTH_COOKIE_SECURE", "false") or "false").strip().lower() in {"1", "true", "yes", "on"}
        self.AUTH_COOKIE_SAMESITE: str = (os.getenv("AUTH_COOKIE_SAMESITE", "lax") or "lax").strip().lower()
        if self.AUTH_COOKIE_SAMESITE not in {"lax", "strict", "none"}:
            self.AUTH_COOKIE_SAMESITE = "lax"

        self.SMTP_HOST: str = (os.getenv("SMTP_HOST", "") or "").strip()
        smtp_port_raw = (os.getenv("SMTP_PORT", "465") or "465").strip()
        self.SMTP_PORT: int = int(smtp_port_raw) if smtp_port_raw.isdigit() else 465
        self.SMTP_USER: str = (os.getenv("SMTP_USER", "") or "").strip()
        self.SMTP_PASSWORD: str = (os.getenv("SMTP_PASSWORD", "") or "").strip()
        self.SMTP_FROM_EMAIL: str = (os.getenv("SMTP_FROM_EMAIL", "") or "").strip()
        self.SMTP_USE_TLS: bool = (os.getenv("SMTP_USE_TLS", "false") or "false").strip().lower() in {"1", "true", "yes", "on"}

        self.DATABASE_URL: Optional[str] = os.getenv("DATABASE_URL")
        if not self.DATABASE_URL:
            raise ValueError("Chybí DATABASE_URL v souboru .env!")

        cors = os.getenv("CORS_ORIGINS") or "http://localhost:5173,http://127.0.0.1:5173"
        self.CORS_ORIGINS: List[str] = [o.strip() for o in cors.split(",") if o.strip()]
