from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# 1. Načtení konfigurace (Singleton vzor pro config)
load_dotenv() # Načte proměnné ze souboru .env
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

# 2. Vytvoření "motoru" pro databázi
if not SQLALCHEMY_DATABASE_URL:
    raise ValueError("Chybí DATABASE_URL v souboru .env!")

engine = create_engine(SQLALCHEMY_DATABASE_URL)

# 3. Vytvoření session (relace) - tohle budeme používat v Repository
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 4. Základní třída pro modely
Base = declarative_base()

# Funkce pro získání DB session (Dependency Injection)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()