from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import datetime

# 1. Tabulka USER
class User(Base):
    __tablename__ = "USER" # Musí odpovídat názvu v DB (v uvozovkách kvůli rezervovanému slovu)
    
    user_id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    date_created = Column(Date, default=datetime.date.today)

# 2. Tabulka SKIN (Katalog)
class Skin(Base):
    __tablename__ = "SKIN"
    
    skin_id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    type = Column(String)
    rarity = Column(String)
    wear = Column(String)
    wearValue = Column(Numeric(10, 8))
    pattern = Column(Integer)
    collection = Column(String)

# 3. Tabulka USERSKIN (Inventář)
class UserSkin(Base):
    __tablename__ = "USERSKIN"
    
    user_skin_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("USER.user_id")) # FK na USER
    skin_id = Column(Integer, ForeignKey("SKIN.skin_id")) # FK na SKIN
    buy_price = Column(Numeric(10, 2))
    current_price = Column(Numeric(10, 2))
    buy_date = Column(Date, default=datetime.date.today)
    last_update = Column(DateTime, default=datetime.datetime.now)

    # Relace (aby Python uměl "sáhnout" pro detaily skinu)
    skin = relationship("Skin") 

# 4. Tabulka MARKET
class Market(Base):
    __tablename__ = "MARKET"
    
    market_id = Column(Integer, primary_key=True)
    name = Column(String)
    base_url = Column(String)

# 5. Tabulka MARKETPRICE (Historie cen)
class MarketPrice(Base):
    __tablename__ = "MARKETPRICE"
    
    market_id = Column(Integer, ForeignKey("MARKET.market_id"), primary_key=True)
    skin_id = Column(Integer, ForeignKey("SKIN.skin_id"), primary_key=True)
    timestamp = Column(DateTime, primary_key=True) # Složený klíč
    price = Column(Numeric(10, 2))

# 6. Tabulka PORTFOLIOHISTORY
class PortfolioHistory(Base):
    __tablename__ = "PORTFOLIOHISTORY"
    
    history_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("USER.user_id"))
    total_invested = Column(Numeric(10, 2))
    total_value = Column(Numeric(10, 2))
    total_profit = Column(Numeric(10, 2))
    timestamp = Column(DateTime, default=datetime.datetime.now)