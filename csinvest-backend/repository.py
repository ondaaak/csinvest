from sqlalchemy.orm import Session, joinedload
from models import UserItem, UserItemHistory, Item, PortfolioHistory, MarketPrice
import datetime
from sqlalchemy import func


def calculate_wear(float_value: float) -> str | None:
    if float_value is None:
        return None
    
    # Ensure float is treated as a number
    try:
        val = float(float_value)
    except (ValueError, TypeError):
        return None

    if val < 0.07:
        return "Factory New"
    elif val < 0.15:
        return "Minimal Wear"
    elif val < 0.38:
        return "Field-Tested"
    elif val < 0.45:
        return "Well-Worn"
    else:
        return "Battle-Scarred"

class ItemRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_user_items(self, user_id: int):
        return self.db.query(UserItem).filter(UserItem.user_id == user_id).options(
            joinedload(UserItem.item).joinedload(Item.collection_item)
        ).all()

    def get_user_item_history(self, user_id: int):
        return (
            self.db.query(UserItemHistory)
            .filter(UserItemHistory.user_id == user_id)
            .options(joinedload(UserItemHistory.item).joinedload(Item.collection_item))
            .all()
        )

    def get_user_item_by_id(self, user_item_id: int, user_id: int):
        return self.db.query(UserItem).filter(
            UserItem.user_item_id == user_item_id, 
            UserItem.user_id == user_id
        ).options(joinedload(UserItem.item)).first()

    def add_user_item(self, user_id: int, item_id: int, price: float, amount: int = 1, float_value: float | None = None, pattern: int | None = None, variant: str | None = None, phase: str | None = None):
        catalog_item = self.db.query(Item).filter(Item.item_id == item_id).first()
        current_price = float(price)
        if catalog_item and catalog_item.current_price is not None:
            try:
                # Special case for cash: ignore catalog price if it might be 0, always use buy price
                if catalog_item.slug == 'cash':
                    current_price = float(price)
                else:
                    current_price = float(catalog_item.current_price)
            except Exception:
                current_price = float(price)

        wear_str = calculate_wear(float_value)

        new_item = UserItem(
            user_id=user_id,
            item_id=item_id,
            amount=amount or 1,
            float_value=float_value,
            pattern=pattern,
            buy_price=price,
            current_price=current_price,
            wear=wear_str,
            buy_date=datetime.date.today(),
            # New items should be refreshable immediately by user action.
            last_update=None,
            variant=variant,
            phase=phase
        )
        self.db.add(new_item)
        self.db.commit()
        self.db.refresh(new_item)
        return new_item

    def _compute_final_price(self, sell_price: float, amount: int, sell_fee_pct: float, withdraw_fee_pct: float) -> float:
        gross = float(sell_price or 0) * int(amount or 1)
        sell_mult = 1 - (max(0.0, float(sell_fee_pct or 0.0)) / 100.0)
        withdraw_mult = 1 - (max(0.0, float(withdraw_fee_pct or 0.0)) / 100.0)
        return gross * sell_mult * withdraw_mult

    def add_user_item_history(
        self,
        user_id: int,
        item_id: int,
        buy_price: float,
        sell_price: float,
        amount: int = 1,
        sell_fee_pct: float | None = None,
        withdraw_fee_pct: float | None = None,
        final_price: float | None = None,
        sold_date=None,
    ):
        if sold_date is None:
            sold_date = datetime.date.today()

        amount = max(1, int(amount or 1))
        sell_fee = max(0.0, float(sell_fee_pct or 0.0))
        withdraw_fee = max(0.0, float(withdraw_fee_pct or 0.0))
        final_total = (
            float(final_price)
            if final_price is not None
            else self._compute_final_price(float(sell_price or 0), amount, sell_fee, withdraw_fee)
        )

        rec = UserItemHistory(
            user_id=user_id,
            item_id=item_id,
            amount=amount,
            buy_price=buy_price,
            sell_price=sell_price,
            sell_fee_pct=sell_fee,
            withdraw_fee_pct=withdraw_fee,
            final_price=final_total,
            sold_date=sold_date,
        )
        self.db.add(rec)
        self.db.commit()
        self.db.refresh(rec)
        return rec

    def move_user_item_to_history(
        self,
        user_item_id: int,
        user_id: int,
        amount: int | None = None,
        sell_price: float | None = None,
        buy_price: float | None = None,
        sell_fee_pct: float | None = None,
        withdraw_fee_pct: float | None = None,
        final_price: float | None = None,
        sold_date=None,
    ):
        rec = (
            self.db.query(UserItem)
            .filter(UserItem.user_item_id == user_item_id, UserItem.user_id == user_id)
            .first()
        )
        if not rec:
            return None

        if sold_date is None:
            sold_date = datetime.date.today()

        current_amount = rec.amount or 1
        sell_amount = current_amount if amount is None else int(amount)
        if sell_amount < 1:
            raise ValueError("Amount must be at least 1")
        if sell_amount > current_amount:
            raise ValueError(f"Amount cannot be higher than available ({current_amount})")

        sell_unit = float(rec.current_price or 0) if sell_price is None else float(sell_price)
        buy_unit = float(rec.buy_price or 0) if buy_price is None else float(buy_price)
        sell_fee = max(0.0, float(sell_fee_pct or 0.0))
        withdraw_fee = max(0.0, float(withdraw_fee_pct or 0.0))
        final_total = (
            float(final_price)
            if final_price is not None
            else self._compute_final_price(sell_unit, sell_amount, sell_fee, withdraw_fee)
        )

        history_rec = UserItemHistory(
            user_id=user_id,
            item_id=rec.item_id,
            amount=sell_amount,
            buy_price=buy_unit,
            sell_price=sell_unit,
            sell_fee_pct=sell_fee,
            withdraw_fee_pct=withdraw_fee,
            final_price=final_total,
            sold_date=sold_date,
        )
        self.db.add(history_rec)

        if sell_amount >= current_amount:
            self.db.delete(rec)
        else:
            rec.amount = current_amount - sell_amount
            rec.last_update = datetime.datetime.now()

        self.db.commit()
        self.db.refresh(history_rec)
        return history_rec

    def update_user_item_history(self, user_item_history_id: int, user_id: int, **fields):
        rec = (
            self.db.query(UserItemHistory)
            .filter(UserItemHistory.user_item_history_id == user_item_history_id, UserItemHistory.user_id == user_id)
            .first()
        )
        if not rec:
            return None

        allowed = {'amount', 'buy_price', 'sell_price', 'sell_fee_pct', 'withdraw_fee_pct', 'final_price', 'sold_date'}
        for k, v in fields.items():
            if k in allowed:
                setattr(rec, k, v)

        self.db.commit()
        self.db.refresh(rec)
        return rec

    def delete_user_item_history(self, user_item_history_id: int, user_id: int) -> bool:
        rec = (
            self.db.query(UserItemHistory)
            .filter(UserItemHistory.user_item_history_id == user_item_history_id, UserItemHistory.user_id == user_id)
            .first()
        )
        if not rec:
            return False
        self.db.delete(rec)
        self.db.commit()
        return True

    def get_items(self, item_type: str = None, limit: int = 100, offset: int = 0):
        q = self.db.query(Item)
        if item_type:
            q = q.filter(Item.item_type == item_type)
        return q.offset(offset).limit(limit).all()

    def get_item_by_id(self, item_id: int):
        return self.db.query(Item).filter(Item.item_id == item_id).first()

    def get_item_by_slug(self, slug: str):
        return self.db.query(Item).filter(Item.slug == slug).first()

    def get_case_by_slug(self, slug: str):
        return self.db.query(Item).filter(Item.slug == slug, Item.item_type == 'case').first()

    def get_collection_by_slug(self, slug: str):
        return (
            self.db.query(Item)
            .filter(Item.slug == slug, Item.item_type.in_(['collection', 'sticker_group']))
            .first()
        )

    def get_case_skins(self, case_id: int):
        return self.db.query(Item).filter(Item.case_id == case_id, Item.item_type == 'skin').all()

    def get_case_items_by_types(self, case_id: int, types: list[str]):
        return self.db.query(Item).filter(Item.case_id == case_id, Item.item_type.in_(types)).all()

    def get_collection_items(self, collection_id: int):
        return self.db.query(Item).filter(Item.collection_id == collection_id).all()

    def search_items(self, query: str, limit: int = 10, exclude_types: list[str] = None):
        q_str = (query or '').strip()
        if not q_str:
            return []

        q = self.db.query(Item)
        
        # Split query into words and require all words to match (AND condition)
        # This allows "tec 9 whiteout" to match "Tec-9 | Whiteout"
        for word in q_str.split():
            q = q.filter(func.lower(Item.name).like(f"%{word.lower()}%"))

        if exclude_types:
            q = q.filter(Item.item_type.notin_(exclude_types))

        # Fetch more items to allow for deduplication in Python
        # Distinct or Group By can be tricky across different DB engines (SQLite vs Postgres)
        # So we fetch a larger batch and filter duplicates by name in code.
        raw_results = (
            q.order_by(Item.item_type.asc(), Item.name.asc())
            .limit(limit * 5) 
            .all()
        )
        
        unique_results = []
        seen_names = set()
        
        for item in raw_results:
            if item.name not in seen_names:
                seen_names.add(item.name)
                unique_results.append(item)
                
            if len(unique_results) >= limit:
                break
                
        return unique_results

    def update_price(self, user_item_id: int, new_price: float):
        itm = self.db.query(UserItem).filter(UserItem.user_item_id == user_item_id).first()
        if itm:
            itm.current_price = new_price
            itm.last_update = datetime.datetime.now()
            self.db.commit()

    def update_useritems_current_price_for_item(self, item_id: int, new_price: float, user_id: int | None = None):
        now = datetime.datetime.now()
        q = self.db.query(UserItem).filter(UserItem.item_id == item_id)
        if user_id is not None:
            q = q.filter(UserItem.user_id == user_id)
        q.update({UserItem.current_price: new_price, UserItem.last_update: now}, synchronize_session=False)
        self.db.commit()

    def save_market_price(self, market_id: int, item_id: int, price: float):
        rec = MarketPrice(
            market_id=market_id,
            item_id=item_id,
            price=price,
            timestamp=datetime.datetime.now()
        )
        self.db.add(rec)
        self.db.commit()

    def update_item_current_price(self, item_id: int, new_price: float):
        itm = self.db.query(Item).filter(Item.item_id == item_id).first()
        if itm:
            itm.current_price = new_price
            itm.last_update = datetime.datetime.now()
            self.db.commit()

    def delete_user_item(self, user_item_id: int, user_id: int) -> bool:
        rec = (
            self.db.query(UserItem)
            .filter(UserItem.user_item_id == user_item_id, UserItem.user_id == user_id)
            .first()
        )
        if not rec:
            return False
        self.db.delete(rec)
        self.db.commit()
        return True

    def update_user_item(self, user_item_id: int, user_id: int, **fields) -> UserItem | None:
        rec = (
            self.db.query(UserItem)
            .filter(UserItem.user_item_id == user_item_id, UserItem.user_id == user_id)
            .first()
        )
        if not rec:
            return None
        
        allowed = {
            'amount', 'float_value', 'pattern', 'buy_price', 'description', 'wear', 'discord_webhook_url',
            'variant', 'phase'
        }

        # If float_value is being updated, automatically recalculate wear
        if 'float_value' in fields:
            fval = fields['float_value']
            # Calculate wear based on the new float value
            new_wear = calculate_wear(fval)
            # Update wear field in the object (it will be committed with other fields)
            rec.wear = new_wear

        for k, v in fields.items():
            if k in allowed:
                setattr(rec, k, v)
        
        # If item is 'cash', sync current_price with buy_price
        # This ensures cash always has 0 profit and correct value in totals
        if rec.item and (rec.item.slug == 'cash' or rec.item.name == 'cash'):
            if rec.buy_price is not None:
                rec.current_price = rec.buy_price

        rec.last_update = datetime.datetime.now()
        self.db.commit()
        self.db.refresh(rec)
        return rec

    def calculate_portfolio_totals(self, user_id: int):
        total_invested = (
            self.db.query(func.sum(UserItem.buy_price * func.coalesce(UserItem.amount, 1)))
            .filter(UserItem.user_id == user_id)
            .scalar() or 0
        )
        total_value = (
            self.db.query(func.sum(UserItem.current_price * func.coalesce(UserItem.amount, 1)))
            .filter(UserItem.user_id == user_id)
            .scalar() or 0
        )
        total_profit = total_value - total_invested
        return {
            "total_invested": total_invested,
            "total_value": total_value,
            "total_profit": total_profit
        }

    def save_portfolio_history(self, user_id: int, totals: dict):
        rec = PortfolioHistory(
            user_id=user_id,
            total_invested=totals['total_invested'],
            total_value=totals['total_value'],
            total_profit=totals['total_profit']
        )
        self.db.add(rec)
        self.db.commit()

    def get_cases_for_item(self, item_name: str):
        items = self.db.query(Item).filter(Item.name == item_name, Item.case_id.isnot(None)).options(joinedload(Item.case)).all()
        cases = []
        seen_case_ids = set()
        for it in items:
            if it.case and it.case.item_id not in seen_case_ids:
                cases.append(it.case)
                seen_case_ids.add(it.case.item_id)
        return cases
