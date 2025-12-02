from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from database import Base
import datetime

class User(Base):
    __tablename__ = "USER"
    user_id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    date_created = Column(Date, default=datetime.date.today)

class Item(Base):
    __tablename__ = "ITEM"
    item_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    item_type = Column(String, index=True) 
    rarity = Column(String)                 
    wear = Column(String)                   
    wearValue = Column(Numeric(10, 8))     
    pattern = Column(Integer)               
    collection = Column(String)            
    case_id = Column(Integer, ForeignKey("ITEM.item_id"))  
    release_date = Column(Date)             
    drop_type = Column(String, index=True) 
    current_price = Column(Numeric(10, 2))
    last_update = Column(DateTime, default=datetime.datetime.now)
    slug = Column(String, unique=True, index=True)

    case = relationship("Item", remote_side=[item_id], uselist=False) 

class UserItem(Base):
    __tablename__ = "USERITEM"
    user_item_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("USER.user_id"))
    item_id = Column(Integer, ForeignKey("ITEM.item_id"))
    amount = Column(Integer, default=1)
    float_value = Column(Numeric(10, 8))
    pattern = Column(Integer)
    buy_price = Column(Numeric(10, 2))
    current_price = Column(Numeric(10, 2))
    buy_date = Column(Date, default=datetime.date.today)
    last_update = Column(DateTime, default=datetime.datetime.now)
    item = relationship("Item")

class Market(Base):
    __tablename__ = "MARKET"
    market_id = Column(Integer, primary_key=True)
    name = Column(String)
    base_url = Column(String)

class MarketPrice(Base):
    __tablename__ = "MARKETPRICE"
    market_id = Column(Integer, ForeignKey("MARKET.market_id"), primary_key=True)
    item_id = Column(Integer, ForeignKey("ITEM.item_id"), primary_key=True)
    timestamp = Column(DateTime, primary_key=True)
    price = Column(Numeric(10, 2))

class PortfolioHistory(Base):
    __tablename__ = "PORTFOLIOHISTORY"
    history_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("USER.user_id"))
    total_invested = Column(Numeric(10, 2))
    total_value = Column(Numeric(10, 2))
    total_profit = Column(Numeric(10, 2))
    timestamp = Column(DateTime, default=datetime.datetime.now)