from fastapi import FastAPI, Depends, HTTPException, Query, Request, Response
from typing import List, Optional
from sqlalchemy.orm import Session
from database import get_db
from repository import ItemRepository
from service import PriceService
from strategy import CSFloatStrategy
from models import PortfolioHistory, User, Item, MarketPrice
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from auth import hash_password, verify_password, create_access_token, get_current_user
from config import Config
from sqlalchemy import func, text
from scheduler import start_scheduler
from encryption import encrypt_api_key
from mailer import send_password_reset_code
import datetime
import re
import hashlib
import secrets
from database import engine
from security import (
    FixedWindowRateLimiter,
    get_client_ip,
    is_valid_discord_webhook_url,
    is_valid_notification_time,
    sanitize_text,
)

app = FastAPI()

@app.on_event("startup")
def startup_event():
    _ensure_useritemhistory_columns()
    _ensure_user_password_reset_columns()
    start_scheduler()


def _ensure_useritemhistory_columns():
    expected_columns = {
        "sell_fee_pct": "NUMERIC(5, 2) NOT NULL DEFAULT 0",
        "withdraw_fee_pct": "NUMERIC(5, 2) NOT NULL DEFAULT 0",
        "final_price": "NUMERIC(10, 2) NOT NULL DEFAULT 0",
    }

    with engine.begin() as conn:
        dialect = conn.dialect.name
        existing = set()

        if dialect == "sqlite":
            rows = conn.execute(text("PRAGMA table_info('USERITEMHISTORY')")).fetchall()
            existing = {r[1] for r in rows}
        else:
            rows = conn.execute(
                text(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name = 'USERITEMHISTORY'
                    """
                )
            ).fetchall()
            existing = {r[0] for r in rows}

        for col_name, col_def in expected_columns.items():
            if col_name in existing:
                continue
            conn.execute(text(f"ALTER TABLE \"USERITEMHISTORY\" ADD COLUMN {col_name} {col_def}"))


def _ensure_user_password_reset_columns():
    expected_columns = {
        "password_reset_code_hash": "VARCHAR",
        "password_reset_expires_at": "TIMESTAMP",
        "password_reset_attempts": "INTEGER NOT NULL DEFAULT 0",
    }

    with engine.begin() as conn:
        dialect = conn.dialect.name
        existing = set()

        if dialect == "sqlite":
            rows = conn.execute(text("PRAGMA table_info('USER')")).fetchall()
            existing = {r[1] for r in rows}
        else:
            rows = conn.execute(
                text(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name = 'USER'
                    """
                )
            ).fetchall()
            existing = {r[0] for r in rows}

        for col_name, col_def in expected_columns.items():
            if col_name in existing:
                continue
            conn.execute(text(f"ALTER TABLE \"USER\" ADD COLUMN {col_name} {col_def}"))


cfg = Config()
origins = cfg.CORS_ORIGINS

AUTH_COOKIE_NAME = cfg.AUTH_COOKIE_NAME
AUTH_COOKIE_SECURE = cfg.AUTH_COOKIE_SECURE
AUTH_COOKIE_SAMESITE = cfg.AUTH_COOKIE_SAMESITE

auth_rate_limiter = FixedWindowRateLimiter()
login_fail_limiter = FixedWindowRateLimiter()
refresh_rate_limiter = FixedWindowRateLimiter()
search_rate_limiter = FixedWindowRateLimiter()

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ------------------------------------


def _set_auth_cookie(request: Request, response: Response, token: str) -> None:
    max_age = int(cfg.ACCESS_TOKEN_EXPIRE_SECONDS or 0)
    is_https_request = (request.url.scheme or '').lower() == 'https'
    secure_cookie = AUTH_COOKIE_SECURE and is_https_request
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=secure_cookie,
        samesite=AUTH_COOKIE_SAMESITE,
        max_age=max_age if max_age > 0 else None,
        path='/',
    )


def _clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(
        key=AUTH_COOKIE_NAME,
        path='/',
        secure=AUTH_COOKIE_SECURE,
        samesite=AUTH_COOKIE_SAMESITE,
    )


def _enforce_limit(limiter: FixedWindowRateLimiter, key: str, limit: int, window_seconds: int, detail: str) -> None:
    if not limiter.allow(key=key, limit=limit, window_seconds=window_seconds):
        raise HTTPException(status_code=429, detail=detail)


RESET_CODE_LEN = 9
RESET_CODE_TTL_MINUTES = 15
RESET_CODE_MAX_ATTEMPTS = 8
RESET_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"


def _hash_reset_code(email: str, code: str) -> str:
    normalized_email = (email or "").strip().lower()
    normalized_code = (code or "").strip().upper()
    payload = f"{normalized_email}:{normalized_code}:{cfg.SECRET_KEY}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _generate_reset_code(length: int = RESET_CODE_LEN) -> str:
    return "".join(secrets.choice(RESET_CODE_ALPHABET) for _ in range(length))

class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetVerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=5, max_length=32)


class PasswordResetCompleteRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=5, max_length=32)
    new_password: str = Field(min_length=8, max_length=128)
    confirm_password: str = Field(min_length=8, max_length=128)

class AuthUser(BaseModel):
    user_id: int
    username: str
    email: EmailStr
    discord_portfolio_webhook_url: str | None = None
    discord_portfolio_notification_time: str | None = None
    currency: str | None = None
    sell_fee_pct: float = 2
    withdraw_fee_pct: float = 2

def user_to_schema(u: User) -> AuthUser:
    return AuthUser(
        user_id=u.user_id, 
        username=u.username, 
        email=u.email,
        discord_portfolio_webhook_url=u.discord_portfolio_webhook_url,
        discord_portfolio_notification_time=u.discord_portfolio_notification_time,
        currency=u.currency or 'USD',
        sell_fee_pct=float(u.sell_fee_pct if u.sell_fee_pct is not None else 2),
        withdraw_fee_pct=float(u.withdraw_fee_pct if u.withdraw_fee_pct is not None else 2),
    )

@app.post("/auth/register")
def register(data: RegisterRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    client_ip = get_client_ip(request)
    _enforce_limit(auth_rate_limiter, f"register:ip:{client_ip}", limit=8, window_seconds=300, detail="Too many registration attempts")

    username = sanitize_text(data.username, 50)
    email = sanitize_text(data.email, 320)
    password = data.password

    if not username or not re.fullmatch(r"[A-Za-z0-9_.-]{3,50}", username):
        raise HTTPException(status_code=400, detail="Invalid username format")

    existing = db.query(User).filter((User.username == username) | (User.email == email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username nebo email již existuje")
    user = User(username=username, email=email, password_hash=hash_password(password), currency='USD')
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(str(user.user_id))
    _set_auth_cookie(request, response, token)
    return {"access_token": token, "token_type": "bearer", "user": user_to_schema(user)}

@app.post("/auth/login")
def login(data: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    client_ip = get_client_ip(request)
    username_for_limit = sanitize_text(data.username, 50) or "unknown"

    _enforce_limit(auth_rate_limiter, f"login:ip:{client_ip}", limit=30, window_seconds=60, detail="Too many login attempts")
    _enforce_limit(
        login_fail_limiter,
        f"login-fail:ip-user:{client_ip}:{username_for_limit.lower()}",
        limit=8,
        window_seconds=900,
        detail="Too many failed login attempts. Try again later.",
    )

    username = sanitize_text(data.username, 50)
    if not username:
        raise HTTPException(status_code=401, detail="Neplatné přihlašovací údaje")

    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(data.password, user.password_hash):
        login_fail_limiter.allow(
            key=f"login-fail:ip-user:{client_ip}:{username_for_limit.lower()}",
            limit=10_000,
            window_seconds=900,
        )
        raise HTTPException(status_code=401, detail="Neplatné přihlašovací údaje")

    login_fail_limiter.clear(f"login-fail:ip-user:{client_ip}:{username.lower()}")
    token = create_access_token(str(user.user_id))
    _set_auth_cookie(request, response, token)
    return {"access_token": token, "token_type": "bearer", "user": user_to_schema(user)}


@app.post("/auth/logout")
def logout(response: Response):
    _clear_auth_cookie(response)
    return {"message": "Logged out"}


@app.post("/auth/password-reset/request")
def request_password_reset(payload: PasswordResetRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = get_client_ip(request)
    _enforce_limit(auth_rate_limiter, f"pwd-reset-request:ip:{client_ip}", limit=8, window_seconds=300, detail="Too many reset requests")

    email = sanitize_text(payload.email, 320)
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="This email is not registered.")

    code = _generate_reset_code()
    user.password_reset_code_hash = _hash_reset_code(email, code)
    user.password_reset_expires_at = datetime.datetime.utcnow() + datetime.timedelta(minutes=RESET_CODE_TTL_MINUTES)
    user.password_reset_attempts = 0
    db.commit()

    send_password_reset_code(email, code, user.username)
    return {"message": "Reset has been sent."}


@app.post("/auth/password-reset/verify")
def verify_password_reset_code(payload: PasswordResetVerifyRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = get_client_ip(request)
    _enforce_limit(auth_rate_limiter, f"pwd-reset-verify:ip:{client_ip}", limit=25, window_seconds=300, detail="Too many verification attempts")

    email = sanitize_text(payload.email, 320)
    code = sanitize_text(payload.code, 32)
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid code")

    if not user.password_reset_code_hash or not user.password_reset_expires_at:
        raise HTTPException(status_code=400, detail="No active reset code")

    if datetime.datetime.utcnow() > user.password_reset_expires_at:
        user.password_reset_code_hash = None
        user.password_reset_expires_at = None
        user.password_reset_attempts = 0
        db.commit()
        raise HTTPException(status_code=400, detail="Reset code expired")

    if (user.password_reset_attempts or 0) >= RESET_CODE_MAX_ATTEMPTS:
        raise HTTPException(status_code=400, detail="Too many invalid attempts. Request a new code.")

    expected = user.password_reset_code_hash
    actual = _hash_reset_code(email, code)
    if actual != expected:
        user.password_reset_attempts = (user.password_reset_attempts or 0) + 1
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid code")

    return {"message": "Code verified"}


@app.post("/auth/password-reset/complete")
def complete_password_reset(payload: PasswordResetCompleteRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = get_client_ip(request)
    _enforce_limit(auth_rate_limiter, f"pwd-reset-complete:ip:{client_ip}", limit=12, window_seconds=300, detail="Too many reset attempts")

    email = sanitize_text(payload.email, 320)
    code = sanitize_text(payload.code, 32)
    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid reset request")

    if not user.password_reset_code_hash or not user.password_reset_expires_at:
        raise HTTPException(status_code=400, detail="No active reset code")

    if datetime.datetime.utcnow() > user.password_reset_expires_at:
        user.password_reset_code_hash = None
        user.password_reset_expires_at = None
        user.password_reset_attempts = 0
        db.commit()
        raise HTTPException(status_code=400, detail="Reset code expired")

    if _hash_reset_code(email, code) != user.password_reset_code_hash:
        user.password_reset_attempts = (user.password_reset_attempts or 0) + 1
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid code")

    user.password_hash = hash_password(payload.new_password)
    user.password_reset_code_hash = None
    user.password_reset_expires_at = None
    user.password_reset_attempts = 0
    db.commit()
    return {"message": "Password has been reset successfully"}

@app.get("/auth/me")
def auth_me(current: User = Depends(get_current_user)):
    return user_to_schema(current)

class UpdateUserRequest(BaseModel):
    discord_portfolio_webhook_url: str | None = Field(None, max_length=500)
    discord_portfolio_notification_time: str | None = Field(None, max_length=5)
    currency: str | None = Field(None, max_length=3)
    sell_fee_pct: float | None = Field(None, ge=0, le=100)
    withdraw_fee_pct: float | None = Field(None, ge=0, le=100)

class CreateUserItemHistoryRequest(BaseModel):
    item_id: int
    amount: int = Field(1, ge=1, le=1_000_000)
    buy_price: float = Field(..., ge=0, le=10_000_000)
    sell_price: float = Field(..., ge=0, le=10_000_000)
    sell_fee_pct: float | None = Field(None, ge=0, le=100)
    withdraw_fee_pct: float | None = Field(None, ge=0, le=100)
    final_price: float | None = None
    sold_date: datetime.date | None = None

class SellUserItemRequest(BaseModel):
    amount: int | None = Field(None, ge=1, le=1_000_000)
    sell_price: float | None = Field(None, ge=0, le=10_000_000)
    buy_price: float | None = Field(None, ge=0, le=10_000_000)
    sell_fee_pct: float | None = Field(None, ge=0, le=100)
    withdraw_fee_pct: float | None = Field(None, ge=0, le=100)
    final_price: float | None = None
    sold_date: datetime.date | None = None

class UpdateUserItemHistoryRequest(BaseModel):
    amount: int | None = Field(None, ge=1, le=1_000_000)
    buy_price: float | None = Field(None, ge=0, le=10_000_000)
    sell_price: float | None = Field(None, ge=0, le=10_000_000)
    sell_fee_pct: float | None = Field(None, ge=0, le=100)
    withdraw_fee_pct: float | None = Field(None, ge=0, le=100)
    final_price: float | None = None
    sold_date: datetime.date | None = None

@app.patch("/users/me")
def update_user_me(payload: UpdateUserRequest, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    update_data = payload.dict(exclude_unset=True)
    if 'discord_portfolio_webhook_url' in update_data:
        webhook = sanitize_text(update_data['discord_portfolio_webhook_url'], 500)
        if webhook:
            if not is_valid_discord_webhook_url(webhook):
                raise HTTPException(status_code=400, detail='Invalid Discord webhook URL')
            update_data['discord_portfolio_webhook_url'] = webhook
        else:
            update_data['discord_portfolio_webhook_url'] = None

    if 'discord_portfolio_notification_time' in update_data:
        notify_time = sanitize_text(update_data['discord_portfolio_notification_time'], 5)
        if notify_time and not is_valid_notification_time(notify_time):
            raise HTTPException(status_code=400, detail='Invalid notification time format (HH:MM expected)')
        update_data['discord_portfolio_notification_time'] = notify_time or None

    if 'currency' in update_data and update_data['currency'] is not None:
        allowed_currencies = {'USD', 'EUR', 'GBP', 'CZK', 'RUB'}
        normalized = str(update_data['currency']).upper()
        if normalized not in allowed_currencies:
            raise HTTPException(status_code=400, detail='Unsupported currency')
        update_data['currency'] = normalized

    for fee_key in ('sell_fee_pct', 'withdraw_fee_pct'):
        if fee_key in update_data and update_data[fee_key] is not None:
            fee_val = float(update_data[fee_key])
            if fee_val < 0 or fee_val > 100:
                raise HTTPException(status_code=400, detail=f'{fee_key} must be between 0 and 100')
            update_data[fee_key] = round(fee_val, 2)

    for key, value in update_data.items():
        setattr(current, key, value)
    db.commit()
    return user_to_schema(current)

class SearchResponseItem(BaseModel):
    item_id: int
    name: str
    item_type: str
    slug: str
    inspect: str | None = None
    def_index: int | None = None
    paint_index: int | None = None
    rarity_index: int | None = None
    quality: int | None = None
    rarity: str | None = None
    current_price: float | None = None
    case_id: int | None = None
    min_float: float | None = None
    max_float: float | None = None

def to_search_item(itm: Item) -> SearchResponseItem:
    return SearchResponseItem(
        item_id=itm.item_id, 
        name=itm.name, 
        item_type=itm.item_type, 
        slug=itm.slug,
        inspect=itm.inspect,
        def_index=itm.def_index,
        paint_index=itm.paint_index,
        rarity_index=itm.rarity_index,
        quality=itm.quality,
        rarity=itm.rarity,
        current_price=itm.current_price,
        case_id=itm.case_id,
        min_float=itm.min_float,
        max_float=itm.max_float,
    )

def _list_unique_items_by_type(item_type: str, q: str | None, db: Session, limit: int | None = None, offset: int = 0):
    repo = ItemRepository(db)
    safe_offset = max(0, offset)
    safe_limit = max(1, min(limit, 2000)) if limit is not None else None

    if q:
        fetch_limit = (safe_offset + safe_limit) if safe_limit is not None else 10_000_000
        items = [r for r in repo.search_items(q, limit=fetch_limit) if r.item_type == item_type]
    else:
        if safe_limit is None:
            items = repo.get_items(item_type=item_type, limit=10_000_000, offset=0)
        else:
            items = repo.get_items(item_type=item_type, limit=safe_limit, offset=safe_offset)

    seen = set()
    unique = []
    for item in items:
        if item.name not in seen:
            seen.add(item.name)
            unique.append(item)

    if q and safe_limit is not None:
        unique = unique[safe_offset:safe_offset + safe_limit]

    return [to_search_item(item) for item in unique]

@app.get("/search")
def search_items(
    request: Request,
    q: str = Query(..., min_length=1, max_length=120),
    limit: int = Query(10, ge=1, le=100),
    exclude_item_type: Optional[List[str]] = Query(None),
    db: Session = Depends(get_db),
):
    client_ip = get_client_ip(request)
    _enforce_limit(search_rate_limiter, f"search:ip:{client_ip}", limit=120, window_seconds=60, detail="Too many search requests")

    repo = ItemRepository(db)
    results = repo.search_items(q.strip(), limit=limit, exclude_types=exclude_item_type)
    return [to_search_item(r) for r in results]

# ----------- Knives & Gloves listing/search -----------
@app.get("/knives")
def list_knives(q: str | None = None, db: Session = Depends(get_db)):
    return _list_unique_items_by_type('knife', q, db)

@app.get("/gloves")
def list_gloves(q: str | None = None, db: Session = Depends(get_db)):
    return _list_unique_items_by_type('glove', q, db)

# ----------- Agents listing/search -----------
@app.get("/agents")
def list_agents(q: str | None = None, db: Session = Depends(get_db)):
    return _list_unique_items_by_type('agent', q, db)

@app.get("/weapons")
def list_weapons(
    q: str | None = None,
    limit: int | None = Query(None, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    return _list_unique_items_by_type('skin', q, db, limit=limit, offset=offset)

@app.get("/")
def read_root():
    return {"message": "Vítejte v CSInvest API "}

@app.get("/portfolio/{user_id}")
def get_portfolio(user_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if user_id != current.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    repo = ItemRepository(db)
    items = repo.get_user_items(user_id)
    if not items:
        return {"message": "Tento uživatel nemá žádné položky nebo neexistuje."}
    return items

@app.get("/useritemhistory")
def get_my_user_item_history(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    repo = ItemRepository(db)
    return repo.get_user_item_history(current.user_id)

@app.post("/useritemhistory")
def create_user_item_history(payload: CreateUserItemHistoryRequest, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    repo = ItemRepository(db)
    itm = db.query(Item).filter(Item.item_id == payload.item_id).first()
    if not itm:
        raise HTTPException(status_code=404, detail="Item nenalezen")

    amount = max(1, int(payload.amount or 1))
    sold_date = payload.sold_date or datetime.date.today()
    return repo.add_user_item_history(
        user_id=current.user_id,
        item_id=payload.item_id,
        amount=amount,
        buy_price=payload.buy_price,
        sell_price=payload.sell_price,
        sell_fee_pct=payload.sell_fee_pct,
        withdraw_fee_pct=payload.withdraw_fee_pct,
        final_price=payload.final_price,
        sold_date=sold_date,
    )

@app.post("/useritems/{user_item_id}/sell")
def sell_user_item(user_item_id: int, payload: SellUserItemRequest, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    repo = ItemRepository(db)
    try:
        moved = repo.move_user_item_to_history(
            user_item_id=user_item_id,
            user_id=current.user_id,
            amount=payload.amount,
            sell_price=payload.sell_price,
            buy_price=payload.buy_price,
            sell_fee_pct=payload.sell_fee_pct,
            withdraw_fee_pct=payload.withdraw_fee_pct,
            final_price=payload.final_price,
            sold_date=payload.sold_date,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not moved:
        raise HTTPException(status_code=404, detail="User item nenalezen")
    return moved

@app.patch("/useritemhistory/{user_item_history_id}")
def update_user_item_history(user_item_history_id: int, payload: UpdateUserItemHistoryRequest, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    repo = ItemRepository(db)
    updated = repo.update_user_item_history(
        user_item_history_id=user_item_history_id,
        user_id=current.user_id,
        **payload.model_dump(exclude_unset=True)
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Sold item nenalezen")
    return updated

@app.delete("/useritemhistory/{user_item_history_id}", status_code=204)
def delete_user_item_history(user_item_history_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    repo = ItemRepository(db)
    ok = repo.delete_user_item_history(user_item_history_id, current.user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Sold item nenalezen")
    return

@app.get("/items")
def get_items(item_type: str = None, limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db)):
    repo = ItemRepository(db)
    return repo.get_items(item_type=item_type, limit=limit)

class CreateUserItemRequest(BaseModel):
    item_id: int
    amount: int = Field(1, ge=1, le=1_000_000)
    buy_price: float = Field(..., ge=0, le=10_000_000)
    float_value: float | None = Field(None, ge=0, le=1)
    pattern: int | None = Field(None, ge=0, le=1_000_000)
    variant: str | None = Field(None, max_length=32)
    phase: str | None = Field(None, max_length=32)

@app.post("/useritems")
def create_user_item(payload: CreateUserItemRequest, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    repo = ItemRepository(db)
    itm = db.query(Item).filter(Item.item_id == payload.item_id).first()
    if not itm:
        raise HTTPException(status_code=404, detail="Item nenalezen")
        
    # Prevent multiple cash items
    if itm.slug == 'cash' or itm.name == 'cash':
        from models import UserItem
        existing_cash = db.query(UserItem).filter(UserItem.user_id == current.user_id, UserItem.item_id == itm.item_id).first()
        if existing_cash:
            raise HTTPException(status_code=400, detail="Cash položku už máte v inventáři. Můžete ji upravit přímo tam.")

    created = repo.add_user_item(
        user_id=current.user_id,
        item_id=payload.item_id,
        price=payload.buy_price,
        amount=payload.amount,
        float_value=payload.float_value,
        pattern=payload.pattern,
        variant=payload.variant,
        phase=payload.phase,
    )
    return created

@app.delete("/useritems/{user_item_id}", status_code=204)
def delete_user_item(user_item_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    repo = ItemRepository(db)
    ok = repo.delete_user_item(user_item_id, current.user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="User item nenalezen")
    return

class UpdateUserItemRequest(BaseModel):
    amount: int | None = Field(None, ge=1, le=1_000_000)
    float_value: float | None = Field(None, ge=0, le=1)
    pattern: int | None = Field(None, ge=0, le=1_000_000)
    buy_price: float | None = Field(None, ge=0, le=10_000_000)
    description: str | None = Field(None, max_length=1000)
    wear: str | None = Field(None, max_length=100)
    discord_webhook_url: str | None = Field(None, max_length=500)
    variant: str | None = Field(None, max_length=32)
    phase: str | None = Field(None, max_length=32)

@app.patch("/useritems/{user_item_id}")
def update_user_item(user_item_id: int, payload: UpdateUserItemRequest, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    repo = ItemRepository(db)
    patch_data = payload.model_dump(exclude_unset=True)
    if 'discord_webhook_url' in patch_data:
        webhook = sanitize_text(patch_data['discord_webhook_url'], 500)
        if webhook:
            if not is_valid_discord_webhook_url(webhook):
                raise HTTPException(status_code=400, detail='Invalid Discord webhook URL')
            patch_data['discord_webhook_url'] = webhook
        else:
            patch_data['discord_webhook_url'] = None

    updated = repo.update_user_item(
        user_item_id=user_item_id,
        user_id=current.user_id,
        **patch_data
    )
    if not updated:
        raise HTTPException(status_code=404, detail="User item nenalezen")
    return updated

@app.post("/refresh-portfolio/{user_id}")
def refresh_portfolio(user_id: int, request: Request, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    """
    Spustí aktualizaci cen z CSFloat.
    """
    if user_id != current.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    _enforce_limit(
        refresh_rate_limiter,
        f"refresh-portfolio:user:{current.user_id}",
        limit=6,
        window_seconds=60,
        detail="Too many portfolio refresh requests",
    )

    strategy = CSFloatStrategy()
    service = PriceService(db, strategy)
    try:
        updated_items = service.update_portfolio_prices(user_id)
        return {
            "message": "Portfolio úspěšně aktualizováno!", 
            "source": "CSFloat API",
            "changes": updated_items
        }
    except Exception:
        raise HTTPException(status_code=500, detail="Portfolio refresh failed")
    
    
@app.get("/portfolio-history/{user_id}")
def get_portfolio_history(user_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    """
    Vrátí historická data pro graf (hodnota portfolia v čase).
    """
    if user_id != current.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    repo = ItemRepository(db)
    history_records = db.query(PortfolioHistory).filter(
        PortfolioHistory.user_id == user_id
    ).order_by(PortfolioHistory.timestamp.asc()).all()
    if not history_records:
        return {"message": "Historie nenalezena."}

    return history_records


@app.get("/cases")
def get_cases(db: Session = Depends(get_db)):
    from sqlalchemy.orm import joinedload
    items = db.query(Item).filter(Item.item_type == 'case').options(
        joinedload(Item.collection_item)
    ).limit(500).all()

    res = []
    for i in items:
        d = i.__dict__.copy()
        if "_sa_instance_state" in d:
            del d["_sa_instance_state"]
        
        col = i.collection_item
        d.pop("collection_item", None)
        
        if col:
            d["collection_slug"] = col.slug
            
        res.append(d)
    return res


@app.get("/cases/{slug}")
def get_case_detail(slug: str, db: Session = Depends(get_db)):
    repo = ItemRepository(db)
    case = repo.get_case_by_slug(slug)
    if not case:
        raise HTTPException(status_code=404, detail="Case nenalezena")
    skins = repo.get_case_items_by_types(case.item_id, ["skin"])
    # Include explicit knives plus any skin entries marked with knife-like rarity
    knives_explicit = repo.get_case_items_by_types(case.item_id, ["knife"])  
    gloves_explicit = repo.get_case_items_by_types(case.item_id, ["glove"]) 
    # Fallback classification to be robust against data changes
    knife_like_from_skins = [s for s in skins if (s.rarity or "").lower() in ("knife", "knife/glove")]
    glove_like_from_skins = [s for s in skins if (s.rarity or "").lower() in ("glove", "knife/glove")]
    # Deduplicate by item_id
    def dedupe(arr):
        seen = set()
        out = []
        for x in arr:
            if x.item_id in seen:
                continue
            seen.add(x.item_id)
            out.append(x)
        return out
    knives = dedupe(knives_explicit + knife_like_from_skins)
    gloves = dedupe(gloves_explicit + glove_like_from_skins)
    return {
        "case": case,
        "skins": skins,
        "knives": knives,
        "gloves": gloves,
    }


@app.get("/collections")
def get_collections(db: Session = Depends(get_db)):
    repo = ItemRepository(db)
    return repo.get_items(item_type='collection', limit=500)


@app.get("/collections/{slug}")
def get_collection_detail(slug: str, db: Session = Depends(get_db)):
    repo = ItemRepository(db)
    coll = repo.get_collection_by_slug(slug)
    if not coll:
        raise HTTPException(status_code=404, detail="Collection nenalezena")
    skins = repo.get_collection_items(coll.item_id)
    return {
        "collection": coll,
        "skins": skins,
    }


@app.post("/refresh-items")
def refresh_items(
    request: Request,
    item_type: str | None = None,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    """
    Aktualizuje ceny pro daný typ itemů (např. item_type='case' nebo 'skin').
    Pokud není zadán item_type, zkusí aktualizovat všechny relevantní typy.
    """
    strategy = CSFloatStrategy()
    service = PriceService(db, strategy)
    _enforce_limit(
        refresh_rate_limiter,
        f"refresh-items:user:{current.user_id}:{item_type or 'all'}",
        limit=4,
        window_seconds=60,
        detail="Too many items refresh requests",
    )

    try:
        updated = service.update_items_prices(item_type=item_type)
        return {
            "message": "Ceny položek aktualizovány!",
            "item_type": item_type or "all",
            "count": len(updated),
            "changes": updated,
        }
    except Exception:
        raise HTTPException(status_code=500, detail="Items refresh failed")


@app.post("/useritems/{user_item_id}/refresh")
def refresh_user_item_price(user_item_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    """
    Refresh price for a specific UserItem (taking wear/float into account).
    """
    strategy = CSFloatStrategy()
    service = PriceService(db, strategy)
    try:
        updated = service.update_specific_user_item_price(user_item_id, current.user_id)
        if not updated:
             # If update returns None (not found or error fetching), return a 404 or 400
             # raising 404 is okay, but user will get an error in frontend.
             # Ideally we might want to say "Price not found" but that's still an error state for this action.
             raise HTTPException(status_code=404, detail="Price not found or item unavailable")
        return updated
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/items/{item_id}/refresh")
def refresh_single_item(item_id: int, request: Request, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    """
    Refresh price for a single item.
    """
    strategy = CSFloatStrategy()
    service = PriceService(db, strategy)
    _enforce_limit(
        refresh_rate_limiter,
        f"refresh-single:user:{current.user_id}:{item_id}",
        limit=8,
        window_seconds=60,
        detail="Too many single-item refresh requests",
    )

    try:
        updated = service.update_single_item_price(item_id)
        if not updated:
            raise HTTPException(status_code=404, detail="Item not found")
        return updated
    except Exception:
        raise HTTPException(status_code=500, detail="Item refresh failed")


def _normalize_token(s: str) -> str:
    return ''.join(ch for ch in (s or '').lower() if ch.isalnum())


def infer_def_index(item_name: str, item_type: str | None = None) -> int | None:
    base_name = ((item_name or '').split('|')[0]).strip().lower()
    normalized = _normalize_token(base_name)
    t = (item_type or '').lower()

    weapon_map = {
        'deagle': 1,
        'deserteagle': 1,
        'dualberettas': 2,
        'elite': 2,
        'fiveseven': 3,
        'glock18': 4,
        'ak47': 7,
        'aug': 8,
        'awp': 9,
        'famas': 10,
        'g3sg1': 11,
        'galilar': 13,
        'galil': 13,
        'm249': 14,
        'm4a4': 16,
        'm4a1': 16,
        'mac10': 17,
        'p90': 19,
        'mp5sd': 23,
        'ump45': 24,
        'xm1014': 25,
        'ppbizon': 26,
        'bizon': 26,
        'mag7': 27,
        'negev': 28,
        'sawedoff': 29,
        'tec9': 30,
        'zeusx27': 31,
        'hkp2000': 32,
        'p2000': 32,
        'mp7': 33,
        'mp9': 34,
        'nova': 35,
        'p250': 36,
        'scar20': 38,
        'sg553': 39,
        'sg556': 39,
        'ssg08': 40,
        'm4a1s': 60,
        'usps': 61,
        'cz75auto': 63,
        'r8revolver': 64,
        'revolver': 64,
    }

    knife_map = {
        'bayonet': 500,
        'flipknife': 505,
        'gutknife': 506,
        'karambit': 507,
        'm9bayonet': 508,
        'huntsmanknife': 509,
        'falchionknife': 512,
        'bowieknife': 514,
        'butterflyknife': 515,
        'shadowdaggers': 516,
        'paracordknife': 517,
        'survivalknife': 518,
        'ursusknife': 519,
        'navajaknife': 520,
        'nomadknife': 521,
        'stilettoknife': 522,
        'talonknife': 523,
        'skeletonknife': 525,
        'kukriknife': 526,
    }

    glove_map = {
        'bloodhoundgloves': 5027,
        'sportgloves': 5030,
        'drivergloves': 5031,
        'handwraps': 5032,
        'motogloves': 5033,
        'specialistgloves': 5034,
        'hydragloves': 5035,
    }

    if t == 'knife':
        for key, value in knife_map.items():
            if key in normalized:
                return value
        return 42

    if t == 'glove':
        for key, value in glove_map.items():
            if key in normalized:
                return value
        return 5030

    # Match the longest aliases first so specific keys (e.g. m4a1s)
    # are not shadowed by shorter prefixes (e.g. m4a1).
    for key in sorted(weapon_map.keys(), key=len, reverse=True):
        if normalized.startswith(key):
            return weapon_map[key]
    return None


def infer_rarity_index(rarity: str | None, item_type: str | None = None) -> int:
    r = (rarity or '').strip().lower()
    t = (item_type or '').strip().lower()
    if t in ('knife', 'glove'):
        return 6

    mapping = {
        'consumer': 1,
        'consumer grade': 1,
        'industrial': 2,
        'industrial grade': 2,
        'milspec': 3,
        'mil-spec': 3,
        'mil spec': 3,
        'milspec grade': 3,
        'restricted': 4,
        'classified': 5,
        'covert': 6,
        'contraband': 6,
        'knife': 6,
        'glove': 6,
        'knife/glove': 6,
    }
    return mapping.get(r, 3)


@app.get("/items/{slug}")
def get_item_detail(slug: str, db: Session = Depends(get_db)):
    repo = ItemRepository(db)
    itm = repo.get_item_by_slug(slug)
    if not itm:
        raise HTTPException(status_code=404, detail="Item nenalezen")
    
    cases = repo.get_cases_for_item(itm.name)
    
    collection = None
    if itm.collection_id:
        collection = db.query(Item).filter(Item.item_id == itm.collection_id).first()

    if itm.def_index is None:
        itm.def_index = infer_def_index(itm.name, itm.item_type)
    if itm.rarity_index is None:
        itm.rarity_index = infer_rarity_index(itm.rarity, itm.item_type)
    if itm.paint_index is None:
        itm.paint_index = 1
    if itm.paint_seed is None:
        itm.paint_seed = 1
    if itm.quality is None:
        itm.quality = 0

    return {
        "item": itm,
        "cases": cases,
        "collection": collection
    }

@app.get("/items/{slug}/history")
def get_item_price_history(slug: str, limit: int = Query(200, ge=1, le=1000), db: Session = Depends(get_db)):
    """
    Vrátí poslední záznamy cen pro daný item (case/skin) seřazené podle času.
    """
    repo = ItemRepository(db)
    itm = repo.get_item_by_slug(slug)
    if not itm:
        raise HTTPException(status_code=404, detail="Item nenalezen")
    prices = (
        db.query(MarketPrice)
        .filter(MarketPrice.item_id == itm.item_id)
        .order_by(MarketPrice.timestamp.asc())
        .all()
    )
    # Zredukuj výstup na pole {timestamp, price}
    result = [
        {"timestamp": p.timestamp.isoformat(), "price": float(p.price)}
        for p in prices[-limit:]
    ]
    return {"item_id": itm.item_id, "slug": slug, "history": result}

# CSFloat API Key Management

class CSFloatKeyRequest(BaseModel):
    api_key: str = Field(min_length=8, max_length=512)


@app.get('/user/csfloat/status')
def get_csfloat_status(current_user: AuthUser = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.user_id == current_user.user_id).first()
    key_exists = False
    if user and user.csfloat_api_key_ciphertext:
        key_exists = True
    return {'is_set': key_exists}

@app.post('/user/csfloat')
def set_csfloat_api_key(req: CSFloatKeyRequest, current_user: AuthUser = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.user_id == current_user.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    
    clean_api_key = sanitize_text(req.api_key, 512)
    if not clean_api_key:
         # If empty string, treat as delete? Or raise error?
         # User said 'tlacitko na smazani nebo nastaveni noveho', so empty probably not allowed as 'set'.
         raise HTTPException(status_code=400, detail='API Key cannot be empty')
    
    try:
        enc = encrypt_api_key(clean_api_key)
        user.csfloat_api_key_ciphertext = enc['ciphertext']
        user.csfloat_api_key_iv = enc['iv']
        user.csfloat_api_key_tag = enc['tag']
        
        db.commit()
    except Exception as e:
        print(f'Error encrypting key: {e}')
        raise HTTPException(status_code=500, detail='Encryption failed')
        
    return {'message': 'API Key saved securely'}

@app.delete('/user/csfloat')
def delete_csfloat_key(current_user: AuthUser = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.user_id == current_user.user_id).first()
    if user:
        user.csfloat_api_key_ciphertext = None
        user.csfloat_api_key_iv = None
        user.csfloat_api_key_tag = None
        db.commit()
    return {'message': 'API Key removed'}

