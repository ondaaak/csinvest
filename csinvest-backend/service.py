from sqlalchemy.orm import Session
from repository import ItemRepository
from strategy import IMarketStrategy
from price_factory import PriceFactory
import time

class PriceService:
    def __init__(self, db: Session, strategy: IMarketStrategy):
        self.repo = ItemRepository(db)
        self.strategy = strategy
        self.factory = PriceFactory()

    def update_portfolio_prices(self, user_id: int):
        user_items = self.repo.get_user_items(user_id)
        results = []

        print(f"Začínám aktualizaci pro uživatele {user_id}. Počet položek: {len(user_items)}")

        for owned in user_items:
            time.sleep(1)
            itm = owned.item

            if getattr(itm, 'item_type', None) == 'skin':
                wear_status = f"({getattr(itm, 'wear', '')})" if getattr(itm, 'wear', None) else ""
                market_name = f"{itm.name} {wear_status}".strip()
            else:
                market_name = itm.name

            print(f"Skládám název pro API: {market_name}")

            raw_data = self.strategy.fetch_price(market_name)
            if not raw_data:
                print(f"Přeskakuji {itm.name} - chyba stahování/nenalezeno.")
                continue

            clean_data = self.factory.create_price(raw_data, itm.item_id, market_id=2)
            if not clean_data:
                print(f"Přeskakuji {itm.name} - chyba zpracování.")
                continue

            self.repo.save_market_price(
                market_id=clean_data["market_id"],
                item_id=clean_data["skin_id"], 
                price=clean_data["price"]
            )

            self.repo.update_item_current_price(itm.item_id, clean_data["price"])
            self.repo.update_useritems_current_price_for_item(itm.item_id, clean_data["price"])

            results.append({
                "item": itm.name,
                "old_price": float(owned.current_price) if owned.current_price else 0,
                "new_price": clean_data["price"],
                "currency": "USD",
                "item_type": getattr(itm, 'item_type', None)
            })

        totals = self.repo.calculate_portfolio_totals(user_id)
        self.repo.save_portfolio_history(user_id, totals)
        return results

    def update_items_prices(self, item_type: str | None = None, limit: int = 1000):
        from models import Item  # local import to avoid cycles in type hints
        if item_type:
            items = self.repo.get_items(item_type=item_type, limit=limit)
        else:
            items = self.repo.get_items(item_type='skin', limit=limit) + self.repo.get_items(item_type='case', limit=limit)

        results = []
        print(f"Aktualizuji ceny pro item_type={item_type or 'skin,case'}; počet: {len(items)}")
        for itm in items:
            try:
                time.sleep(1)
                if itm.item_type == 'skin':
                    wear_status = f"({itm.wear})" if getattr(itm, 'wear', None) else ""
                    market_name = f"{itm.name} {wear_status}".strip()
                else:
                    market_name = itm.name

                raw = self.strategy.fetch_price(market_name)
                if not raw:
                    print(f"Přeskakuji {itm.name} - cena nenalezena.")
                    continue

                clean = self.factory.create_price(raw, itm.item_id, market_id=2)
                if not clean:
                    print(f"Přeskakuji {itm.name} - chyba zpracování ceny.")
                    continue

                self.repo.save_market_price(
                    market_id=clean["market_id"],
                    item_id=clean["skin_id"], 
                    price=clean["price"],
                )
                
                self.repo.update_item_current_price(itm.item_id, clean["price"])

                results.append({
                    "item_id": itm.item_id,
                    "name": itm.name,
                    "item_type": itm.item_type,
                    "new_price": clean["price"],
                    "currency": "USD",
                })
            except Exception as e:
                print(f"Chyba při aktualizaci {itm.name}: {e}")
                continue

        return results