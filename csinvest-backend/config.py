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
    """
    Singleton configuration holder. Loads .env once and exposes app settings.
    """

    def __init__(self) -> None:
        load_dotenv()

        self.CSFLOAT_API_KEY: str = os.getenv("CSFLOAT_API_KEY", "")

        self.SECRET_KEY: str = os.getenv("SECRET_KEY", "")
        if not self.SECRET_KEY:
            raise ValueError("SECRET_KEY is missing in environment (.env)")
        self.PASSWORD_SALT: str = os.getenv("PASSWORD_SALT", "csinvest_static_salt")
        self.ACCESS_TOKEN_EXPIRE_SECONDS: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_SECONDS", "3600"))


        self.DATABASE_URL: Optional[str] = os.getenv("DATABASE_URL")
        if not self.DATABASE_URL:
            raise ValueError("Chybí DATABASE_URL v souboru .env!")

        cors = os.getenv("CORS_ORIGINS") or "http://localhost:5173,http://127.0.0.1:5173"
        self.CORS_ORIGINS: List[str] = [o.strip() for o in cors.split(",") if o.strip()]
