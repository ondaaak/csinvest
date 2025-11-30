from sqlalchemy.orm import Session, joinedload
from models import UserItem, Item, PortfolioHistory, MarketPrice
import datetime
from sqlalchemy import func


class ItemRepository:
    def __init__(self, db: Session):
        self.db = db

    # Portfolio
    def get_user_items(self, user_id: int):
        return self.db.query(UserItem).filter(UserItem.user_id == user_id).options(
            joinedload(UserItem.item)
        ).all()

    def add_user_item(self, user_id: int, item_id: int, price: float, amount: int = 1, float_value: float | None = None, pattern: int | None = None):
        # If catalog has current_price, use it, otherwise default to buy price
        catalog_item = self.db.query(Item).filter(Item.item_id == item_id).first()
        current_price = float(price)
        if catalog_item and catalog_item.current_price is not None:
            try:
                current_price = float(catalog_item.current_price)
            except Exception:
                current_price = float(price)

        new_item = UserItem(
            user_id=user_id,
            item_id=item_id,
            amount=amount or 1,
            float_value=float_value,
            pattern=pattern,
            buy_price=price,
            current_price=current_price,
            buy_date=datetime.date.today(),
            last_update=datetime.datetime.now()
        )
        self.db.add(new_item)
        self.db.commit()
        self.db.refresh(new_item)
        return new_item

    # Catalog
    def get_items(self, item_type: str = None, limit: int = 100):
        q = self.db.query(Item)
        if item_type:
            q = q.filter(Item.item_type == item_type)
        return q.limit(limit).all()

    def get_item_by_slug(self, slug: str):
        return self.db.query(Item).filter(Item.slug == slug).first()

    def get_case_by_slug(self, slug: str):
        return self.db.query(Item).filter(Item.slug == slug, Item.item_type == 'case').first()

    def get_case_skins(self, case_id: int):
        return self.db.query(Item).filter(Item.case_id == case_id, Item.item_type == 'skin').all()

    def get_case_items_by_types(self, case_id: int, types: list[str]):
        return self.db.query(Item).filter(Item.case_id == case_id, Item.item_type.in_(types)).all()

    def search_items(self, query: str, limit: int = 10):
        q = (query or '').strip()
        if not q:
            return []
        # case-insensitive partial match on name
        return (
            self.db.query(Item)
            .filter(func.lower(Item.name).like(f"%{q.lower()}%"))
            .order_by(Item.item_type.asc(), Item.name.asc())
            .limit(limit)
            .all()
        )

    # Prices
    def update_price(self, user_item_id: int, new_price: float):
        itm = self.db.query(UserItem).filter(UserItem.user_item_id == user_item_id).first()
        if itm:
            itm.current_price = new_price
            itm.last_update = datetime.datetime.now()
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

    # Delete
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
        # Allowed updatable fields
        allowed = {
            'amount', 'float_value', 'pattern', 'buy_price'
        }
        for k, v in fields.items():
            if k in allowed and v is not None:
                setattr(rec, k, v)
        rec.last_update = datetime.datetime.now()
        self.db.commit()
        self.db.refresh(rec)
        return rec

    # Totals
    def calculate_portfolio_totals(self, user_id: int):
        # Treat prices as per-unit and multiply by amount
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