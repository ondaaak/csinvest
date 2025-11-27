from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from database import Base
import datetime

# USER
class User(Base):
    __tablename__ = "USER"
    user_id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    date_created = Column(Date, default=datetime.date.today)

# ITEM (unified for skins, cases, stickers, etc.)
class Item(Base):
    __tablename__ = "ITEM"
    item_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    item_type = Column(String, index=True)  # skin | case | sticker | medal | other
    rarity = Column(String)                 # optional per type
    wear = Column(String)                   # only for skin
    wearValue = Column(Numeric(10, 8))      # only for skin
    pattern = Column(Integer)               # only for skin
    collection = Column(String)             # for collection-origin skins
    case_id = Column(Integer, ForeignKey("ITEM.item_id"))  # FK referencing a case item
    release_date = Column(Date)             # for cases or event items
    drop_type = Column(String, index=True)  # active | rare | discontinued (replaces active_drop_pool)
    current_price = Column(Numeric(10, 2))
    last_update = Column(DateTime, default=datetime.datetime.now)
    slug = Column(String, unique=True, index=True)

    case = relationship("Item", remote_side=[item_id], uselist=False)  # if this is a skin, links to its case

# USERITEM (inventory)
class UserItem(Base):
    __tablename__ = "USERITEM"
    user_item_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("USER.user_id"))
    item_id = Column(Integer, ForeignKey("ITEM.item_id"))
    buy_price = Column(Numeric(10, 2))
    current_price = Column(Numeric(10, 2))
    buy_date = Column(Date, default=datetime.date.today)
    last_update = Column(DateTime, default=datetime.datetime.now)
    item = relationship("Item")

# MARKET
class Market(Base):
    __tablename__ = "MARKET"
    market_id = Column(Integer, primary_key=True)
    name = Column(String)
    base_url = Column(String)

# MARKETPRICE
class MarketPrice(Base):
    __tablename__ = "MARKETPRICE"
    market_id = Column(Integer, ForeignKey("MARKET.market_id"), primary_key=True)
    item_id = Column(Integer, ForeignKey("ITEM.item_id"), primary_key=True)
    timestamp = Column(DateTime, primary_key=True)
    price = Column(Numeric(10, 2))

# PORTFOLIOHISTORY
class PortfolioHistory(Base):
    __tablename__ = "PORTFOLIOHISTORY"
    history_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("USER.user_id"))
    total_invested = Column(Numeric(10, 2))
    total_value = Column(Numeric(10, 2))
    total_profit = Column(Numeric(10, 2))
    timestamp = Column(DateTime, default=datetime.datetime.now)