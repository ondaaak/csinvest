from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from repository import SkinRepository
from service import PriceService
from strategy import CSFloatStrategy
from repository import SkinRepository # Přidat import
from models import PortfolioHistory
from fastapi.middleware.cors import CORSMiddleware # Zajištění importu

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
    """
    Vrátí seznam skinů uživatele.
    Zde vidíš Dependency Injection v praxi: (db: Session = Depends(get_db))
    """
    repo = SkinRepository(db) # Vytvoření repository s injected DB session
    skins = repo.get_user_skins(user_id)
    
    if not skins:
        return {"message": "Tento uživatel nemá žádné skiny nebo neexistuje."}
    
    return skins

@app.get("/catalog")
def get_catalog(db: Session = Depends(get_db)):
    """Vrátí všechny dostupné skiny v systému."""
    repo = SkinRepository(db)
    return repo.get_all_catalog_skins()

# Endpoint pro nákup skinu (jen pro test)
@app.post("/buy/{user_id}/{skin_id}")
def buy_skin(user_id: int, skin_id: int, price: float, db: Session = Depends(get_db)):
    repo = SkinRepository(db)
    new_skin = repo.add_user_skin(user_id, skin_id, price)
    return {"message": "Skin zakoupen!", "item": new_skin}

@app.post("/refresh-portfolio/{user_id}")
def refresh_portfolio(user_id: int, db: Session = Depends(get_db)):
    """
    Spustí aktualizaci cen z CSFloat.
    """
    # 1. Zvolíme strategii (Dependency Injection)
    # Tady říkáme: "Chceme použít CSFloat"
    strategy = CSFloatStrategy()
    
    # 2. Vytvoříme službu a 'vstříkneme' jí závislosti
    service = PriceService(db, strategy)
    
    # 3. Spustíme logiku
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
    repo = SkinRepository(db)
    # Voláme přímo SQLAlchemy, nepotřebujeme novou metodu v Repositori
    history_records = db.query(PortfolioHistory).filter(
        PortfolioHistory.user_id == user_id
    ).order_by(PortfolioHistory.timestamp.asc()).all()
    
    if not history_records:
        return {"message": "Historie nenalezena."}

    return history_records