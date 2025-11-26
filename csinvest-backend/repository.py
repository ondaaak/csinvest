from sqlalchemy.orm import Session, joinedload
from models import UserSkin, Skin, PortfolioHistory, MarketPrice
import datetime
from sqlalchemy import func


class SkinRepository:
    """
    Vzor Repository: Zapouzdřuje práci s databází.
    """
    def __init__(self, db: Session):
        self.db = db

    # --- 1. Metody pro Portfolio ---
    
    def get_user_skins(self, user_id: int):
        """Vrátí všechny skiny, které uživatel vlastní, VČETNĚ DAT Z TABULKY SKIN."""
        # Změna: Přidáváme .options(joinedload(UserSkin.skin))
        from sqlalchemy.orm import joinedload # <--- NOVÝ IMPORT
        
        return self.db.query(UserSkin).filter(UserSkin.user_id == user_id).options(
            joinedload(UserSkin.skin) # <-- Říkáme SQLAlchemy, aby rovnou natáhla data z relace 'skin'
        ).all()

    def add_user_skin(self, user_id: int, skin_id: int, price: float):
        """Přidá nový skin do inventáře (nákup)."""
        new_item = UserSkin(
            user_id=user_id,
            skin_id=skin_id,
            buy_price=price,
            current_price=price, # Při nákupu je aktuální cena stejná
            buy_date=datetime.date.today(),
            last_update=datetime.datetime.now()
        )
        self.db.add(new_item)
        self.db.commit()
        self.db.refresh(new_item)
        return new_item

    # --- 2. Metody pro Katalog ---
    
    def get_all_catalog_skins(self, limit: int = 100):
        """Vrátí seznam všech dostupných skinů v systému (katalog)."""
        return self.db.query(Skin).limit(limit).all()

    # --- 3. Metody pro Ceny ---
    
    def update_price(self, user_skin_id: int, new_price: float):
        """Aktualizuje aktuální cenu u vlastněného skinu."""
        item = self.db.query(UserSkin).filter(UserSkin.user_skin_id == user_skin_id).first()
        if item:
            item.current_price = new_price
            item.last_update = datetime.datetime.now()
            self.db.commit()
            
    def save_market_price(self, market_id: int, skin_id: int, price: float):
        """Uloží historický záznam do MARKETPRICE."""
        new_record = MarketPrice(
            market_id=market_id,
            skin_id=skin_id,
            price=price,
            timestamp=datetime.datetime.now()
        )
        self.db.add(new_record)
        self.db.commit()

    # Uvnitř třídy SkinRepository v repository.py

    def calculate_portfolio_totals(self, user_id: int):
        """Spočítá celkovou investovanou částku a aktuální hodnotu portfolia."""
        # 1. Celková investovaná částka (součet buy_price)
        total_invested = self.db.query(func.sum(UserSkin.buy_price)).filter(
            UserSkin.user_id == user_id
        ).scalar() or 0

        # 2. Celková aktuální hodnota (součet current_price)
        total_value = self.db.query(func.sum(UserSkin.current_price)).filter(
            UserSkin.user_id == user_id
        ).scalar() or 0
        
        # 3. Zisk
        total_profit = total_value - total_invested
        
        return {
            "total_invested": total_invested,
            "total_value": total_value,
            "total_profit": total_profit
        }

    def save_portfolio_history(self, user_id: int, totals: dict):
        """Uloží snímek portfolia do historické tabulky (PORTFOLIOHISTORY)."""
        new_record = PortfolioHistory(
            user_id=user_id,
            total_invested=totals['total_invested'],
            total_value=totals['total_value'],
            total_profit=totals['total_profit']
        )
        self.db.add(new_record)
        self.db.commit()