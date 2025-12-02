from database import SessionLocal, engine, Base
from models import Market, User, Item, UserItem
from auth import hash_password
import datetime
import re
import sys

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
        user = User(username="student", email="student@vsb.cz", password_hash=hash_password("tajneheslo123"))
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

    # Revolution Case skins
    if revolution:
        print("Kontroluji/seeduji Revolution Case skiny...")
        rev_skins = [
            ("AK-47 | Head Shot", "Covert"),
            ("M4A4 | Temukau", "Covert"),
            ("P2000 | Wicked Sick", "Classified"),
            ("UMP-45 | Wild Child", "Classified"),
            ("AWP | Duality", "Classified"),
            ("M4A1-S | Emphorosaur-S", "Restricted"),
            ("Glock-18 | Umbral Rabbit", "Restricted"),
            ("P90 | Neoqueen", "Restricted"),
            ("R8 Revolver | Banana Cannon", "Restricted"),
            ("MAC-10 | Sakkaku", "Restricted"),
            ("MAG-7 | Insomnia", "Mil-spec"),
            ("MP9 | Featherweight", "Mil-spec"),
            ("SCAR-20 | Fragments", "Mil-spec"),
            ("P250 | Re.built", "Mil-spec"),
            ("MP5-SD | Liquidation", "Mil-spec"),
            ("SG 553 | Cyberforce", "Mil-spec"),
            ("Tec-9 | Rebel", "Mil-spec"),
        ]
        added = 0
        for name, rarity in rev_skins:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'skin').first()
            if exists:
                continue
            itm = Item(
                name=name,
                item_type='skin',
                rarity=rarity,
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=revolution.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            added += 1
        if added:
            db.commit()
            print(f"Přidáno Revolution skinů: {added}")

        # Revolution Case gloves
        print("Kontroluji/seeduji Revolution Case rukavice...")
        rev_gloves = [
            "Sport Gloves | Vice",
            "Driver Gloves | Imperial Plaid",
            "Moto Gloves | Polygon",
            "Sport Gloves | Omega",
            "Hand Wraps | Overprint",
            "Driver Gloves | Racing Green",
            "Sport Gloves | Bronze Morph",
            "Hand Wraps | Cobalt Skulls",
            "Hydra Gloves | Emerald",
            "Hydra Gloves | Mangrove",
            "Moto Gloves | Transport",
            "Hydra Gloves | Case Hardened",
            "Driver Gloves | Overtake",
            "Sport Gloves | Amphibious",
            "Moto Gloves | Turtle",
            "Specialist Gloves | Mogul",
            "Hand Wraps | Duct Tape",
            "Driver Gloves | King Snake",
            "Hydra Gloves | Rattler",
            "Specialist Gloves | Buckshot",
            "Specialist Gloves | Fade",
            "Specialist Gloves | Crimson Web",
            "Hand Wraps | Arboreal",
            "Moto Gloves | POW!",
        ]
        g_added = 0
        for name in rev_gloves:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'skin').first()
            if exists:
                continue
            itm = Item(
                name=name,
                item_type='glove',
                rarity='Knife/Glove',
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=revolution.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            g_added += 1
        if g_added:
            db.commit()
            print(f"Přidáno Revolution rukavic: {g_added}")

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

def update_case_statuses():
    """
    Update drop_type for all cases based on curated lists:
      - active: Revolution, Sealed Genesis Terminal, Kilowatt, Dreams & Nightmares, Recoil Case, Fever Case
      - discontinued: Gallery, Operation Riptide, Operation Broken Fang, Shattered Web, eSports 2014 Summer, eSports 2013 Winter, eSports 2013
      - rare: all remaining cases
    """
    db = SessionLocal()
    # Canonical names as present in DB (seeded above) to ensure slug match
    active_names = [
        "Revolution Case",
        "Sealed Genesis Terminal",
        "Kilowatt Case",
        "Dreams & Nightmares Case",
        "Recoil Case",
        "Fever Case",
    ]
    discontinued_names = [
        "Gallery Case",
        "Operation Riptide Case",
        "Operation Broken Fang Case",
        "Shattered Web Case",
        "eSports 2014 Summer Case",
        "eSports 2013 Winter Case",
        "eSports 2013 Case",
    ]

    def slg(x: str) -> str:
        return slugify(x)

    active_slugs = {slg(n) for n in active_names}
    disc_slugs = {slg(n) for n in discontinued_names}

    cases = db.query(Item).filter(Item.item_type == 'case').all()
    changed = 0
    for c in cases:
        sl = c.slug or slg(c.name or "")
        if sl in active_slugs:
            new_type = 'active'
        elif sl in disc_slugs:
            new_type = 'discontinued'
        else:
            new_type = 'rare'
        if c.drop_type != new_type:
            c.drop_type = new_type
            changed += 1
    if changed:
        db.commit()
    print(f"Case status update done. Changed: {changed}")
    db.close()

if __name__ == "__main__":
    # Simple CLI: python seed.py [seed|update-case-statuses]
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'seed'
    
    def update_case_release_dates():
        db = SessionLocal()
        # Map canonical names to dates (DD. MM. YYYY)
        raw = {
            "Kilowatt Case": "06. 02. 2024",
            "Revolution Case": "09. 02. 2023",
            "Recoil Case": "01. 07. 2022",
            "Dreams & Nightmares Case": "20. 01. 2022",
            "Sealed Genesis Terminal": "17. 09. 2025",
            "Snakebite Case": "03. 05. 2021",
            "Fracture Case": "06. 08. 2020",
            "Prisma 2 Case": "31. 03. 2020",
            "CS20 Case": "18. 10. 2019",
            "Prisma Case": "13. 03. 2019",
            "Danger Zone Case": "06. 12. 2018",
            "Horizon Case": "02. 08. 2018",
            "Clutch Case": "14. 02. 2018",
            "Spectrum 2 Case": "14. 09. 2017",
            "Operation Hydra Case": "23. 05. 2017",
            "Spectrum Case": "15. 03. 2017",
            "Glove Case": "28. 11. 2016",
            "Gamma 2 Case": "18. 08. 2016",
            "Gamma Case": "15. 06. 2016",
            "Chroma 3 Case": "27. 04. 2016",
            "Operation Wildfire Case": "17. 02. 2016",
            "Revolver Case": "08. 12. 2015",
            "Shadow Case": "17. 09. 2015",
            "Falchion Case": "26. 05. 2015",
            "Chroma 2 Case": "15. 04. 2015",
            "Chroma Case": "08. 01. 2015",
            "Operation Vanguard Weapon Case": "11. 11. 2014",
            "Operation Breakout Weapon Case": "01. 07. 2014",
            "Huntsman Weapon Case": "01. 05. 2014",
            "Operation Phoenix Weapon Case": "20. 02. 2014",
            "CS:GO Weapon Case 3": "12. 02. 2014",
            "Winter Offensive Weapon Case": "18. 12. 2013",
            "CS:GO Weapon Case 2": "08. 11. 2013",
            "Operation Bravo Case": "19. 09. 2013",
            "CS:GO Weapon Case": "14. 08. 2013",
            "Fever Case": "31. 03. 2025",
            "Gallery Case": "02. 10. 2024",
            "Operation Riptide Case": "22. 09. 2021",
            "Operation Broken Fang Case": "03. 12. 2020",
            "Shattered Web Case": "18. 11. 2019",
            "eSports 2014 Summer Case": "10. 07. 2014",
            "eSports 2013 Winter Case": "18. 12. 2013",
            "eSports 2013 Case": "14. 08. 2013",
        }
        fmt = "%d. %m. %Y"
        changed = 0
        for name, date_str in raw.items():
            slug = slugify(name)
            itm = db.query(Item).filter(Item.slug == slug, Item.item_type == 'case').first()
            if not itm:
                continue
            try:
                d = datetime.datetime.strptime(date_str, fmt).date()
            except Exception:
                # fallback: try stripping dots
                try:
                    clean = date_str.replace(". ", ".").replace(".", "-")
                    # now like DD-MM-YYYY
                    d = datetime.datetime.strptime(clean, "%d-%m-%Y").date()
                except Exception:
                    continue
            if itm.release_date != d:
                itm.release_date = d
                changed += 1
        if changed:
            db.commit()
        print(f"Case release dates update done. Changed: {changed}")
        db.close()

    if cmd in ('update', 'update-case-statuses', 'update_case_statuses'):
        update_case_statuses()
    elif cmd in ('update-case-dates', 'update_case_dates', 'update-dates'):
        update_case_release_dates()
    elif cmd in ('update-cases', 'update_all_cases'):
        update_case_statuses(); update_case_release_dates()
    else:
        seed_data()