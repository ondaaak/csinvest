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

    def add_user_item(self, user_id: int, item_id: int, price: float):
        new_item = UserItem(
            user_id=user_id,
            item_id=item_id,
            buy_price=price,
            current_price=price,
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

    # Totals
    def calculate_portfolio_totals(self, user_id: int):
        total_invested = self.db.query(func.sum(UserItem.buy_price)).filter(UserItem.user_id == user_id).scalar() or 0
        total_value = self.db.query(func.sum(UserItem.current_price)).filter(UserItem.user_id == user_id).scalar() or 0
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