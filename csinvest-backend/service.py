from sqlalchemy.orm import Session
from repository import ItemRepository
from strategy import IMarketStrategy
from price_factory import PriceFactory
import time
import requests

class PriceService:
    def __init__(self, db: Session, strategy: IMarketStrategy):
        self.repo = ItemRepository(db)
        self.strategy = strategy
        self.factory = PriceFactory()

    def _send_discord_notification(self, webhook_url: str, item_name: str, old_price: float, new_price: float):
        if not webhook_url:
            return
            
        try:
            diff = new_price - old_price
            if old_price > 0:
                pct = (diff / old_price) * 100
            else:
                pct = 0 if diff == 0 else 100

            emoji = "📈" if diff >= 0 else "📉"
            color = 5763719 if diff >= 0 else 15548997  # Green or Red

            embed = {
                "title": f"{emoji} Price Update: {item_name}",
                "color": color,
                "fields": [
                    {"name": "Old Price", "value": f"${old_price:.2f}", "inline": True},
                    {"name": "New Price", "value": f"${new_price:.2f}", "inline": True},
                    {"name": "Change", "value": f"{diff:+.2f} ({pct:+.2f}%)", "inline": False}
                ],
                "footer": {"text": "CSInvest Portfolio Tracker"}
            }
            
            requests.post(webhook_url, json={"embeds": [embed]}, timeout=5)
        except Exception as e:
            print(f"Failed to send Discord notification: {e}")

    def update_portfolio_prices(self, user_id: int):
        user_items = self.repo.get_user_items(user_id)
        results = []

        print(f"Začínám aktualizaci pro uživatele {user_id}. Počet položek: {len(user_items)}")

        for owned in user_items:
            time.sleep(1)
            itm = owned.item

            if not itm:
                print(f"Varování: UserItem {owned.user_item_id} nemá přiřazený Item (item_id={owned.item_id}). Přeskakuji.")
                continue

            # Skip 'cash' item updates
            if itm.slug == 'cash' or itm.name == 'cash':
                continue

            min_float = None
            max_float = None

            if getattr(itm, 'item_type', None) in ('skin', 'knife', 'glove'):
                wear_val = getattr(owned, 'wear', None)
                if not wear_val:
                    # Fallback: if user didn't enter specific float/wear, try get default from Item catalog or guess?
                    # But usually we rely on owned.wear (UserItem table).
                    wear_val = getattr(itm, 'wear', None)
                
                wear_status = f"({wear_val})" if wear_val else ""
                
                # Base name construction
                market_name = f"{itm.name} {wear_status}".strip()

                # Prepend 'StatTrak™' or 'Souvenir' if present in owned.variant
                variant = getattr(owned, 'variant', None)
                if variant:
                    # e.g. "StatTrak™ AK-47 | Case Hardened (Field-Tested)"
                    # e.g. "Souvenir SSG 08 | Detour (Factory New)"
                    market_name = f"{variant} {market_name}"

                # Handle star prefix for Knives and Gloves
                # In DB, knives are usually stored as "Skeleton Knife | Doppler"
                # But market name requires star prefix: "★ Skeleton Knife | Doppler" or "★ StatTrak™ ..."
                # Standard guns do NOT have star.
                is_knife_or_glove = (getattr(itm, 'item_type', '') in ('knife', 'glove'))
                # Also check rarities just in case type is not perfectly set but likely correct
                # However, relying on item_type 'knife' or 'glove' should be safer if your DB is consistent.
                
                if is_knife_or_glove and not market_name.startswith("★"):
                    market_name = f"★ {market_name}"

                # Append Doppler Phase if present in owned.phase
                # e.g. "★ Paracord Knife | Doppler (Factory New) Phase 1"
                phase = getattr(owned, 'phase', None)
                if phase:
                    market_name = f"{market_name} {phase}"
                
                market_name = market_name.strip()

                # If user provided a specific float_value, use it to range
                # Logic: min_float = 0.0 (or "tier-min"? User says 0.0)
                #        max_float = round up to 2 decimals
                user_float = getattr(owned, 'float_value', None)
                if user_float is not None:
                    try:
                        f = float(user_float)
                        # "0.0 je minimum float" based on user instruction
                        min_float = 0.0

                        # Round up logic: 0.0915 -> 0.10
                        import math
                        # user said: "pri itemu 0.091512 se max float da na 0.10"
                        #            "pri 0.141535 treba na 0.15" (so ceil to 2 dec places)
                        # Standard math.ceil( x * 100 ) / 100
                        max_float = math.ceil(f * 100) / 100.0
                    except ValueError:
                        pass
            elif getattr(itm, 'item_type', None) == 'charm':
                 market_name = f"Charm | {itm.name}"
            else:
                market_name = itm.name

            print(f"Skládám název pro API: {market_name}, Float: {min_float}-{max_float}")

            raw_data = self.strategy.fetch_price(market_name, min_float=min_float, max_float=max_float)
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

            old_price = float(owned.current_price) if owned.current_price else 0.0
            new_price = clean_data["price"]

            self.repo.update_item_current_price(itm.item_id, new_price)
            self.repo.update_useritems_current_price_for_item(itm.item_id, new_price)

            # Check for webhook notification
            if owned.discord_webhook_url:
                self._send_discord_notification(owned.discord_webhook_url, itm.name, old_price, new_price)

            results.append({
                "item": itm.name,
                "old_price": old_price,
                "new_price": new_price,
                "currency": "USD",
                "item_type": getattr(itm, 'item_type', None)
            })

        totals = self.repo.calculate_portfolio_totals(user_id)
        self.repo.save_portfolio_history(user_id, totals)
        return results

    def update_items_prices(self, item_type: str | None = None, limit: int = 1000):
        from models import Item
        import datetime

        if item_type:
            items = self.repo.get_items(item_type=item_type, limit=limit)
        else:
            items = self.repo.get_items(item_type='skin', limit=limit) + self.repo.get_items(item_type='case', limit=limit)

        results = []
        print(f"Aktualizuji ceny pro item_type={item_type or 'skin,case'}; počet: {len(items)}")
        
        now = datetime.datetime.now()

        for itm in items:
            # 24-hour check
            if itm.last_update and itm.current_price is not None:
                # Ensure we are comparing compatible datetimes (naive vs aware)
                # If we don't know, we can try robust check or just try-except
                try:
                    # Assuming itm.last_update is a datetime object
                    diff = now - itm.last_update
                    if diff.total_seconds() < 24 * 3600:
                        # Less than 24 hours old, skip
                        # print(f"Skipping {itm.name}, updated recently ({itm.last_update})")
                        continue
                except Exception:
                    # Fallback if comparison fails (e.g. tz mismatch), just update to be safe or ignore
                    pass

            try:
                time.sleep(1)
                if itm.item_type == 'skin':
                    wear_status = f"({itm.wear})" if getattr(itm, 'wear', None) else ""
                    market_name = f"{itm.name} {wear_status}".strip()
                elif itm.item_type == 'charm':
                    market_name = f"Charm | {itm.name}"
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

    def update_single_item_price(self, item_id: int):
        # NOTE: This method updates the "catalog" price of an ITEM, not specific USERITEM.
        # But if we want to support float-specific fetching here, we'd need context of a user item.
        # For now, we will keep it simple (generic price) OR we can accept optional float args.
        # Since the signature is fixed, we'll just do generic fetch unless we change it.
        
        itm = self.repo.get_item_by_id(item_id)
        if not itm:
            return None

        print(f"Aktualizuji jeden item ID={item_id}: {itm.name}")

        market_name = itm.name
        if getattr(itm, 'item_type', None) in ('skin', 'knife', 'glove'):
             # Try to append generic wear if it exists on the Item catalog definition
             w = getattr(itm, 'wear', None)
             if w:
                 market_name = f"{itm.name} ({w})"

        raw = self.strategy.fetch_price(market_name)
        if not raw:
            print(f"Cena pro {itm.name} nenalezena.")
            return None

        clean = self.factory.create_price(raw, itm.item_id, market_id=2)
        if not clean:
            return None

        self.repo.save_market_price(
            market_id=clean["market_id"],
            item_id=clean["skin_id"], 
            price=clean["price"]
        )
        
        self.repo.update_item_current_price(itm.item_id, clean["price"])
        self.repo.update_useritems_current_price_for_item(itm.item_id, clean["price"])

        return {
            "item_id": itm.item_id,
            "name": itm.name,
            "new_price": clean["price"]
        }

    def update_specific_user_item_price(self, user_item_id: int, user_id: int):
        # Fetch the specific user item
        # We need a method in repo to get single user item by ID
        # For now, let's just use existing query or add one.
        # But wait, repo.get_user_items returns list. 
        # I will use db session directly or add method to repo.
        # Let's add method to repo.
        user_item = self.repo.get_user_item_by_id(user_item_id, user_id)
        if not user_item:
            return None
        
        itm = user_item.item
        if not itm:
            return None

        # Logic similar to update_portfolio_prices but for single item
        min_float = None
        max_float = None

        if getattr(itm, 'item_type', None) in ('skin', 'knife', 'glove'):
            # Explicitly load wear if needed, but it should be there.
            wear_val = user_item.wear
            
            # Use calculate_wear fallback if wear is missing but float exists?
            if not wear_val and user_item.float_value is not None:
                from repository import calculate_wear
                wear_val = calculate_wear(user_item.float_value)
                # print(f"DEBUG: Wear was missing, calculated: {wear_val}")

            wear_status = f"({wear_val})" if wear_val else ""
            market_name = f"{itm.name} {wear_status}".strip()

            # Prepend 'StatTrak™' or 'Souvenir' if present in owned.variant
            variant = getattr(user_item, 'variant', None)
            if variant:
                 market_name = f"{variant} {market_name}"

            # Handle star prefix for Knives and Gloves
            is_knife_or_glove = (getattr(itm, 'item_type', '') in ('knife', 'glove'))
            if is_knife_or_glove and not market_name.startswith("★"):
                 market_name = f"★ {market_name}"
            
            # Append Doppler Phase
            phase = getattr(user_item, 'phase', None)
            if phase:
                 market_name = f"{market_name} {phase}"
            
            market_name = market_name.strip()

            user_float = getattr(user_item, 'float_value', None)
            if user_float is not None:
                try:
                    f = float(user_float)
                    min_float = 0.0
                    import math
                    max_float = math.ceil(f * 100) / 100.0
                except ValueError:
                    pass
        else:
            market_name = itm.name

        print(f"Aktualizuji UserItem ID={user_item_id}: '{market_name}' (Float: {min_float}-{max_float})")

        raw = self.strategy.fetch_price(market_name, min_float=min_float, max_float=max_float)
        if not raw:
            print(f"Cena pro {market_name} nenalezena.")
            return None

        clean = self.factory.create_price(raw, itm.item_id, market_id=2)
        if not clean:
            return None

        old_price = float(user_item.current_price) if user_item.current_price else 0.0
        new_price = clean["price"]

        # Update ONLY this user item price
        self.repo.update_price(user_item_id, new_price)
        
        if user_item.discord_webhook_url:
             self._send_discord_notification(user_item.discord_webhook_url, market_name, old_price, new_price)

        # Also save historical market price record for this item type?
        # Maybe, but be careful as it is specific float price.
        # Generally we save market price for analytics.
        self.repo.save_market_price(
             market_id=clean["market_id"],
             item_id=clean["skin_id"], 
             price=clean["price"]
        )

        return {
            "user_item_id": user_item_id,
            "name": market_name,
            "new_price": clean["price"]
        }