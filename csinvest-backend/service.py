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

    def _send_portfolio_summary_notification(self, webhook_url: str, items: list, username: str = "User"):
        if not webhook_url or not items:
            return

        try:
            import datetime
            now_dt = datetime.datetime.now()
            
            # Recalculate totals based on latest prices vs old prices
            total_new_value = sum(i['new_price'] * i['amount'] for i in items)
            total_old_value = sum(i['old_price'] * i['amount'] for i in items) # old_price is per unit
            
            total_diff = total_new_value - total_old_value
            total_pct = (total_diff / total_old_value * 100) if total_old_value > 0 else 0

            # Sort by profit % descending
            items.sort(key=lambda x: x['profit_pct'], reverse=True)
            
            # Select top 15 and bottom 15
            top_15 = items[:15]
            bottom_15 = items[-15:] if len(items) > 15 else [] 
            # If overlap (e.g. 20 items total), just show all via simple logic
            if len(items) <= 30:
                display_items = items
                has_gap = False
            else:
                display_items = top_15
                has_gap = True
                
            emoji_total = "🚀" if total_diff >= 0 else "📉"
            color = 5763719 if total_diff >= 0 else 15548997

            lines = []
            # Header
            # Old Total Value: 1000 (datum posledni aktualizace) -> We don't have exact old date per item easily accessible here, but we can assume "Previous Update"
            # We can use NOW as current date
            
            lines.append(f"**Old Total Value:** ${total_old_value:,.2f} (Previous)")
            lines.append(f"**New Total Value:** ${total_new_value:,.2f} ({now_dt.strftime('%d.%m.%Y %H:%M')})")
            lines.append(f"**Total Profit:** ${total_diff:,.2f} ({total_pct:+.2f}%)")
            lines.append("")
            
            lines.append("```")
            # Table Header: Item | Old Price | New Price | Profit
            # Adjust spacing to be more compact
            # Item: 22, Old: 8, New: 8, Profit: 9 => ~55 chars
            
            header = f"{'Item':<22} | {'Old':<8} | {'New':<8} | {'Profit':<9}"
            lines.append(header)
            lines.append("-" * len(header))

            def add_rows(rows):
                for item in rows:
                    name = item['name'][:21] # Truncate slightly more
                    old_p = f"${item['old_price']:.2f}"
                    new_p = f"${item['new_price']:.2f}"
                    
                    # profit is diff between new and old
                    # item['profit_pct'] is correctly calculated as change %
                    pct = f"{item['profit_pct']:+.1f}%"
                    
                    # Use narrower columns
                    line = f"{name:<22} | {old_p:<8} | {new_p:<8} | {pct:<9}"
                    lines.append(line)

            if not has_gap:
                add_rows(display_items)
            else:
                add_rows(top_15)
                lines.append("")
                lines.append(f"... {len(items)-30} items hidden ...")
                lines.append("")
                # Before adding bottom 15, we should ensure they are not already in top 15 (handled by len check above)
                # But bottom 15 are legally the last 15 of the sorted array
                # If array is [0..99], top is [0..14], bottom is [85..99]
                add_rows(bottom_15)

            lines.append("```")

            embed = {
                "title": f"{emoji_total} {username}'s Portfolio Update Summary",
                "description": "\n".join(lines),
                "color": color,
                "footer": {"text": f"Updated {len(items)} items"}
            }

            requests.post(webhook_url, json={"embeds": [embed]}, timeout=10)
        except Exception as e:
            print(f"Failed to send Portfolio notification: {e}")

    def update_portfolio_prices(self, user_id: int):
        # Fetch user to get webhook
        from models import User
        user = self.repo.db.query(User).filter(User.user_id == user_id).first()
        portfolio_webhook = user.discord_portfolio_webhook_url if user else None

        user_items = self.repo.get_user_items(user_id)
        results = []
        notification_items = []

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
                 market_name = itm.name
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

            # Add to portfolio notification list
            # We want change since last update, so we use old_price which is captured before update
            # old_price is owned.current_price
            
            # If old_price is 0 or None, we can't calculate change percentage meaningfully (it is 100% or infinite).
            # But for display, we treat it as gain from 0.
            
            val_old = (old_price if old_price else 0.0)
            val_new = new_price
            
            diff_val = val_new - val_old
            if val_old > 0:
                diff_pct = (diff_val / val_old) * 100
            else:
                # If old price was 0 and new is > 0, that's technically infinite increase, 
                # but let's cap it or just show 100% or similar. 
                # If both are 0, it is 0.
                if val_new > 0:
                    diff_pct = 100.0 
                else:
                    diff_pct = 0.0

            amount = owned.amount if owned.amount else 1
            
            notification_items.append({
                "name": itm.name,
                "old_price": float(val_old),
                "new_price": float(val_new),
                "amount": amount,
                "profit_pct": diff_pct,
                "profit_abs": diff_val
            })

            results.append({
                "item": itm.name,
                "old_price": old_price,
                "new_price": new_price,
                "currency": "USD",
                "item_type": getattr(itm, 'item_type', None)
            })
        
        # Send portfolio summary if webhook is set
        if portfolio_webhook and notification_items:
            # Pass username to personalized title
            user_name = user.username if user else "User"
            self._send_portfolio_summary_notification(portfolio_webhook, notification_items, user_name)

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
                    market_name = itm.name
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