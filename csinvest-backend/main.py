from fastapi import FastAPI, Depends, HTTPException, Query
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
from sqlalchemy import func
from scheduler import start_scheduler
from encryption import encrypt_api_key
import datetime

app = FastAPI()

@app.on_event("startup")
def startup_event():
    start_scheduler()


cfg = Config()
origins = cfg.CORS_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ------------------------------------

class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

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
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter((User.username == data.username) | (User.email == data.email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username nebo email již existuje")
    user = User(username=data.username, email=data.email, password_hash=hash_password(data.password), currency='USD')
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(str(user.user_id))
    return {"access_token": token, "token_type": "bearer", "user": user_to_schema(user)}

@app.post("/auth/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == data.username).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Neplatné přihlašovací údaje")

    token = create_access_token(str(user.user_id))
    return {"access_token": token, "token_type": "bearer", "user": user_to_schema(user)}

@app.get("/auth/me")
def auth_me(current: User = Depends(get_current_user)):
    return user_to_schema(current)

class UpdateUserRequest(BaseModel):
    discord_portfolio_webhook_url: str | None = None
    discord_portfolio_notification_time: str | None = None
    currency: str | None = None
    sell_fee_pct: float | None = None
    withdraw_fee_pct: float | None = None

class CreateUserItemHistoryRequest(BaseModel):
    item_id: int
    amount: int = 1
    buy_price: float
    sell_price: float
    sold_date: datetime.date | None = None

class SellUserItemRequest(BaseModel):
    sell_price: float | None = None
    buy_price: float | None = None
    sold_date: datetime.date | None = None

class UpdateUserItemHistoryRequest(BaseModel):
    amount: int | None = None
    buy_price: float | None = None
    sell_price: float | None = None
    sold_date: datetime.date | None = None

@app.patch("/users/me")
def update_user_me(payload: UpdateUserRequest, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    update_data = payload.dict(exclude_unset=True)
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
def search_items(q: str, limit: int = 10, exclude_item_type: Optional[List[str]] = Query(None), db: Session = Depends(get_db)):
    repo = ItemRepository(db)
    results = repo.search_items(q, limit=limit, exclude_types=exclude_item_type)
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
def get_portfolio(user_id: int, db: Session = Depends(get_db)):
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
        sold_date=sold_date,
    )

@app.post("/useritems/{user_item_id}/sell")
def sell_user_item(user_item_id: int, payload: SellUserItemRequest, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    repo = ItemRepository(db)
    moved = repo.move_user_item_to_history(
        user_item_id=user_item_id,
        user_id=current.user_id,
        sell_price=payload.sell_price,
        buy_price=payload.buy_price,
        sold_date=payload.sold_date,
    )
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
def get_items(item_type: str = None, limit: int = 100, db: Session = Depends(get_db)):
    repo = ItemRepository(db)
    return repo.get_items(item_type=item_type, limit=limit)

class CreateUserItemRequest(BaseModel):
    item_id: int
    amount: int = 1
    buy_price: float
    float_value: float | None = None
    pattern: int | None = None
    variant: str | None = None
    phase: str | None = None

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
    amount: int | None = None
    float_value: float | None = None
    pattern: int | None = None
    buy_price: float | None = None
    description: str | None = Field(None, max_length=1000)
    wear: str | None = Field(None, max_length=100)
    discord_webhook_url: str | None = Field(None, max_length=500)
    variant: str | None = None
    phase: str | None = None

@app.patch("/useritems/{user_item_id}")
def update_user_item(user_item_id: int, payload: UpdateUserItemRequest, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    repo = ItemRepository(db)
    updated = repo.update_user_item(
        user_item_id=user_item_id,
        user_id=current.user_id,
        **payload.model_dump(exclude_unset=True)
    )
    if not updated:
        raise HTTPException(status_code=404, detail="User item nenalezen")
    return updated

@app.post("/refresh-portfolio/{user_id}")
def refresh_portfolio(user_id: int, db: Session = Depends(get_db)):
    """
    Spustí aktualizaci cen z CSFloat.
    """
    strategy = CSFloatStrategy()
    service = PriceService(db, strategy)
    try:
        updated_items = service.update_portfolio_prices(user_id)
        return {
            "message": "Portfolio úspěšně aktualizováno!", 
            "source": "CSFloat API",
            "changes": updated_items
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    
@app.get("/portfolio-history/{user_id}")
def get_portfolio_history(user_id: int, db: Session = Depends(get_db)):
    """
    Vrátí historická data pro graf (hodnota portfolia v čase).
    """
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
def refresh_items(item_type: str | None = None, db: Session = Depends(get_db)):
    """
    Aktualizuje ceny pro daný typ itemů (např. item_type='case' nebo 'skin').
    Pokud není zadán item_type, zkusí aktualizovat všechny relevantní typy.
    """
    strategy = CSFloatStrategy()
    service = PriceService(db, strategy)
    try:
        updated = service.update_items_prices(item_type=item_type)
        return {
            "message": "Ceny položek aktualizovány!",
            "item_type": item_type or "all",
            "count": len(updated),
            "changes": updated,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
def refresh_single_item(item_id: int, db: Session = Depends(get_db)):
    """
    Refresh price for a single item.
    """
    strategy = CSFloatStrategy()
    service = PriceService(db, strategy)
    try:
        updated = service.update_single_item_price(item_id)
        if not updated:
            raise HTTPException(status_code=404, detail="Item not found")
        return updated
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
def get_item_price_history(slug: str, limit: int = 200, db: Session = Depends(get_db)):
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

# ----------- Admin: Normalize item types/rarities -----------
@app.post("/admin/normalize-items")
def normalize_items(db: Session = Depends(get_db)):
    """
    Fix inconsistent data:
    - Knives -> item_type='knife', rarity='Knife'
    - Gloves -> item_type='glove', rarity='Glove'
    - Remove 'knife/glove' ambiguity and wrong rarities like 'Covert' on knives/gloves.
    """
    KNIFE_KEYS = [
        'knife', 'karambit', 'bayonet', 'flip knife', 'gut knife', 'm9 bayonet', 'butterfly knife', 'falchion knife',
        'bowie knife', 'shadow daggers', 'huntsman knife', 'stiletto knife', 'ursus knife', 'navaja knife',
        'talon knife', 'skeleton knife', 'survival knife', 'paracord knife', 'nomad knife'
    ]
    GLOVE_KEYS = [
        'gloves', 'hand wraps', 'sport gloves', 'driver gloves', 'motogloves', 'moto gloves', 'hydra gloves', 'specialist gloves'
    ]
    def is_knife(name: str) -> bool:
        n = (name or '').lower()
        return any(k in n for k in KNIFE_KEYS)
    def is_glove(name: str) -> bool:
        n = (name or '').lower()
        return any(k in n for k in GLOVE_KEYS)

    items = db.query(Item).all()
    changed = 0
    for itm in items:
        rlow = (itm.rarity or '').lower()
        t = (itm.item_type or '').lower()
        # Coerce plural/synonyms
        if t == 'gloves':
            itm.item_type = 'glove'
            t = 'glove'
        if t == 'knives':
            itm.item_type = 'knife'
            t = 'knife'
        intended = None
        if is_glove(itm.name) or rlow == 'glove':
            intended = 'glove'
        elif is_knife(itm.name) or rlow in ('knife', 'knife/glove'):
            intended = 'knife'
        if intended:
            if t != intended:
                itm.item_type = intended
                changed += 1
            correct_rarity = 'Knife' if intended == 'knife' else 'Glove'
            if itm.rarity != correct_rarity:
                itm.rarity = correct_rarity
                changed += 1
    if changed:
        db.commit()
    return {"message": "Normalization done", "changed": changed}

# ----------- Admin: Case linkage diagnostics -----------
@app.get("/admin/case-links/{slug}")
def case_links(slug: str, db: Session = Depends(get_db)):
    repo = ItemRepository(db)
    case = repo.get_case_by_slug(slug)
    if not case:
        raise HTTPException(status_code=404, detail="Case nenalezena")
    skins = repo.get_case_items_by_types(case.item_id, ["skin"]) or []
    knives = repo.get_case_items_by_types(case.item_id, ["knife"]) or []
    gloves = repo.get_case_items_by_types(case.item_id, ["glove"]) or []
    knife_like_skins = [s for s in skins if (s.rarity or "").lower() in ("knife", "knife/glove")]
    glove_like_skins = [s for s in skins if (s.rarity or "").lower() in ("glove", "knife/glove")]
    return {
        "case_id": case.item_id,
        "slug": slug,
        "counts": {
            "skins": len(skins),
            "knives_explicit": len(knives),
            "gloves_explicit": len(gloves),
            "knife_like_skins": len(knife_like_skins),
            "glove_like_skins": len(glove_like_skins),
        },
        "sample_names": {
            "knives": [k.name for k in knives[:5]],
            "gloves": [g.name for g in gloves[:5]],
            "knife_like_skins": [s.name for s in knife_like_skins[:5]],
            "glove_like_skins": [s.name for s in glove_like_skins[:5]],
        }
    }


@app.post("/admin/backfill-inspect-fields")
def backfill_inspect_fields(db: Session = Depends(get_db)):
    items = db.query(Item).all()
    changed = 0

    for itm in items:
        normalized_name = _normalize_token((itm.name or '').split('|')[0])
        next_def_index = infer_def_index(itm.name, itm.item_type)
        next_rarity_index = infer_rarity_index(itm.rarity, itm.item_type)

        should_fix_m4a1s_legacy = (
            normalized_name.startswith('m4a1s')
            and itm.def_index == 16
            and next_def_index == 60
        )

        if (itm.def_index is None and next_def_index is not None) or should_fix_m4a1s_legacy:
            itm.def_index = next_def_index
            changed += 1
        if itm.paint_index is None:
            itm.paint_index = 1
            changed += 1
        if itm.rarity_index is None:
            itm.rarity_index = next_rarity_index
            changed += 1
        if itm.paint_seed is None:
            itm.paint_seed = 1
            changed += 1
        if itm.quality is None:
            itm.quality = 0
            changed += 1

    if changed:
        db.commit()

    unresolved_def_index = db.query(func.count(Item.item_id)).filter(Item.def_index.is_(None)).scalar() or 0
    return {
        "message": "Inspect metadata backfilled",
        "changed": changed,
        "unresolved_def_index": int(unresolved_def_index),
    }


@app.get("/admin/unresolved-defindex")
def unresolved_defindex(limit: int = 300, db: Session = Depends(get_db)):
    def suggest_hint(item_name: str) -> str | None:
        n = _normalize_token((item_name or '').split('|')[0])
        hints = [
            ('hkp2000', 'P2000 / HKP2000'),
            ('usps', 'USP-S'),
            ('m4a1s', 'M4A1-S'),
            ('duals', 'Dual Berettas'),
            ('berettas', 'Dual Berettas'),
            ('cz75', 'CZ75-Auto'),
            ('revolver', 'R8 Revolver'),
            ('scar20', 'SCAR-20'),
            ('sg553', 'SG 553'),
            ('sg556', 'SG 553'),
            ('ssg08', 'SSG 08'),
            ('ump45', 'UMP-45'),
            ('mac10', 'MAC-10'),
            ('mp5sd', 'MP5-SD'),
            ('ppbizon', 'PP-Bizon'),
            ('sawedoff', 'Sawed-Off'),
            ('five', 'Five-SeveN'),
            ('fiveseven', 'Five-SeveN'),
            ('navaja', 'Navaja Knife'),
            ('butterfly', 'Butterfly Knife'),
            ('karambit', 'Karambit'),
            ('bayonet', 'Bayonet / M9 Bayonet'),
            ('stiletto', 'Stiletto Knife'),
            ('talon', 'Talon Knife'),
            ('ursus', 'Ursus Knife'),
            ('nomad', 'Nomad Knife'),
            ('skeleton', 'Skeleton Knife'),
            ('kukri', 'Kukri Knife'),
            ('sportgloves', 'Sport Gloves'),
            ('drivergloves', 'Driver Gloves'),
            ('handwraps', 'Hand Wraps'),
            ('motogloves', 'Moto Gloves'),
            ('specialistgloves', 'Specialist Gloves'),
            ('hydragloves', 'Hydra Gloves'),
        ]
        for key, label in hints:
            if key in n:
                return label
        return None

    unresolved = (
        db.query(Item)
        .filter(Item.def_index.is_(None))
        .order_by(Item.item_id.asc())
        .limit(max(1, min(limit, 2000)))
        .all()
    )

    rows = []
    for itm in unresolved:
        inferred = infer_def_index(itm.name, itm.item_type)
        if inferred is not None:
            # These can be fixed by running backfill endpoint.
            continue
        rows.append({
            "item_id": itm.item_id,
            "slug": itm.slug,
            "name": itm.name,
            "item_type": itm.item_type,
            "hint": suggest_hint(itm.name),
        })

    total_unresolved = db.query(func.count(Item.item_id)).filter(Item.def_index.is_(None)).scalar() or 0
    return {
        "total_unresolved_def_index": int(total_unresolved),
        "returned": len(rows),
        "items": rows,
        "note": "Items listed here were not auto-mapped by current infer_def_index rules.",
    }

# ----------- Admin: Attach Shattered Web knife pool to Fracture -----------
@app.post("/admin/link-fracture-knives")
def link_fracture_knives(db: Session = Depends(get_db)):
    repo = ItemRepository(db)
    case = repo.get_case_by_slug("fracture-case")
    if not case:
        raise HTTPException(status_code=404, detail="Fracture Case nenalezena")
    names = [
        # Skeleton Knife
        "Skeleton Knife | Doppler",
        "Skeleton Knife | Tiger Tooth",
        "Skeleton Knife | Marble Fade",
        "Skeleton Knife | Damascus Steel",
        "Skeleton Knife | Ultraviolet",
        "Skeleton Knife | Rust Coat",
        # Survival Knife
        "Survival Knife | Doppler",
        "Survival Knife | Tiger Tooth",
        "Survival Knife | Marble Fade",
        "Survival Knife | Damascus Steel",
        "Survival Knife | Ultraviolet",
        "Survival Knife | Rust Coat",
        # Paracord Knife
        "Paracord Knife | Doppler",
        "Paracord Knife | Tiger Tooth",
        "Paracord Knife | Marble Fade",
        "Paracord Knife | Damascus Steel",
        "Paracord Knife | Ultraviolet",
        "Paracord Knife | Rust Coat",
        # Nomad Knife
        "Nomad Knife | Doppler",
        "Nomad Knife | Tiger Tooth",
        "Nomad Knife | Marble Fade",
        "Nomad Knife | Damascus Steel",
        "Nomad Knife | Ultraviolet",
        "Nomad Knife | Rust Coat",
    ]
    def slugify(name: str) -> str:
        import re
        s = name.lower()
        s = re.sub(r"[|]+", "", s)
        s = re.sub(r"[^a-z0-9]+", "-", s)
        s = re.sub(r"-+", "-", s).strip('-')
        return s
    created = 0
    linked = 0
    for n in names:
        sl = slugify(n)
        itm = db.query(Item).filter(Item.slug == sl).first()
        if not itm:
            itm = Item(name=n, item_type='knife', rarity='Knife', slug=sl, case_id=case.item_id)
            db.add(itm)
            created += 1
        else:
            # Fix type/rarity and link to case
            if itm.item_type != 'knife':
                itm.item_type = 'knife'
            if (itm.rarity or '').lower() != 'knife':
                itm.rarity = 'Knife'
            if itm.case_id != case.item_id:
                itm.case_id = case.item_id
            linked += 1
    db.commit()
    return {"message": "Fracture knives linked", "created": created, "updated": linked}
# CSFloat API Key Management

class CSFloatKeyRequest(BaseModel):
    api_key: str


class UpdateInspectFieldsRequest(BaseModel):
    def_index: int | None = None
    paint_index: int | None = None
    rarity_index: int | None = None
    paint_seed: int | None = None
    quality: int | None = None

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
    
    if not req.api_key:
         # If empty string, treat as delete? Or raise error?
         # User said 'tlacitko na smazani nebo nastaveni noveho', so empty probably not allowed as 'set'.
         raise HTTPException(status_code=400, detail='API Key cannot be empty')
    
    try:
        enc = encrypt_api_key(req.api_key)
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


@app.patch('/admin/items/{slug}/inspect-fields')
def admin_update_inspect_fields(slug: str, payload: UpdateInspectFieldsRequest, db: Session = Depends(get_db)):
    itm = db.query(Item).filter(Item.slug == slug).first()
    if not itm:
        raise HTTPException(status_code=404, detail='Item not found')

    patch = payload.model_dump(exclude_unset=True)
    allowed = {'def_index', 'paint_index', 'rarity_index', 'paint_seed', 'quality'}
    for key, value in patch.items():
        if key in allowed:
            setattr(itm, key, value)

    db.commit()
    db.refresh(itm)
    return {
        'item_id': itm.item_id,
        'slug': itm.slug,
        'def_index': itm.def_index,
        'paint_index': itm.paint_index,
        'rarity_index': itm.rarity_index,
        'paint_seed': itm.paint_seed,
        'quality': itm.quality,
    }

