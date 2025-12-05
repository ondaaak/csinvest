from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from repository import ItemRepository
from service import PriceService
from strategy import CSFloatStrategy
from models import PortfolioHistory, User, Item, MarketPrice
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from auth import hash_password, verify_password, create_access_token, get_current_user
from config import Config
from sqlalchemy import func

app = FastAPI()

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

def user_to_schema(u: User) -> AuthUser:
    return AuthUser(user_id=u.user_id, username=u.username, email=u.email)

@app.post("/auth/register")
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter((User.username == data.username) | (User.email == data.email)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username nebo email již existuje")
    user = User(username=data.username, email=data.email, password_hash=hash_password(data.password))
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

class SearchResponseItem(BaseModel):
    item_id: int
    name: str
    item_type: str
    slug: str

def to_search_item(itm: Item) -> SearchResponseItem:
    return SearchResponseItem(item_id=itm.item_id, name=itm.name, item_type=itm.item_type, slug=itm.slug)

@app.get("/search")
def search_items(q: str, limit: int = 10, db: Session = Depends(get_db)):
    repo = ItemRepository(db)
    results = repo.search_items(q, limit=limit)
    return [to_search_item(r) for r in results]

# ----------- Knives & Gloves listing/search -----------
@app.get("/knives")
def list_knives(q: str | None = None, db: Session = Depends(get_db)):
    repo = ItemRepository(db)
    if q:
        items = [r for r in repo.search_items(q, limit=10_000_000) if r.item_type == 'knife']
    else:
        items = repo.get_items(item_type='knife', limit=10_000_000)
    return [to_search_item(it) for it in items]

@app.get("/gloves")
def list_gloves(q: str | None = None, db: Session = Depends(get_db)):
    repo = ItemRepository(db)
    if q:
        items = [r for r in repo.search_items(q, limit=10_000_000) if r.item_type == 'glove']
    else:
        items = repo.get_items(item_type='glove', limit=10_000_000)
    return [to_search_item(it) for it in items]

# Aliases for Search buttons
@app.get("/search/knives")
def search_knives(q: str | None = None, db: Session = Depends(get_db)):
    return list_knives(q=q, db=db)

@app.get("/search/gloves")
def search_gloves(q: str | None = None, db: Session = Depends(get_db)):
    return list_gloves(q=q, db=db)

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

@app.get("/items")
def get_items(item_type: str = None, limit: int = 100, db: Session = Depends(get_db)):
    repo = ItemRepository(db)
    return repo.get_items(item_type=item_type, limit=limit)

class CreateUserItemRequest(BaseModel):
    item_id: int
    amount: int = 1
    float_value: float | None = None
    pattern: int | None = None
    buy_price: float

@app.post("/useritems")
def create_user_item(payload: CreateUserItemRequest, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    repo = ItemRepository(db)
    itm = db.query(Item).filter(Item.item_id == payload.item_id).first()
    if not itm:
        raise HTTPException(status_code=404, detail="Item nenalezen")
    created = repo.add_user_item(
        user_id=current.user_id,
        item_id=payload.item_id,
        price=payload.buy_price,
        amount=payload.amount,
        float_value=payload.float_value,
        pattern=payload.pattern,
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

@app.patch("/useritems/{user_item_id}")
def update_user_item(user_item_id: int, payload: UpdateUserItemRequest, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    repo = ItemRepository(db)
    updated = repo.update_user_item(
        user_item_id=user_item_id,
        user_id=current.user_id,
        **payload.model_dump(exclude_none=True)
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
    repo = ItemRepository(db)
    return repo.get_items(item_type='case', limit=500)


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


@app.get("/items/{slug}")
def get_item_detail(slug: str, db: Session = Depends(get_db)):
    repo = ItemRepository(db)
    itm = repo.get_item_by_slug(slug)
    if not itm:
        raise HTTPException(status_code=404, detail="Item nenalezen")
    return itm

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