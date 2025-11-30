from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from repository import ItemRepository
from service import PriceService
from strategy import CSFloatStrategy
from models import PortfolioHistory, User, Item
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from auth import hash_password, verify_password, create_access_token, get_current_user

app = FastAPI()

# --- DEFINITIVNÍ KOREKCE CORSU ---
origins = [
    "http://localhost:5173",      # NOVÁ ADRESA: Povolení pro jméno "localhost"
    "http://127.0.0.1:5173",      # Povolení pro IP adresu
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ------------------------------------
# --- Endpointy pro API ---

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
    # Check uniqueness
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

@app.get("/")
def read_root():
    return {"message": "Vítejte v CSInvest API 🚀"}

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
    # validate item exists
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

# Endpoint pro nákup skinu (jen pro test)
@app.post("/buy/{user_id}/{item_id}")
def buy_item(user_id: int, item_id: int, price: float, db: Session = Depends(get_db)):
    repo = ItemRepository(db)
    new_item = repo.add_user_item(user_id, item_id, price)
    return {"message": "Item zakoupen!", "item": new_item}

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
    knives = repo.get_case_items_by_types(case.item_id, ["knife"])  # future-proof if knives are seeded
    gloves = repo.get_case_items_by_types(case.item_id, ["glove"])  # newly seeded as glove
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