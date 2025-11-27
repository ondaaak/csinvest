from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from repository import ItemRepository
from service import PriceService
from strategy import CSFloatStrategy
from models import PortfolioHistory
from fastapi.middleware.cors import CORSMiddleware

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
    skins = repo.get_case_skins(case.item_id)
    return {
        "case": case,
        "skins": skins
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