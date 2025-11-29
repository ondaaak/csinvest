import os
import hashlib
import datetime
from typing import Optional
from dotenv import load_dotenv
import json
import base64
import hmac
import hashlib
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
from models import User

load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY is missing in environment (.env)")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_SECONDS = 3600

SALT = os.getenv("PASSWORD_SALT", "csinvest_static_salt")
security = HTTPBearer()

def hash_password(password: str) -> str:
    # Simple salted SHA256 (replace with stronger hash in production)
    return hashlib.sha256(f"{SALT}:{password}".encode()).hexdigest()

def verify_password(password: str, password_hash: str) -> bool:
    return hash_password(password) == password_hash

def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')

def _b64url_decode(data: str) -> bytes:
    padding = '=' * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)

def create_access_token(subject: str, extra: Optional[dict] = None, expires_delta: int = ACCESS_TOKEN_EXPIRE_SECONDS) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {"sub": subject, "iat": int(datetime.datetime.utcnow().timestamp())}
    if extra:
        payload.update(extra)
    exp = int((datetime.datetime.utcnow() + datetime.timedelta(seconds=expires_delta)).timestamp())
    payload["exp"] = exp
    header_b64 = _b64url(json.dumps(header, separators=(',',':')).encode())
    payload_b64 = _b64url(json.dumps(payload, separators=(',',':')).encode())
    signing_input = f"{header_b64}.{payload_b64}".encode()
    signature = hmac.new(SECRET_KEY.encode(), signing_input, hashlib.sha256).digest()
    sig_b64 = _b64url(signature)
    return f"{header_b64}.{payload_b64}.{sig_b64}"

def decode_token(token: str) -> dict:
    try:
        header_b64, payload_b64, sig_b64 = token.split('.')
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid token format")
    signing_input = f"{header_b64}.{payload_b64}".encode()
    expected_sig = _b64url(hmac.new(SECRET_KEY.encode(), signing_input, hashlib.sha256).digest())
    if not hmac.compare_digest(expected_sig, sig_b64):
        raise HTTPException(status_code=401, detail="Invalid signature")
    try:
        payload_json = _b64url_decode(payload_b64)
        payload = json.loads(payload_json)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid payload")
    exp = payload.get("exp")
    if exp and int(datetime.datetime.utcnow().timestamp()) > int(exp):
        raise HTTPException(status_code=401, detail="Token expired")
    return payload

def get_current_user(db: Session = Depends(get_db), credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    token = credentials.credentials
    payload = decode_token(token)
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    try:
        user_id = int(sub)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid subject in token")
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
