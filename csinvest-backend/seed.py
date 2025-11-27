from database import SessionLocal, engine, Base
from models import Market, User, Item, UserItem
import datetime
import re

# Vytvoření nových tabulek podle aktuálních modelů
Base.metadata.create_all(bind=engine)

def slugify(name: str) -> str:
    s = name.lower()
    s = re.sub(r"[|]+", "", s)          # odstranit |
    s = re.sub(r"[^a-z0-9]+", "-", s)   # nahradit vše mimo a-z0-9 pomlčkou
    s = re.sub(r"-+", "-", s).strip('-')
    return s

def seed_data():
    db = SessionLocal()

    # Market
    if not db.query(Market).first():
        print("Seeduji markety...")
        db.add_all([
            Market(name="Steam", base_url="https://steamcommunity.com/market/listings/730/"),
            Market(name="CSFloat", base_url="https://csfloat.com/item/")
        ])
        db.commit()

    # User
    user = db.query(User).filter(User.username == "student").first()
    if not user:
        print("Seeduji uživatele...")
        user = User(username="student", email="student@vsb.cz", password_hash="tajneheslo123")
        db.add(user)
        db.commit()
        db.refresh(user)

    # Cases (item_type='case')
    print("Kontroluji/seeduju case položky...")
    case_names = [
        "Sealed Genesis Terminal",
        "Fever Case",
        "Gallery Case",
        "Kilowatt Case",
        "Revolution Case",
        "Recoil Case",
        "Dreams & Nightmares Case",
        "Operation Riptide Case",
        "Snakebite Case",
        "Operation Broken Fang Case",
        "Fracture Case",
        "Prisma 2 Case",
        "CS20 Case",
        "Shattered Web Case",
        "Prisma Case",
        "Danger Zone Case",
        "Horizon Case",
        "Clutch Case",
        "Spectrum 2 Case",
        "Operation Hydra Case",
        "Spectrum Case",
        "Glove Case",
        "Gamma 2 Case",
        "Gamma Case",
        "Chroma 3 Case",
        "Operation Wildfire Case",
        "Revolver Case",
        "Shadow Case",
        "Falchion Case",
        "Chroma 2 Case",
        "Chroma Case",
        "Operation Vanguard Weapon Case",
        "eSports 2014 Summer Case",
        "Operation Breakout Weapon Case",
        "Huntsman Weapon Case",
        "Operation Phoenix Weapon Case",
        "CS:GO Weapon Case 3",
        "Winter Offensive Weapon Case",
        "eSports 2013 Winter Case",
        "CS:GO Weapon Case 2",
        "Operation Bravo Case",
        "eSports 2013 Case",
        "CS:GO Weapon Case",
    ]
    created_count = 0
    for name in case_names:
        slug = slugify(name)
        exists = db.query(Item).filter(Item.slug == slug, Item.item_type == 'case').first()
        if exists:
            continue
        lower = name.lower()
        if 'weapon case' in lower or 'operation bravo' in lower or 'esports' in lower or 'winter offensive' in lower:
            drop_type = 'discontinued'
        elif 'phoenix' in lower or 'breakout' in lower or 'vanguard' in lower:
            drop_type = 'rare'
        else:
            drop_type = 'active'
        itm = Item(
            name=name,
            item_type='case',
            release_date=None,
            drop_type=drop_type,
            current_price=None,
            slug=slug,
        )
        db.add(itm)
        created_count += 1
    if created_count:
        db.commit()
        print(f"Přidáno nových case položek: {created_count}")

    revolution = db.query(Item).filter(Item.slug == slugify("Revolution Case")).first()

    # Skins (item_type='skin') referencing case_id or collection
    if not db.query(Item).filter(Item.item_type == 'skin').first():
        print("Seeduji skin položky...")
        skins = [
            Item(name="AK-47 | Redline", item_type="skin", rarity="Classified", wear="Field-Tested", wearValue=0.25, pattern=None, collection="Phoenix", case_id=None, current_price=15.50, slug=slugify("AK-47 Redline")),
            Item(name="AWP | Asiimov", item_type="skin", rarity="Covert", wear="Field-Tested", wearValue=0.28, collection="Phoenix", case_id=None, current_price=90.00, slug=slugify("AWP Asiimov")),
        ]
        db.add_all(skins)
        db.commit()
        for s in skins:
            db.refresh(s)

    # User inventory sample
    if not db.query(UserItem).first():
        print("Seeduji inventář uživatele...")
        ak_redline = db.query(Item).filter(Item.slug == slugify("AK-47 Redline")).first()
        awp_asiimov = db.query(Item).filter(Item.slug == slugify("AWP Asiimov")).first()
        inv = [
            UserItem(user_id=user.user_id, item_id=ak_redline.item_id, buy_price=15.50, current_price=15.50),
            UserItem(user_id=user.user_id, item_id=awp_asiimov.item_id, buy_price=85.00, current_price=90.00),
        ]
        db.add_all(inv)
        db.commit()

    print("✅ Seed hotov (ITEM, USERITEM, CASE).")
    db.close()

if __name__ == "__main__":
    seed_data()