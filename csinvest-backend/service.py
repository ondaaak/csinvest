# service.py - KOMPLETNÍ KÓD
from sqlalchemy.orm import Session
from repository import SkinRepository
from strategy import IMarketStrategy
from factory import PriceFactory
import time

class PriceService:
    """
    Hlavní služba. Používá Dependency Injection.
    """
    def __init__(self, db: Session, strategy: IMarketStrategy):
        self.repo = SkinRepository(db)
        self.strategy = strategy
        self.factory = PriceFactory()

    def update_portfolio_prices(self, user_id: int):
        user_skins = self.repo.get_user_skins(user_id)
        results = []

        print(f"Začínám aktualizaci pro uživatele {user_id}. Počet skinů: {len(user_skins)}")

        for item in user_skins:
            time.sleep(1) # PAUZA JE HNED NA ZAČÁTKU, AŤ NEDOSTANEME 429
            
            # Skládáme název skinu přesně pro API
            base_name = item.skin.name
            wear_status = f"({item.skin.wear})" 
            full_market_hash_name = f"{base_name} {wear_status}" 
            
            print(f"Skládám název pro API: {full_market_hash_name}")

            # 2. Stažení ceny z internetu (Strategy)
            raw_data = self.strategy.fetch_price(full_market_hash_name) 
            
            if not raw_data:
                print(f"Přeskakuji {item.skin.name} - chyba stahování/nenalezeno.")
                continue

            # 3. Zpracování dat (Factory)
            clean_data = self.factory.create_price(raw_data, item.skin_id, market_id=2)
            
            if not clean_data:
                 print(f"Přeskakuji {item.skin.name} - chyba zpracování.")
                 continue

            # 4. Uložení do databáze (Repository)
            self.repo.save_market_price(
                market_id=clean_data["market_id"],
                skin_id=clean_data["skin_id"],
                price=clean_data["price"]
            )
            
            self.repo.update_price(item.user_skin_id, clean_data["price"])
            
            results.append({
                "skin": item.skin.name,
                "old_price": float(item.current_price) if item.current_price else 0,
                "new_price": clean_data["price"],
                "currency": "USD"
            })
            
        # 5. Spočítat a uložit celkový záznam do historie (W3 Operace)
        totals = self.repo.calculate_portfolio_totals(user_id)
        self.repo.save_portfolio_history(user_id, totals)    

        return results