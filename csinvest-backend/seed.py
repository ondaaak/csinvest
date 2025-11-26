from database import SessionLocal, engine, Base
from models import Market, User, Skin, UserSkin
from sqlalchemy.orm import Session
import datetime

# 1. Vytvoření tabulek (pokud náhodou neexistují, sichr je sichr)
Base.metadata.create_all(bind=engine)

def seed_data():
    db = SessionLocal()

    # --- A. Vytvoření Marketů ---
    if not db.query(Market).first():
        print("Vytvářím markety...")
        m1 = Market(name="Steam", base_url="https://steamcommunity.com/market/listings/730/")
        m2 = Market(name="CSFloat", base_url="https://csfloat.com/item/")
        db.add_all([m1, m2])
        db.commit()

    # --- B. Vytvoření Uživatele ---
    test_user = db.query(User).filter(User.username == "student").first()
    if not test_user:
        print("Vytvářím testovacího uživatele...")
        test_user = User(
            username="student", 
            email="student@vsb.cz", 
            password_hash="tajneheslo123" # Ve speedrunu neřešíme hashování
        )
        db.add(test_user)
        db.commit()
        db.refresh(test_user) # Abychom dostali zpátky jeho ID

    # --- C. Vytvoření Skinů (Katalog) ---
    if not db.query(Skin).first():
        print("Vytvářím katalog skinů...")
        skins = [
            Skin(name="AK-47 | Redline", type="Rifle", rarity="Classified", wear="Field-Tested", wearValue=0.25, collection="Phoenix"),
            Skin(name="AWP | Asiimov", type="Sniper", rarity="Covert", wear="Field-Tested", wearValue=0.28, collection="Phoenix"),
            Skin(name="Glock-18 | Fade", type="Pistol", rarity="Restricted", wear="Factory New", wearValue=0.01, collection="Assault"),
            Skin(name="Karambit | Doppler", type="Knife", rarity="Covert", wear="Factory New", wearValue=0.03, collection="Chroma 2"),
        ]
        db.add_all(skins)
        db.commit()

    # --- D. Nákup skinů pro uživatele (Inventář) ---
    # Uživatel si koupí AK-47 a AWP
    ak47 = db.query(Skin).filter(Skin.name == "AK-47 | Redline").first()
    awp = db.query(Skin).filter(Skin.name == "AWP | Asiimov").first()

    if not db.query(UserSkin).first():
        print("Nakupuji skiny do portfolia...")
        portfolio = [
            UserSkin(user_id=test_user.user_id, skin_id=ak47.skin_id, buy_price=15.50, current_price=15.50),
            UserSkin(user_id=test_user.user_id, skin_id=awp.skin_id, buy_price=85.00, current_price=90.00), # Už trochu vydělal
        ]
        db.add_all(portfolio)
        db.commit()

    print("✅ Hotovo! Databáze je naplněna testovacími daty.")
    db.close()

if __name__ == "__main__":
    seed_data()