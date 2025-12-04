from database import SessionLocal, engine, Base
from models import Market, User, Item, UserItem
from auth import hash_password
import datetime
import re
import sys

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
    fever = db.query(Item).filter(Item.slug == slugify("Fever Case")).first()
    gallery = db.query(Item).filter(Item.slug == slugify("Gallery Case")).first()
    sealed_genesis = db.query(Item).filter(Item.slug == slugify("Sealed Genesis Terminal")).first()
    kilowatt = db.query(Item).filter(Item.slug == slugify("Kilowatt Case")).first()
    recoil = db.query(Item).filter(Item.slug == slugify("Recoil Case")).first()
    dreams = db.query(Item).filter(Item.slug == slugify("Dreams & Nightmares Case")).first()
    riptide = db.query(Item).filter(Item.slug == slugify("Operation Riptide Case")).first()
    broken_fang = db.query(Item).filter(Item.slug == slugify("Operation Broken Fang Case")).first()
    fracture = db.query(Item).filter(Item.slug == slugify("Fracture Case")).first()
    prisma2 = db.query(Item).filter(Item.slug == slugify("Prisma 2 Case")).first()
    shattered_web = db.query(Item).filter(Item.slug == slugify("Shattered Web Case")).first()
    cs20 = db.query(Item).filter(Item.slug == slugify("CS20 Case")).first()
    prisma = db.query(Item).filter(Item.slug == slugify("Prisma Case")).first()
    danger_zone = db.query(Item).filter(Item.slug == slugify("Danger Zone Case")).first()
    horizon = db.query(Item).filter(Item.slug == slugify("Horizon Case")).first()
    clutch = db.query(Item).filter(Item.slug == slugify("Clutch Case")).first()
    spectrum2 = db.query(Item).filter(Item.slug == slugify("Spectrum 2 Case")).first()
    snakebite = db.query(Item).filter(Item.slug == slugify("Snakebite Case")).first()
    hydra = db.query(Item).filter(Item.slug == slugify("Operation Hydra Case")).first()
    spectrum = db.query(Item).filter(Item.slug == slugify("Spectrum Case")).first()
    glove_case = db.query(Item).filter(Item.slug == slugify("Glove Case")).first()
    gamma2_case = db.query(Item).filter(Item.slug == slugify("Gamma 2 Case")).first()
    gamma_case = db.query(Item).filter(Item.slug == slugify("Gamma Case")).first()

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
            # gloves may have been previously seeded; treat duplicates safely
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'glove').first()
            if exists:
                if exists.case_id != revolution.item_id:
                    exists.case_id = revolution.item_id
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

    # Fever Case skins
    if fever:
        print("Kontroluji/seeduji Fever Case skiny...")
        fever_skins = [
            # Covert
            ("FAMAS | Bad Trip", "Covert"),
            ("AWP | Printstream", "Covert"),
            # Classified
            ("AK-47 | Searing Rage", "Classified"),
            ("Glock-18 | Shinobu", "Classified"),
            ("UMP-45 | K.O. Factory", "Classified"),
            # Restricted
            ("Desert Eagle | Serpent Strike", "Restricted"),
            ("Zeus x27 | Tosai", "Restricted"),
            ("Galil AR | Control", "Restricted"),
            ("P90 | Wave Breaker", "Restricted"),
            ("Nova | Rising Sun", "Restricted"),
            # Mil-Spec
            ("USP-S | PC-GRN", "Mil-spec"),
            ("M4A4 | Choppa", "Mil-spec"),
            ("SSG 08 | Memorial", "Mil-spec"),
            ("MP9 | Nexus", "Mil-spec"),
            ("P2000 | Sure Grip", "Mil-spec"),
            ("XM1014 | Mockingbird", "Mil-spec"),
            ("MAG-7 | Resupply", "Mil-spec"),
        ]
        f_added = 0
        for name, rarity in fever_skins:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'skin').first()
            if exists:
                if exists.case_id != fever.item_id:
                    exists.case_id = fever.item_id
                continue
            itm = Item(
                name=name,
                item_type='skin',
                rarity=rarity,
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=fever.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            f_added += 1
        if f_added:
            db.commit()
            print(f"Přidáno Fever skinů: {f_added}")

        # Fever Case knives
        print("Kontroluji/seeduji Fever Case nože...")
        fever_knives = [
            # Skeleton Knife variants
            "Skeleton Knife | Tiger Tooth",
            "Skeleton Knife | Damascus Steel",
            "Skeleton Knife | Ultraviolet",
            "Skeleton Knife | Marble Fade",
            "Skeleton Knife | Doppler",
            "Skeleton Knife | Doppler Sapphire",
            "Skeleton Knife | Doppler Ruby",
            "Skeleton Knife | Doppler Phase 4",
            "Skeleton Knife | Doppler Phase 3",
            "Skeleton Knife | Doppler Phase 2",
            "Skeleton Knife | Doppler Phase 1",
            "Skeleton Knife | Doppler Black Pearl",
            "Skeleton Knife | Rust Coat",
            # Survival Knife variants
            "Survival Knife | Tiger Tooth",
            "Survival Knife | Doppler",
            "Survival Knife | Ultraviolet",
            "Survival Knife | Damascus Steel",
            "Survival Knife | Rust Coat",
            "Survival Knife | Marble Fade",
            "Survival Knife | Doppler Sapphire",
            "Survival Knife | Doppler Ruby",
            "Survival Knife | Doppler Phase 4",
            "Survival Knife | Doppler Phase 3",
            "Survival Knife | Doppler Phase 2",
            "Survival Knife | Doppler Phase 1",
            "Survival Knife | Doppler Black Pearl",
            # Paracord Knife variants
            "Paracord Knife | Doppler",
            "Paracord Knife | Tiger Tooth",
            "Paracord Knife | Marble Fade",
            "Paracord Knife | Damascus Steel",
            "Paracord Knife | Rust Coat",
            "Paracord Knife | Ultraviolet",
            "Paracord Knife | Doppler Sapphire",
            "Paracord Knife | Doppler Ruby",
            "Paracord Knife | Doppler Phase 4",
            "Paracord Knife | Doppler Phase 3",
            "Paracord Knife | Doppler Phase 2",
            "Paracord Knife | Doppler Phase 1",
            "Paracord Knife | Doppler Black Pearl",
            # Nomad Knife variants
            "Nomad Knife | Ultraviolet",
            "Nomad Knife | Marble Fade",
            "Nomad Knife | Doppler",
            "Nomad Knife | Tiger Tooth",
            "Nomad Knife | Damascus Steel",
            "Nomad Knife | Rust Coat",
            "Nomad Knife | Doppler Sapphire",
            "Nomad Knife | Doppler Ruby",
            "Nomad Knife | Doppler Phase 4",
        ]
        fk_added = 0
        for name in fever_knives:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'knife').first()
            if exists:
                if exists.case_id != fever.item_id:
                    exists.case_id = fever.item_id
                continue
            itm = Item(
                name=name,
                item_type='knife',
                rarity='Knife',
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=fever.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            fk_added += 1
        if fk_added:
            db.commit()
            print(f"Přidáno Fever nožů: {fk_added}")

    # Gallery Case skins
    if gallery:
        print("Kontroluji/seeduji Gallery Case skiny...")
        gallery_skins = [
            # Covert
            ("M4A1-S | Vaporwave", "Covert"),
            ("Glock-18 | Gold Toof", "Covert"),
            # Classified
            ("AK-47 | The Outsiders", "Classified"),
            ("P250 | Epicenter", "Classified"),
            ("UMP-45 | Neo-Noir", "Classified"),
            # Restricted
            ("M4A4 | Turbine", "Restricted"),
            ("MAC-10 | Saibā Oni", "Restricted"),
            ("SSG 08 | Rapid Transit", "Restricted"),
            ("Dual Berettas | Hydro Strike", "Restricted"),
            ("P90 | Randy Rush", "Restricted"),
            # Mil-Spec
            ("Desert Eagle | Calligraffiti", "Mil-spec"),
            ("USP-S | 27", "Mil-spec"),
            ("AUG | Luxe Trim", "Mil-spec"),
            ("R8 Revolver | Tango", "Mil-spec"),
            ("MP5-SD | Statics", "Mil-spec"),
            ("SCAR-20 | Trail Blazer", "Mil-spec"),
            ("M249 | Hypnosis", "Mil-spec"),
        ]
        g_added2 = 0
        for name, rarity in gallery_skins:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'skin').first()
            if exists:
                if exists.case_id != gallery.item_id:
                    exists.case_id = gallery.item_id
                continue
            itm = Item(
                name=name,
                item_type='skin',
                rarity=rarity,
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=gallery.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            g_added2 += 1
        if g_added2:
            db.commit()
            print(f"Přidáno Gallery skinů: {g_added2}")

        # Gallery Case knives
        print("Kontroluji/seeduji Gallery Case nože...")
        gallery_knives = [
            "Kukri Knife | Slaughter",
            "Kukri Knife | Case Hardened",
            "Kukri Knife | Blue Steel",
            "Kukri Knife | Stained",
            "Kukri Knife | Scorched",
            "Kukri Knife | Fade",
            "Kukri Knife | Safari Mesh",
            "Kukri Knife | Boreal Forest",
            "Kukri Knife | Urban Masked",
            "Kukri Knife | Night Stripe",
            "Kukri Knife | Crimson Web",
            "Kukri Knife | Vanilla",
            "Kukri Knife | Forest DDPAT",
        ]
        gk_added = 0
        for name in gallery_knives:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'knife').first()
            if exists:
                if exists.case_id != gallery.item_id:
                    exists.case_id = gallery.item_id
                continue
            itm = Item(
                name=name,
                item_type='knife',
                rarity='Knife',
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=gallery.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            gk_added += 1
        if gk_added:
            db.commit()
            print(f"Přidáno Gallery nožů: {gk_added}")

    # Sealed Genesis Terminal skins
    if sealed_genesis:
        print("Kontroluji/seeduji Sealed Genesis Terminal skiny...")
        sgt_skins = [
            ("AK-47 | The Oligarch", "Covert"),
            ("M4A4 | Full Throttle", "Covert"),
            ("AWP | Ice Coaled", "Classified"),
            ("MP7 | Smoking Kills", "Classified"),
            ("Glock-18 | Mirror Mosaic", "Classified"),
            ("M4A1-S | Liquidation", "Restricted"),
            ("UMP-45 | Continuum", "Restricted"),
            ("MAC-10 | Cat Fight", "Restricted"),
            ("Dual Berettas | Angel Eyes", "Restricted"),
            ("Nova | Ocular", "Restricted"),
            ("P2000 | Red Wing", "Mil-spec"),
            ("P250 | Bullfrog", "Mil-spec"),
            ("MP5-SD | Focus", "Mil-spec"),
            ("AUG | Trigger Discipline", "Mil-spec"),
            ("MP9 | Broken Record", "Mil-spec"),
            ("SCAR-20 | Caged", "Mil-spec"),
            ("MAG-7 | MAGnitude", "Mil-spec"),
        ]
        s_added = 0
        for name, rarity in sgt_skins:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'skin').first()
            if exists:
                if exists.case_id != sealed_genesis.item_id:
                    exists.case_id = sealed_genesis.item_id
                continue
            itm = Item(
                name=name,
                item_type='skin',
                rarity=rarity,
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=sealed_genesis.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            s_added += 1
        if s_added:
            db.commit()
            print(f"Přidáno Sealed Genesis Terminal skinů: {s_added}")

    # Kilowatt Case skins
    if kilowatt:
        print("Kontroluji/seeduji Kilowatt Case skiny...")
        kilo_skins = [
            ("AK-47 | Inheritance", "Covert"),
            ("AWP | Chrome Cannon", "Covert"),
            ("M4A1-S | Black Lotus", "Classified"),
            ("USP-S | Jawbreaker", "Classified"),
            ("Zeus x27 | Olympus", "Classified"),
            ("M4A4 | Etch Lord", "Restricted"),
            ("Glock-18 | Block-18", "Restricted"),
            ("MP7 | Just Smile", "Restricted"),
            ("Sawed-Off | Analog Input", "Restricted"),
            ("Five-SeveN | Hybrid", "Restricted"),
            ("MAC-10 | Light Box", "Mil-spec"),
            ("Tec-9 | Slag", "Mil-spec"),
            ("Nova | Dark Sigil", "Mil-spec"),
            ("SSG 08 | Dezastre", "Mil-spec"),
            ("Dual Berettas | Hideout", "Mil-spec"),
            ("UMP-45 | Motorized", "Mil-spec"),
            ("XM1014 | Irezumi", "Mil-spec"),
        ]
        k_added = 0
        for name, rarity in kilo_skins:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'skin').first()
            if exists:
                if exists.case_id != kilowatt.item_id:
                    exists.case_id = kilowatt.item_id
                continue
            itm = Item(
                name=name,
                item_type='skin',
                rarity=rarity,
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=kilowatt.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            k_added += 1
        if k_added:
            db.commit()
            print(f"Přidáno Kilowatt skinů: {k_added}")

        # Kilowatt Case knives
        print("Kontroluji/seeduji Kilowatt Case nože...")
        kilo_knives = [
            "Kukri Knife | Slaughter",
            "Kukri Knife | Case Hardened",
            "Kukri Knife | Blue Steel",
            "Kukri Knife | Stained",
            "Kukri Knife | Scorched",
            "Kukri Knife | Fade",
            "Kukri Knife | Safari Mesh",
            "Kukri Knife | Boreal Forest",
            "Kukri Knife | Urban Masked",
            "Kukri Knife | Night Stripe",
            "Kukri Knife | Crimson Web",
            "Kukri Knife | Vanilla",
            "Kukri Knife | Forest DDPAT",
        ]
        kk_added = 0
        for name in kilo_knives:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'knife').first()
            if exists:
                if exists.case_id != kilowatt.item_id:
                    exists.case_id = kilowatt.item_id
                continue
            itm = Item(
                name=name,
                item_type='knife',
                rarity='Knife',
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=kilowatt.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            kk_added += 1
        if kk_added:
            db.commit()
            print(f"Přidáno Kilowatt nožů: {kk_added}")

    # Recoil Case skins
    if recoil:
        print("Kontroluji/seeduji Recoil Case skiny...")
        recoil_skins = [
            # Covert
            ("AWP | Chromatic Aberration", "Covert"),
            ("USP-S | Printstream", "Covert"),
            # Classified
            ("AK-47 | Ice Coaled", "Classified"),
            ("Sawed-Off | Kiss♥Love", "Classified"),
            ("P250 | Visions", "Classified"),
            # Restricted
            ("Dual Berettas | Flora Carnivora", "Restricted"),
            ("SG 553 | Dragon Tech", "Restricted"),
            ("R8 Revolver | Crazy 8", "Restricted"),
            ("P90 | Vent Rush", "Restricted"),
            ("M249 | Downtown", "Restricted"),
            # Mil-Spec
            ("Glock-18 | Winterized", "Mil-spec"),
            ("M4A4 | Poly Mag", "Mil-spec"),
            ("FAMAS | Meow 36", "Mil-spec"),
            ("Galil AR | Destroyer", "Mil-spec"),
            ("MAC-10 | Monkeyflage", "Mil-spec"),
            ("UMP-45 | Roadblock", "Mil-spec"),
            ("Negev | Drop Me", "Mil-spec"),
        ]
        r_added = 0
        for name, rarity in recoil_skins:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'skin').first()
            if exists:
                if exists.case_id != recoil.item_id:
                    exists.case_id = recoil.item_id
                continue
            itm = Item(
                name=name,
                item_type='skin',
                rarity=rarity,
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=recoil.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            r_added += 1
        if r_added:
            db.commit()
            print(f"Přidáno Recoil skinů: {r_added}")

    # Dreams & Nightmares Case skins
    if dreams:
        print("Kontroluji/seeduji Dreams & Nightmares Case skiny...")
        dnn_skins = [
            # Covert
            ("MP9 | Starlight Protector", "Covert"),
            ("AK-47 | Nightwish", "Covert"),
            # Classified
            ("MP7 | Abyssal Apparition", "Classified"),
            ("FAMAS | Rapid Eye Movement", "Classified"),
            ("Dual Berettas | Melondrama", "Classified"),
            # Restricted
            ("M4A1-S | Night Terror", "Restricted"),
            ("USP-S | Ticket to Hell", "Restricted"),
            ("PP-Bizon | Space Cat", "Restricted"),
            ("XM1014 | Zombie Offensive", "Restricted"),
            ("G3SG1 | Dream Glade", "Restricted"),
            # Mil-Spec
            ("Five-SeveN | Scrawl", "Mil-spec"),
            ("SCAR-20 | Poultrygeist", "Mil-spec"),
            ("MAC-10 | Ensnared", "Mil-spec"),
            ("MP5-SD | Necro Jr.", "Mil-spec"),
            ("MAG-7 | Foresight", "Mil-spec"),
            ("Sawed-Off | Spirit Board", "Mil-spec"),
            ("P2000 | Lifted Spirits", "Mil-spec"),
        ]
        d_added = 0
        for name, rarity in dnn_skins:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'skin').first()
            if exists:
                if exists.case_id != dreams.item_id:
                    exists.case_id = dreams.item_id
                continue
            itm = Item(
                name=name,
                item_type='skin',
                rarity=rarity,
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=dreams.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            d_added += 1
        if d_added:
            db.commit()
            print(f"Přidáno Dreams & Nightmares skinů: {d_added}")

        print("Kontroluji/seeduji Dreams & Nightmares Case nože...")
        dnn_knives = [
            # Butterfly Knife
            ("Butterfly Knife | Bright Water"),
            ("Butterfly Knife | Autotronic"),
            ("Butterfly Knife | Freehand"),
            ("Butterfly Knife | Lore"),
            ("Butterfly Knife | Black Laminate"),
            ("Butterfly Knife | Gamma Doppler Phase 4"),
            ("Butterfly Knife | Gamma Doppler Phase 3"),
            ("Butterfly Knife | Gamma Doppler Phase 2"),
            ("Butterfly Knife | Gamma Doppler Phase 1"),
            # Falchion Knife
            ("Falchion Knife | Gamma Doppler"),
            ("Falchion Knife | Lore"),
            ("Falchion Knife | Bright Water"),
            ("Falchion Knife | Freehand"),
            ("Falchion Knife | Autotronic"),
            ("Falchion Knife | Black Laminate"),
            ("Falchion Knife | Gamma Doppler Phase 4"),
            ("Falchion Knife | Gamma Doppler Phase 3"),
            ("Falchion Knife | Gamma Doppler Phase 2"),
            ("Falchion Knife | Gamma Doppler Phase 1"),
            ("Falchion Knife | Gamma Doppler Emerald"),
            # Bowie Knife
            ("Bowie Knife | Gamma Doppler"),
            ("Bowie Knife | Lore"),
            ("Bowie Knife | Freehand"),
            ("Bowie Knife | Autotronic"),
            ("Bowie Knife | Bright Water"),
            ("Bowie Knife | Black Laminate"),
            # Shadow Daggers
            ("Shadow Daggers | Gamma Doppler"),
            ("Shadow Daggers | Lore"),
            ("Shadow Daggers | Freehand"),
            ("Shadow Daggers | Black Laminate"),
            ("Shadow Daggers | Autotronic"),
            ("Shadow Daggers | Gamma Doppler Phase 4"),
            ("Shadow Daggers | Gamma Doppler Phase 3"),
            ("Shadow Daggers | Gamma Doppler Phase 2"),
            ("Shadow Daggers | Gamma Doppler Phase 1"),
            ("Shadow Daggers | Gamma Doppler Emerald"),
            # Huntsman Knife
            ("Huntsman Knife | Autotronic"),
            ("Huntsman Knife | Gamma Doppler"),
            ("Huntsman Knife | Lore"),
            ("Huntsman Knife | Freehand"),
            ("Huntsman Knife | Bright Water"),
            ("Huntsman Knife | Black Laminate"),
            ("Huntsman Knife | Gamma Doppler Phase 4"),
            ("Huntsman Knife | Gamma Doppler Phase 3"),
            ("Huntsman Knife | Gamma Doppler Phase 2"),
            ("Huntsman Knife | Gamma Doppler Phase 1"),
            ("Huntsman Knife | Gamma Doppler Emerald"),
        ]
        dk_added = 0
        for name in dnn_knives:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'knife').first()
            if exists:
                if exists.case_id != dreams.item_id:
                    exists.case_id = dreams.item_id
                continue
            itm = Item(
                name=name,
                item_type='knife',
                rarity='Covert',
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=dreams.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            dk_added += 1
        if dk_added:
            db.commit()
            print(f"Přidáno Dreams & Nightmares nožů: {dk_added}")

    # Operation Riptide Case skins
    if riptide:
        print("Kontroluji/seeduji Operation Riptide Case skiny...")
        riptide_skins = [
            # Covert
            ("AK-47 | Leet Museo", "Covert"),
            ("Desert Eagle | Ocean Drive", "Covert"),
            # Classified
            ("SSG 08 | Turbo Peek", "Classified"),
            ("Glock-18 | Snack Attack", "Classified"),
            ("MAC-10 | Toybox", "Classified"),
            # Restricted
            ("M4A4 | Spider Lily", "Restricted"),
            ("MP9 | Mount Fuji", "Restricted"),
            ("FAMAS | ZX Spectron", "Restricted"),
            ("Five-SeveN | Boost Protocol", "Restricted"),
            ("MAG-7 | BI83 Spectrum", "Restricted"),
            # Mil-Spec
            ("USP-S | Black Lotus", "Mil-spec"),
            ("XM1014 | Watchdog", "Mil-spec"),
            ("AUG | Plague", "Mil-spec"),
            ("PP-Bizon | Lumen", "Mil-spec"),
            ("G3SG1 | Keeping Tabs", "Mil-spec"),
            ("Dual Berettas | Tread", "Mil-spec"),
            ("MP7 | Guerrilla", "Mil-spec"),
        ]
        rip_added = 0
        for name, rarity in riptide_skins:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'skin').first()
            if exists:
                if exists.case_id != riptide.item_id:
                    exists.case_id = riptide.item_id
                continue
            itm = Item(
                name=name,
                item_type='skin',
                rarity=rarity,
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=riptide.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            rip_added += 1
        if rip_added:
            db.commit()
            print(f"Přidáno Operation Riptide skinů: {rip_added}")

        print("Kontroluji/seeduji Operation Riptide Case nože...")
        riptide_knives = [
            # Butterfly Knife
            ("Butterfly Knife | Bright Water"),
            ("Butterfly Knife | Autotronic"),
            ("Butterfly Knife | Freehand"),
            ("Butterfly Knife | Lore"),
            ("Butterfly Knife | Black Laminate"),
            ("Butterfly Knife | Gamma Doppler Phase 4"),
            ("Butterfly Knife | Gamma Doppler Phase 3"),
            ("Butterfly Knife | Gamma Doppler Phase 2"),
            ("Butterfly Knife | Gamma Doppler Phase 1"),
            # Falchion Knife
            ("Falchion Knife | Gamma Doppler"),
            ("Falchion Knife | Lore"),
            ("Falchion Knife | Bright Water"),
            ("Falchion Knife | Freehand"),
            ("Falchion Knife | Autotronic"),
            ("Falchion Knife | Black Laminate"),
            ("Falchion Knife | Gamma Doppler Phase 4"),
            ("Falchion Knife | Gamma Doppler Phase 3"),
            ("Falchion Knife | Gamma Doppler Phase 2"),
            ("Falchion Knife | Gamma Doppler Phase 1"),
            ("Falchion Knife | Gamma Doppler Emerald"),
            # Bowie Knife
            ("Bowie Knife | Gamma Doppler"),
            ("Bowie Knife | Lore"),
            ("Bowie Knife | Freehand"),
            ("Bowie Knife | Autotronic"),
            ("Bowie Knife | Bright Water"),
            ("Bowie Knife | Black Laminate"),
            # Shadow Daggers
            ("Shadow Daggers | Gamma Doppler"),
            ("Shadow Daggers | Lore"),
            ("Shadow Daggers | Freehand"),
            ("Shadow Daggers | Black Laminate"),
            ("Shadow Daggers | Autotronic"),
            ("Shadow Daggers | Gamma Doppler Phase 4"),
            ("Shadow Daggers | Gamma Doppler Phase 3"),
            ("Shadow Daggers | Gamma Doppler Phase 2"),
            ("Shadow Daggers | Gamma Doppler Phase 1"),
            ("Shadow Daggers | Gamma Doppler Emerald"),
            # Huntsman Knife
            ("Huntsman Knife | Autotronic"),
            ("Huntsman Knife | Gamma Doppler"),
            ("Huntsman Knife | Lore"),
            ("Huntsman Knife | Freehand"),
            ("Huntsman Knife | Bright Water"),
            ("Huntsman Knife | Black Laminate"),
            ("Huntsman Knife | Gamma Doppler Phase 4"),
            ("Huntsman Knife | Gamma Doppler Phase 3"),
            ("Huntsman Knife | Gamma Doppler Phase 2"),
            ("Huntsman Knife | Gamma Doppler Phase 1"),
            ("Huntsman Knife | Gamma Doppler Emerald"),
        ]
        rk_added = 0
        for name in riptide_knives:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'knife').first()
            if exists:
                if exists.case_id != riptide.item_id:
                    exists.case_id = riptide.item_id
                continue
            itm = Item(
                name=name,
                item_type='knife',
                rarity='Covert',
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=riptide.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            rk_added += 1
        if rk_added:
            db.commit()
            print(f"Přidáno Operation Riptide nožů: {rk_added}")

    # Fracture Case skins
    if fracture:
        print("Kontroluji/seeduji Fracture Case skiny...")
        fracture_skins = [
            # Covert
            ("AK-47 | Legion of Anubis", "Covert"),
            ("Desert Eagle | Printstream", "Covert"),
            # Classified
            ("M4A4 | Tooth Fairy", "Classified"),
            ("Glock-18 | Vogue", "Classified"),
            ("XM1014 | Entombed", "Classified"),
            # Restricted
            ("MAG-7 | Monster Call", "Restricted"),
            ("Galil AR | Connexion", "Restricted"),
            ("MAC-10 | Allure", "Restricted"),
            ("Tec-9 | Brother", "Restricted"),
            ("MP5-SD | Kitbash", "Restricted"),
            # Mil-Spec
            ("P250 | Cassette", "Mil-spec"),
            ("SSG 08 | Mainframe 001", "Mil-spec"),
            ("SG 553 | Ol' Rusty", "Mil-spec"),
            ("PP-Bizon | Runic", "Mil-spec"),
            ("P2000 | Gnarled", "Mil-spec"),
            ("P90 | Freight", "Mil-spec"),
            ("Negev | Ultralight", "Mil-spec"),
        ]
        fr_added = 0
        for name, rarity in fracture_skins:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'skin').first()
            if exists:
                if exists.case_id != fracture.item_id:
                    exists.case_id = fracture.item_id
                continue
            itm = Item(
                name=name,
                item_type='skin',
                rarity=rarity,
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=fracture.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            fr_added += 1
        if fr_added:
            db.commit()
            print(f"Přidáno Fracture skinů: {fr_added}")

        print("Kontroluji/seeduji Fracture Case nože...")
        fracture_knives = [
            ("Skeleton Knife | Slaughter"),
            ("Skeleton Knife | Vanilla"),
            ("Skeleton Knife | Stained"),
            ("Paracord Knife | Vanilla"),
            ("Nomad Knife | Vanilla"),
            ("Skeleton Knife | Crimson Web"),
            ("Skeleton Knife | Case Hardened"),
            ("Paracord Knife | Case Hardened"),
            ("Paracord Knife | Urban Masked"),
            ("Skeleton Knife | Urban Masked"),
            ("Nomad Knife | Fade"),
            ("Paracord Knife | Safari Mesh"),
            ("Survival Knife | Fade"),
            ("Nomad Knife | Crimson Web"),
            ("Survival Knife | Vanilla"),
            ("Paracord Knife | Crimson Web"),
            ("Nomad Knife | Forest DDPAT"),
        ]
        fk_added = 0
        for name in fracture_knives:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'knife').first()
            if exists:
                if exists.case_id != fracture.item_id:
                    exists.case_id = fracture.item_id
                continue
            itm = Item(
                name=name,
                item_type='knife',
                rarity='Knife',
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=fracture.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            fk_added += 1
        if fk_added:
            db.commit()
            print(f"Přidáno Fracture nožů: {fk_added}")

    # Prisma 2 Case skins
    if prisma2:
        print("Kontroluji/seeduji Prisma 2 Case skiny...")
        prisma2_skins = [
            # Covert
            ("Glock-18 | Bullet Queen", "Covert"),
            ("M4A1-S | Player Two", "Covert"),
            # Classified
            ("AK-47 | Phantom Disruptor", "Classified"),
            ("MAC-10 | Disco Tech", "Classified"),
            ("MAG-7 | Justice", "Classified"),
            # Restricted
            ("SSG 08 | Fever Dream", "Restricted"),
            ("SG 553 | Darkwing", "Restricted"),
            ("P2000 | Acid Etched", "Restricted"),
            ("Sawed-Off | Apocalypto", "Restricted"),
            ("SCAR-20 | Enforcer", "Restricted"),
            # Mil-Spec
            ("AWP | Capillary", "Mil-spec"),
            ("Desert Eagle | Blue Ply", "Mil-spec"),
            ("AUG | Tom Cat", "Mil-spec"),
            ("Negev | Prototype", "Mil-spec"),
            ("MP5-SD | Desert Strike", "Mil-spec"),
            ("CZ75-Auto | Distressed", "Mil-spec"),
            ("R8 Revolver | Bone Forged", "Mil-spec"),
        ]
        p2_added = 0
        for name, rarity in prisma2_skins:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'skin').first()
            if exists:
                if exists.case_id != prisma2.item_id:
                    exists.case_id = prisma2.item_id
                continue
            itm = Item(
                name=name,
                item_type='skin',
                rarity=rarity,
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=prisma2.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            p2_added += 1
        if p2_added:
            db.commit()
            print(f"Přidáno Prisma 2 skinů: {p2_added}")

        print("Kontroluji/seeduji Prisma 2 Case nože...")
        prisma2_knives = [
            # Talon / Stiletto / Ursus / Navaja variants
            "Talon Knife | Marble Fade",
            "Talon Knife | Ultraviolet",
            "Stiletto Knife | Tiger Tooth",
            "Ursus Knife | Doppler",
            "Talon Knife | Damascus Steel",
            "Talon Knife | Tiger Tooth",
            "Stiletto Knife | Damascus Steel",
            "Stiletto Knife | Marble Fade",
            "Stiletto Knife | Ultraviolet",
            "Talon Knife | Rust Coat",
            "Ursus Knife | Tiger Tooth",
            "Stiletto Knife | Rust Coat",
            "Ursus Knife | Damascus Steel",
            "Navaja Knife | Ultraviolet",
            "Navaja Knife | Doppler",
            "Navaja Knife | Rust Coat",
            "Navaja Knife | Marble Fade",
            "Stiletto Knife | Doppler",
            "Ursus Knife | Ultraviolet",
            "Ursus Knife | Rust Coat",
            "Navaja Knife | Tiger Tooth",
            "Navaja Knife | Damascus Steel",
            "Ursus Knife | Marble Fade",
            "Talon Knife | Doppler",
            "Ursus Knife | Doppler Sapphire",
            "Ursus Knife | Doppler Ruby",
            "Ursus Knife | Doppler Phase 4",
            "Ursus Knife | Doppler Phase 3",
            "Ursus Knife | Doppler Phase 2",
            "Ursus Knife | Doppler Phase 1",
            "Talon Knife | Doppler Sapphire",
            "Talon Knife | Doppler Ruby",
            "Talon Knife | Doppler Phase 4",
            "Talon Knife | Doppler Phase 3",
            "Talon Knife | Doppler Phase 2",
            "Talon Knife | Doppler Phase 1",
            "Talon Knife | Doppler Black Pearl",
            "Stiletto Knife | Doppler Sapphire",
            "Stiletto Knife | Doppler Ruby",
            "Stiletto Knife | Doppler Phase 4",
            "Stiletto Knife | Doppler Phase 3",
            "Stiletto Knife | Doppler Phase 2",
            "Stiletto Knife | Doppler Phase 1",
            "Stiletto Knife | Doppler Black Pearl",
            "Navaja Knife | Doppler Sapphire",
            "Navaja Knife | Doppler Ruby",
            "Navaja Knife | Doppler Phase 4",
            "Navaja Knife | Doppler Phase 3",
        ]
        p2k_added = 0
        for name in prisma2_knives:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'knife').first()
            if exists:
                if exists.case_id != prisma2.item_id:
                    exists.case_id = prisma2.item_id
                continue
            itm = Item(
                name=name,
                item_type='knife',
                rarity='Knife',
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=prisma2.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            p2k_added += 1
        if p2k_added:
            db.commit()
            print(f"Přidáno Prisma 2 nožů: {p2k_added}")

    # Shattered Web Case skins
    if shattered_web:
        print("Kontroluji/seeduji Shattered Web Case skiny...")
        sw_skins = [
            # Covert
            ("AWP | Containment Breach", "Covert"),
            ("MAC-10 | Stalker", "Covert"),
            # Classified
            ("Tec-9 | Decimator", "Classified"),
            ("SSG 08 | Bloodshot", "Classified"),
            ("SG 553 | Colony IV", "Classified"),
            # Restricted
            ("AK-47 | Rat Rod", "Restricted"),
            ("AUG | Arctic Wolf", "Restricted"),
            ("MP7 | Neon Ply", "Restricted"),
            ("P2000 | Obsidian", "Restricted"),
            ("PP-Bizon | Embargo", "Restricted"),
            # Mil-Spec
            ("Dual Berettas | Balance", "Mil-spec"),
            ("MP5-SD | Acid Wash", "Mil-spec"),
            ("R8 Revolver | Memento", "Mil-spec"),
            ("G3SG1 | Black Sand", "Mil-spec"),
            ("Nova | Plume", "Mil-spec"),
            ("SCAR-20 | Torn", "Mil-spec"),
            ("M249 | Warbird", "Mil-spec"),
        ]
        sw_added = 0
        for name, rarity in sw_skins:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'skin').first()
            if exists:
                if exists.case_id != shattered_web.item_id:
                    exists.case_id = shattered_web.item_id
                continue
            itm = Item(
                name=name,
                item_type='skin',
                rarity=rarity,
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=shattered_web.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            sw_added += 1
        if sw_added:
            db.commit()
            print(f"Přidáno Shattered Web skinů: {sw_added}")

        print("Kontroluji/seeduji Shattered Web Case nože (stejné jako Fracture)...")
        sw_knives = [
            "Skeleton Knife | Slaughter",
            "Skeleton Knife | Vanilla",
            "Skeleton Knife | Stained",
            "Paracord Knife | Vanilla",
            "Nomad Knife | Vanilla",
            "Skeleton Knife | Crimson Web",
            "Skeleton Knife | Case Hardened",
            "Paracord Knife | Case Hardened",
            "Paracord Knife | Urban Masked",
            "Skeleton Knife | Urban Masked",
            "Nomad Knife | Fade",
            "Paracord Knife | Safari Mesh",
            "Survival Knife | Fade",
            "Nomad Knife | Crimson Web",
            "Survival Knife | Vanilla",
            "Paracord Knife | Crimson Web",
            "Nomad Knife | Forest DDPAT",
        ]
        swk_added = 0
        for name in sw_knives:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'knife').first()
            if exists:
                if exists.case_id != shattered_web.item_id:
                    exists.case_id = shattered_web.item_id
                continue
            itm = Item(
                name=name,
                item_type='knife',
                rarity='Knife',
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=shattered_web.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            swk_added += 1
        if swk_added:
            db.commit()
            print(f"Přidáno Shattered Web nožů: {swk_added}")

    # CS20 Case skins
    if cs20:
        print("Kontroluji/seeduji CS20 Case skiny...")
        cs20_skins = [
            # Covert
            ("AWP | Wildfire", "Covert"),
            ("FAMAS | Commemoration", "Covert"),
            # Classified
            ("MP9 | Hydra", "Classified"),
            ("P90 | Nostalgia", "Classified"),
            ("AUG | Death by Puppy", "Classified"),
            # Restricted
            ("MP5-SD | Agent", "Restricted"),
            ("Five-SeveN | Buddy", "Restricted"),
            ("P250 | Inferno", "Restricted"),
            ("M249 | Aztec", "Restricted"),
            ("UMP-45 | Plastique", "Restricted"),
            # Mil-Spec
            ("Glock-18 | Sacrifice", "Mil-spec"),
            ("FAMAS | Decommissioned", "Mil-spec"),
            ("SCAR-20 | Assault", "Mil-spec"),
            ("Dual Berettas | Elite 1.6", "Mil-spec"),
            ("Tec-9 | Flash Out", "Mil-spec"),
            ("MAC-10 | Classic Crate", "Mil-spec"),
            ("MAG-7 | Popdog", "Mil-spec"),
        ]
        cs20_added = 0
        for name, rarity in cs20_skins:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'skin').first()
            if exists:
                if exists.case_id != cs20.item_id:
                    exists.case_id = cs20.item_id
                continue
            itm = Item(
                name=name,
                item_type='skin',
                rarity=rarity,
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=cs20.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            cs20_added += 1
        if cs20_added:
            db.commit()
            print(f"Přidáno CS20 skinů: {cs20_added}")

        print("Kontroluji/seeduji CS20 Case nože...")
        cs20_knives = [
            "Classic Knife | Night Stripe",
            "Classic Knife | Urban Masked",
            "Classic Knife | Slaughter",
            "Classic Knife | Vanilla",
            "Classic Knife | Case Hardened",
            "Classic Knife | Blue Steel",
            "Classic Knife | Safari Mesh",
            "Classic Knife | Forest DDPAT",
            "Classic Knife | Crimson Web",
            "Classic Knife | Scorched",
            "Classic Knife | Stained",
            "Classic Knife | Boreal Forest",
            "Classic Knife | Fade",
        ]
        cs20k_added = 0
        for name in cs20_knives:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'knife').first()
            if exists:
                if exists.case_id != cs20.item_id:
                    exists.case_id = cs20.item_id
                continue
            itm = Item(
                name=name,
                item_type='knife',
                rarity='Knife',
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=cs20.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            cs20k_added += 1
        if cs20k_added:
            db.commit()
            print(f"Přidáno CS20 nožů: {cs20k_added}")

    # Prisma Case skins
    if prisma:
        print("Kontroluji/seeduji Prisma Case skiny...")
        prisma_skins = [
            # Covert
            ("Five-SeveN | Angry Mob", "Covert"),
            ("M4A4 | The Emperor", "Covert"),
            # Classified
            ("AUG | Momentum", "Classified"),
            ("R8 Revolver | Skull Crusher", "Classified"),
            ("XM1014 | Incinegator", "Classified"),
            # Restricted
            ("AWP | Atheris", "Restricted"),
            ("Desert Eagle | Light Rail", "Restricted"),
            ("Tec-9 | Bamboozle", "Restricted"),
            ("UMP-45 | Moonrise", "Restricted"),
            ("MP5-SD | Gauss", "Restricted"),
            # Mil-Spec
            ("AK-47 | Uncharted", "Mil-spec"),
            ("FAMAS | Crypsis", "Mil-spec"),
            ("Galil AR | Akoben", "Mil-spec"),
            ("MP7 | Mischief", "Mil-spec"),
            ("P90 | Off World", "Mil-spec"),
            ("MAC-10 | Whitefish", "Mil-spec"),
            ("P250 | Verdigris", "Mil-spec"),
        ]
        pr_added = 0
        for name, rarity in prisma_skins:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'skin').first()
            if exists:
                if exists.case_id != prisma.item_id:
                    exists.case_id = prisma.item_id
                continue
            itm = Item(
                name=name,
                item_type='skin',
                rarity=rarity,
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=prisma.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            pr_added += 1
        if pr_added:
            db.commit()
            print(f"Přidáno Prisma skinů: {pr_added}")

        print("Kontroluji/seeduji Prisma Case nože (stejné jako Prisma 2)...")
        prisma_knives = [
            # Mirror Prisma 2 Talon/Stiletto/Ursus/Navaja pool
            "Talon Knife | Marble Fade",
            "Talon Knife | Ultraviolet",
            "Stiletto Knife | Tiger Tooth",
            "Ursus Knife | Doppler",
            "Talon Knife | Damascus Steel",
            "Talon Knife | Tiger Tooth",
            "Stiletto Knife | Damascus Steel",
            "Stiletto Knife | Marble Fade",
            "Stiletto Knife | Ultraviolet",
            "Talon Knife | Rust Coat",
            "Ursus Knife | Tiger Tooth",
            "Stiletto Knife | Rust Coat",
            "Ursus Knife | Damascus Steel",
            "Navaja Knife | Ultraviolet",
            "Navaja Knife | Doppler",
            "Navaja Knife | Rust Coat",
            "Navaja Knife | Marble Fade",
            "Stiletto Knife | Doppler",
            "Ursus Knife | Ultraviolet",
            "Ursus Knife | Rust Coat",
            "Navaja Knife | Tiger Tooth",
            "Navaja Knife | Damascus Steel",
            "Ursus Knife | Marble Fade",
            "Talon Knife | Doppler",
            "Ursus Knife | Doppler Sapphire",
            "Ursus Knife | Doppler Ruby",
            "Ursus Knife | Doppler Phase 4",
            "Ursus Knife | Doppler Phase 3",
            "Ursus Knife | Doppler Phase 2",
            "Ursus Knife | Doppler Phase 1",
            "Talon Knife | Doppler Sapphire",
            "Talon Knife | Doppler Ruby",
            "Talon Knife | Doppler Phase 4",
            "Talon Knife | Doppler Phase 3",
            "Talon Knife | Doppler Phase 2",
            "Talon Knife | Doppler Phase 1",
            "Talon Knife | Doppler Black Pearl",
            "Stiletto Knife | Doppler Sapphire",
            "Stiletto Knife | Doppler Ruby",
            "Stiletto Knife | Doppler Phase 4",
            "Stiletto Knife | Doppler Phase 3",
            "Stiletto Knife | Doppler Phase 2",
            "Stiletto Knife | Doppler Phase 1",
            "Stiletto Knife | Doppler Black Pearl",
            "Navaja Knife | Doppler Sapphire",
            "Navaja Knife | Doppler Ruby",
            "Navaja Knife | Doppler Phase 4",
            "Navaja Knife | Doppler Phase 3",
        ]
        prk_added = 0
        for name in prisma_knives:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'knife').first()
            if exists:
                if exists.case_id != prisma.item_id:
                    exists.case_id = prisma.item_id
                continue
            itm = Item(
                name=name,
                item_type='knife',
                rarity='Knife',
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=prisma.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            prk_added += 1
        if prk_added:
            db.commit()
            print(f"Přidáno Prisma nožů: {prk_added}")

    # Danger Zone Case skins
    if danger_zone:
        print("Kontroluji/seeduji Danger Zone Case skiny...")
        dz_skins = [
            # Covert
            ("AK-47 | Asiimov", "Covert"),
            ("AWP | Neo-Noir", "Covert"),
            # Classified
            ("Desert Eagle | Mecha Industries", "Classified"),
            ("MP5-SD | Phosphor", "Classified"),
            ("UMP-45 | Momentum", "Classified"),
            # Restricted
            ("USP-S | Flashback", "Restricted"),
            ("P250 | Nevermore", "Restricted"),
            ("Galil AR | Signal", "Restricted"),
            ("G3SG1 | Scavenger", "Restricted"),
            ("MAC-10 | Pipe Down", "Restricted"),
            # Mil-Spec
            ("M4A4 | Magnesium", "Mil-spec"),
            ("Glock-18 | Oxide Blaze", "Mil-spec"),
            ("Tec-9 | Fubar", "Mil-spec"),
            ("Nova | Wood Fired", "Mil-spec"),
            ("MP9 | Modest Threat", "Mil-spec"),
            ("SG 553 | Danger Close", "Mil-spec"),
            ("Sawed-Off | Black Sand", "Mil-spec"),
        ]
        dz_added = 0
        for name, rarity in dz_skins:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'skin').first()
            if exists:
                if exists.case_id != danger_zone.item_id:
                    exists.case_id = danger_zone.item_id
                continue
            itm = Item(
                name=name,
                item_type='skin',
                rarity=rarity,
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=danger_zone.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            dz_added += 1
        if dz_added:
            db.commit()
            print(f"Přidáno Danger Zone skinů: {dz_added}")

        print("Kontroluji/seeduji Danger Zone Case nože...")
        dz_knives = [
            "Talon Knife | Case Hardened",
            "Talon Knife | Fade",
            "Talon Knife | Stained",
            "Talon Knife | Blue Steel",
            "Stiletto Knife | Crimson Web",
            "Talon Knife | Vanilla",
            "Navaja Knife | Urban Masked",
            "Ursus Knife | Vanilla",
            "Talon Knife | Forest DDPAT",
            "Navaja Knife | Vanilla",
            "Navaja Knife | Safari Mesh",
            "Stiletto Knife | Slaughter",
            "Talon Knife | Urban Masked",
            "Stiletto Knife | Blue Steel",
            "Talon Knife | Boreal Forest",
            "Talon Knife | Safari Mesh",
            "Talon Knife | Night Stripe",
            "Stiletto Knife | Case Hardened",
            "Stiletto Knife | Stained",
            "Ursus Knife | Scorched",
            "Navaja Knife | Forest DDPAT",
            "Ursus Knife | Case Hardened",
            "Ursus Knife | Stained",
            "Stiletto Knife | Forest DDPAT",
            "Stiletto Knife | Boreal Forest",
            "Ursus Knife | Boreal Forest",
            "Stiletto Knife | Safari Mesh",
            "Navaja Knife | Crimson Web",
            "Navaja Knife | Scorched",
            "Talon Knife | Scorched",
            "Navaja Knife | Stained",
            "Navaja Knife | Night Stripe",
            "Ursus Knife | Forest DDPAT",
            "Talon Knife | Slaughter",
            "Stiletto Knife | Urban Masked",
            "Ursus Knife | Blue Steel",
            "Stiletto Knife | Scorched",
            "Ursus Knife | Urban Masked",
            "Ursus Knife | Safari Mesh",
            "Navaja Knife | Case Hardened",
            "Ursus Knife | Fade",
            "Stiletto Knife | Fade",
            "Navaja Knife | Blue Steel",
            "Navaja Knife | Boreal Forest",
            "Stiletto Knife | Night Stripe",
            "Ursus Knife | Night Stripe",
            "Ursus Knife | Crimson Web",
        ]
        dzk_added = 0
        for name in dz_knives:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'knife').first()
            if exists:
                if exists.case_id != danger_zone.item_id:
                    exists.case_id = danger_zone.item_id
                continue
            itm = Item(
                name=name,
                item_type='knife',
                rarity='Knife',
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=danger_zone.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            dzk_added += 1
        if dzk_added:
            db.commit()
            print(f"Přidáno Danger Zone nožů: {dzk_added}")

    # Horizon Case skins
    if horizon:
        print("Kontroluji/seeduji Horizon Case skiny...")
        horizon_skins = [
            # Covert
            ("Desert Eagle | Code Red", "Covert"),
            ("AK-47 | Neon Rider", "Covert"),
            # Classified
            ("M4A1-S | Nightmare", "Classified"),
            ("FAMAS | Eye of Athena", "Classified"),
            ("Sawed-Off | Devourer", "Classified"),
            # Restricted
            ("AWP | PAW", "Restricted"),
            ("CZ75-Auto | Eco", "Restricted"),
            ("Nova | Toy Soldier", "Restricted"),
            ("MP7 | Powercore", "Restricted"),
            ("G3SG1 | High Seas", "Restricted"),
            # Mil-Spec
            ("Glock-18 | Warhawk", "Mil-spec"),
            ("P90 | Traction", "Mil-spec"),
            ("MP9 | Capillary", "Mil-spec"),
            ("R8 Revolver | Survivalist", "Mil-spec"),
            ("Tec-9 | Snek-9", "Mil-spec"),
            ("Dual Berettas | Shred", "Mil-spec"),
            ("AUG | Amber Slipstream", "Mil-spec"),
        ]
        hz_added = 0
        for name, rarity in horizon_skins:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'skin').first()
            if exists:
                if exists.case_id != horizon.item_id:
                    exists.case_id = horizon.item_id
                continue
            itm = Item(
                name=name,
                item_type='skin',
                rarity=rarity,
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=horizon.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            hz_added += 1
        if hz_added:
            db.commit()
            print(f"Přidáno Horizon skinů: {hz_added}")

        print("Kontroluji/seeduji Horizon Case nože (stejné jako Danger Zone)...")
        horizon_knives = [
            "Talon Knife | Case Hardened",
            "Talon Knife | Fade",
            "Talon Knife | Stained",
            "Talon Knife | Blue Steel",
            "Stiletto Knife | Crimson Web",
            "Talon Knife | Vanilla",
            "Navaja Knife | Urban Masked",
            "Ursus Knife | Vanilla",
            "Talon Knife | Forest DDPAT",
            "Navaja Knife | Vanilla",
            "Navaja Knife | Safari Mesh",
            "Stiletto Knife | Slaughter",
            "Talon Knife | Urban Masked",
            "Stiletto Knife | Blue Steel",
            "Talon Knife | Boreal Forest",
            "Talon Knife | Safari Mesh",
            "Talon Knife | Night Stripe",
            "Stiletto Knife | Case Hardened",
            "Stiletto Knife | Stained",
            "Ursus Knife | Scorched",
            "Navaja Knife | Forest DDPAT",
            "Ursus Knife | Case Hardened",
            "Ursus Knife | Stained",
            "Stiletto Knife | Forest DDPAT",
            "Stiletto Knife | Boreal Forest",
            "Ursus Knife | Boreal Forest",
            "Stiletto Knife | Safari Mesh",
            "Navaja Knife | Crimson Web",
            "Navaja Knife | Scorched",
            "Talon Knife | Scorched",
            "Navaja Knife | Stained",
            "Navaja Knife | Night Stripe",
            "Ursus Knife | Forest DDPAT",
            "Talon Knife | Slaughter",
            "Stiletto Knife | Urban Masked",
            "Ursus Knife | Blue Steel",
            "Stiletto Knife | Scorched",
            "Ursus Knife | Urban Masked",
            "Ursus Knife | Safari Mesh",
            "Navaja Knife | Case Hardened",
            "Ursus Knife | Fade",
            "Stiletto Knife | Fade",
            "Navaja Knife | Blue Steel",
            "Navaja Knife | Boreal Forest",
            "Stiletto Knife | Night Stripe",
            "Ursus Knife | Night Stripe",
            "Ursus Knife | Crimson Web",
        ]
        hzk_added = 0
        for name in horizon_knives:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'knife').first()
            if exists:
                if exists.case_id != horizon.item_id:
                    exists.case_id = horizon.item_id
                continue
            itm = Item(
                name=name,
                item_type='knife',
                rarity='Knife',
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=horizon.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            hzk_added += 1
        if hzk_added:
            db.commit()
            print(f"Přidáno Horizon nožů: {hzk_added}")

    # Clutch Case skins
    if clutch:
        print("Kontroluji/seeduji Clutch Case skiny...")
        clutch_skins = [
            # Covert
            ("MP7 | Bloodsport", "Covert"),
            ("M4A4 | Neo-Noir", "Covert"),
            # Classified
            ("USP-S | Cortex", "Classified"),
            ("AWP | Mortis", "Classified"),
            ("AUG | Stymphalian", "Classified"),
            # Restricted
            ("Glock-18 | Moonrise", "Restricted"),
            ("UMP-45 | Arctic Wolf", "Restricted"),
            ("MAG-7 | SWAG-7", "Restricted"),
            ("Negev | Lionfish", "Restricted"),
            ("Nova | Wild Six", "Restricted"),
            # Mil-Spec
            ("SG 553 | Aloha", "Mil-spec"),
            ("Five-SeveN | Flame Test", "Mil-spec"),
            ("R8 Revolver | Grip", "Mil-spec"),
            ("XM1014 | Oxide Blaze", "Mil-spec"),
            ("MP9 | Black Sand", "Mil-spec"),
            ("PP-Bizon | Night Riot", "Mil-spec"),
            ("P2000 | Urban Hazard", "Mil-spec"),
        ]
        cl_added = 0
        for name, rarity in clutch_skins:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'skin').first()
            if exists:
                if exists.case_id != clutch.item_id:
                    exists.case_id = clutch.item_id
                continue
            itm = Item(
                name=name,
                item_type='skin',
                rarity=rarity,
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=clutch.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            cl_added += 1
        if cl_added:
            db.commit()
            print(f"Přidáno Clutch skinů: {cl_added}")

        print("Kontroluji/seeduji Clutch Case rukavice (stejné jako Revolution)...")
        clutch_gloves = [
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
        clg_added = 0
        for name in clutch_gloves:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'glove').first()
            if exists:
                if exists.case_id != clutch.item_id:
                    exists.case_id = clutch.item_id
                continue
            itm = Item(
                name=name,
                item_type='glove',
                rarity='Knife/Glove',
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=clutch.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            clg_added += 1
        if clg_added:
            db.commit()
            print(f"Přidáno Clutch rukavic: {clg_added}")

    # Spectrum 2 Case skins
    if spectrum2:
        print("Kontroluji/seeduji Spectrum 2 Case skiny...")
        sp2_skins = [
            # Covert
            ("P250 | See Ya Later", "Covert"),
            ("AK-47 | The Empress", "Covert"),
            # Classified
            ("M4A1-S | Leaded Glass", "Classified"),
            ("PP-Bizon | High Roller", "Classified"),
            ("R8 Revolver | Llama Cannon", "Classified"),
            # Restricted
            ("MP9 | Goo", "Restricted"),
            ("CZ75-Auto | Tacticat", "Restricted"),
            ("SG 553 | Phantom", "Restricted"),
            ("UMP-45 | Exposure", "Restricted"),
            ("XM1014 | Ziggy", "Restricted"),
            # Mil-Spec
            ("Glock-18 | Off World", "Mil-spec"),
            ("MAC-10 | Oceanic", "Mil-spec"),
            ("Tec-9 | Cracked Opal", "Mil-spec"),
            ("AUG | Triqua", "Mil-spec"),
            ("Sawed-Off | Morris", "Mil-spec"),
            ("G3SG1 | Hunter", "Mil-spec"),
            ("SCAR-20 | Jungle Slipstream", "Mil-spec"),
        ]
        sp2_added = 0
        for name, rarity in sp2_skins:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'skin').first()
            if exists:
                if exists.case_id != spectrum2.item_id:
                    exists.case_id = spectrum2.item_id
                continue
            itm = Item(
                name=name,
                item_type='skin',
                rarity=rarity,
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=spectrum2.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            sp2_added += 1
        if sp2_added:
            db.commit()
            print(f"Přidáno Spectrum 2 skinů: {sp2_added}")

        print("Kontroluji/seeduji Spectrum 2 Case nože...")
        sp2_knives = [
            "Huntsman Knife | Marble Fade",
            "Falchion Knife | Marble Fade",
            "Bowie Knife | Doppler",
            "Butterfly Knife | Tiger Tooth",
            "Falchion Knife | Doppler",
            "Shadow Daggers | Marble Fade",
            "Butterfly Knife | Rust Coat",
            "Bowie Knife | Marble Fade",
            "Falchion Knife | Damascus Steel",
            "Huntsman Knife | Tiger Tooth",
            "Huntsman Knife | Doppler",
            "Falchion Knife | Tiger Tooth",
            "Butterfly Knife | Ultraviolet",
            "Shadow Daggers | Damascus Steel",
            "Shadow Daggers | Tiger Tooth",
            "Bowie Knife | Tiger Tooth",
            "Falchion Knife | Rust Coat",
            "Huntsman Knife | Ultraviolet",
            "Shadow Daggers | Doppler",
            "Bowie Knife | Rust Coat",
            "Shadow Daggers | Ultraviolet",
            "Huntsman Knife | Damascus Steel",
            "Falchion Knife | Ultraviolet",
            "Bowie Knife | Ultraviolet",
            "Shadow Daggers | Rust Coat",
            "Butterfly Knife | Damascus Steel",
            "Huntsman Knife | Rust Coat",
            "Bowie Knife | Damascus Steel",
            "Shadow Daggers | Doppler Sapphire",
            "Shadow Daggers | Doppler Phase 4",
            "Shadow Daggers | Doppler Phase 3",
            "Shadow Daggers | Doppler Phase 2",
            "Shadow Daggers | Doppler Phase 1",
            "Shadow Daggers | Doppler Black Pearl",
            "Huntsman Knife | Doppler Sapphire",
            "Huntsman Knife | Doppler Ruby",
            "Huntsman Knife | Doppler Phase 4",
            "Huntsman Knife | Doppler Phase 3",
            "Huntsman Knife | Doppler Phase 2",
            "Huntsman Knife | Doppler Phase 1",
            "Falchion Knife | Doppler Sapphire",
            "Falchion Knife | Doppler Ruby",
            "Falchion Knife | Doppler Phase 4",
            "Falchion Knife | Doppler Phase 3",
            "Falchion Knife | Doppler Phase 2",
            "Falchion Knife | Doppler Phase 1",
            "Falchion Knife | Doppler Black Pearl",
            "Butterfly Knife | Doppler Sapphire",
        ]
        sp2k_added = 0
        for name in sp2_knives:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'knife').first()
            if exists:
                if exists.case_id != spectrum2.item_id:
                    exists.case_id = spectrum2.item_id
                continue
            itm = Item(
                name=name,
                item_type='knife',
                rarity='Covert',
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=spectrum2.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            sp2k_added += 1
        if sp2k_added:
            db.commit()
            print(f"Přidáno Spectrum 2 nožů: {sp2k_added}")

    # Operation Hydra Case skins and gloves
    if hydra:
        print("Kontroluji/seeduji Operation Hydra Case skiny...")
        hydra_skins = [
            # Covert
            ("Five-SeveN | Hyper Beast", "Covert"),
            ("AWP | Oni Taiji", "Covert"),
            # Classified
            ("M4A4 | Hellfire", "Classified"),
            ("Galil AR | Sugar Rush", "Classified"),
            ("Dual Berettas | Cobra Strike", "Classified"),
        ]
        hydra_added = 0
        for name, rarity in hydra_skins:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'skin').first()
            if exists:
                if exists.case_id != hydra.item_id:
                    exists.case_id = hydra.item_id
                continue
            itm = Item(
                name=name,
                item_type='skin',
                rarity=rarity,
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=hydra.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            hydra_added += 1
        if hydra_added:
            db.commit()
            print(f"Přidáno Operation Hydra skinů: {hydra_added}")

        print("Kontroluji/seeduji Operation Hydra Case rukavice...")
        hydra_gloves = [
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
        hydrag_added = 0
        for name in hydra_gloves:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'glove').first()
            if exists:
                if exists.case_id != hydra.item_id:
                    exists.case_id = hydra.item_id
                continue
            itm = Item(
                name=name,
                item_type='glove',
                rarity='Knife/Glove',
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=hydra.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            hydrag_added += 1
        if hydrag_added:
            db.commit()
            print(f"Přidáno Operation Hydra rukavic: {hydrag_added}")

    # Spectrum Case skins and knives
    if spectrum:
        print("Kontroluji/seeduji Spectrum Case skiny...")
        spectrum_skins = [
            # Covert
            ("USP-S | Neo-Noir", "Covert"),
            ("AK-47 | Bloodsport", "Covert"),
            # Classified
            ("CZ75-Auto | Xiangliu", "Classified"),
            ("AWP | Fever Dream", "Classified"),
            ("M4A1-S | Decimator", "Classified"),
            # Restricted
            ("Galil AR | Crimson Tsunami", "Restricted"),
            ("MAC-10 | Last Dive", "Restricted"),
            ("UMP-45 | Scaffold", "Restricted"),
            ("XM1014 | Seasons", "Restricted"),
            ("M249 | Emerald Poison Dart", "Restricted"),
            # Mil-Spec
            ("Desert Eagle | Oxide Blaze", "Mil-Spec"),
            ("Five-SeveN | Capillary", "Mil-Spec"),
            ("P250 | Ripple", "Mil-Spec"),
            ("SCAR-20 | Blueprint", "Mil-Spec"),
            ("PP-Bizon | Jungle Slipstream", "Mil-Spec"),
            ("MP7 | Akoben", "Mil-Spec"),
            ("Sawed-Off | Zander", "Mil-Spec"),
        ]
        sp_added = 0
        for name, rarity in spectrum_skins:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'skin').first()
            if exists:
                if exists.case_id != spectrum.item_id:
                    exists.case_id = spectrum.item_id
                continue
            itm = Item(
                name=name,
                item_type='skin',
                rarity=rarity,
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=spectrum.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            sp_added += 1
        if sp_added:
            db.commit()
            print(f"Přidáno Spectrum skinů: {sp_added}")

        print("Kontroluji/seeduji Spectrum Case nože (stejné jako Spectrum 2)...")
        # Reuse Spectrum 2 knife list
        spectrum_knives = [
            "Huntsman Knife | Marble Fade",
            "Falchion Knife | Marble Fade",
            "Bowie Knife | Doppler",
            "Butterfly Knife | Tiger Tooth",
            "Falchion Knife | Doppler",
            "Shadow Daggers | Marble Fade",
            "Butterfly Knife | Rust Coat",
            "Bowie Knife | Marble Fade",
            "Falchion Knife | Damascus Steel",
            "Huntsman Knife | Tiger Tooth",
            "Huntsman Knife | Doppler",
            "Falchion Knife | Tiger Tooth",
            "Butterfly Knife | Ultraviolet",
            "Shadow Daggers | Damascus Steel",
            "Shadow Daggers | Tiger Tooth",
            "Bowie Knife | Tiger Tooth",
            "Falchion Knife | Rust Coat",
            "Huntsman Knife | Ultraviolet",
            "Shadow Daggers | Doppler",
            "Bowie Knife | Rust Coat",
            "Shadow Daggers | Ultraviolet",
            "Huntsman Knife | Damascus Steel",
            "Falchion Knife | Ultraviolet",
            "Bowie Knife | Ultraviolet",
            "Shadow Daggers | Rust Coat",
            "Butterfly Knife | Damascus Steel",
            "Huntsman Knife | Rust Coat",
            "Bowie Knife | Damascus Steel",
            "Shadow Daggers | Doppler Sapphire",
            "Shadow Daggers | Doppler Phase 4",
            "Shadow Daggers | Doppler Phase 3",
            "Shadow Daggers | Doppler Phase 2",
            "Shadow Daggers | Doppler Phase 1",
            "Shadow Daggers | Doppler Black Pearl",
            "Huntsman Knife | Doppler Sapphire",
            "Huntsman Knife | Doppler Ruby",
            "Huntsman Knife | Doppler Phase 4",
            "Huntsman Knife | Doppler Phase 3",
            "Huntsman Knife | Doppler Phase 2",
            "Huntsman Knife | Doppler Phase 1",
            "Falchion Knife | Doppler Sapphire",
            "Falchion Knife | Doppler Ruby",
            "Falchion Knife | Doppler Phase 4",
            "Falchion Knife | Doppler Phase 3",
            "Falchion Knife | Doppler Phase 2",
            "Falchion Knife | Doppler Phase 1",
            "Falchion Knife | Doppler Black Pearl",
            "Butterfly Knife | Doppler Sapphire",
        ]
        spk_added = 0
        for name in spectrum_knives:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'knife').first()
            if exists:
                if exists.case_id != spectrum.item_id:
                    exists.case_id = spectrum.item_id
                continue
            itm = Item(
                name=name,
                item_type='knife',
                rarity='Covert',
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=spectrum.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            spk_added += 1
        if spk_added:
            db.commit()
            print(f"Přidáno Spectrum nožů: {spk_added}")

    # Glove Case skins and gloves
    if glove_case:
        print("Kontroluji/seeduji Glove Case skiny...")
        glove_skins = [
            # Pistole
            ("USP-S | Cyrex", "Restricted"),
            ("Dual Berettas | Royal Consorts", "Restricted"),
            ("Glock-18 | Ironwork", "Mil-Spec"),
            ("P2000 | Turf", "Mil-Spec"),
            ("CZ75-Auto | Polymer", "Mil-Spec"),
            # Rifles / Pušky
            ("M4A4 | Buzz Kill", "Covert"),
            ("FAMAS | Mecha Industries", "Classified"),
            ("M4A1-S | Flashback", "Restricted"),
            ("Galil AR | Black Sand", "Mil-Spec"),
            # Sniper Rifles
            ("SSG 08 | Dragonfire", "Covert"),
            ("G3SG1 | Stinger", "Restricted"),
            # SMG
            ("P90 | Shallow Grave", "Classified"),
            ("MP7 | Cirrus", "Mil-Spec"),
            ("MP9 | Sand Scale", "Mil-Spec"),
            # Shotguns
            ("Sawed-Off | Wasteland Princess", "Classified"),
            ("Nova | Gila", "Restricted"),
            ("MAG-7 | Sonar", "Mil-Spec"),
        ]
        gc_added = 0
        for name, rarity in glove_skins:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'skin').first()
            if exists:
                if exists.case_id != glove_case.item_id:
                    exists.case_id = glove_case.item_id
                continue
            itm = Item(
                name=name,
                item_type='skin',
                rarity=rarity,
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=glove_case.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            gc_added += 1
        if gc_added:
            db.commit()
            print(f"Přidáno Glove Case skinů: {gc_added}")

        print("Kontroluji/seeduji Glove Case rukavice (stejné jako Hydra)...")
        hydra_gloves = [
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
        gcg_added = 0
        for name in hydra_gloves:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'glove').first()
            if exists:
                if exists.case_id != glove_case.item_id:
                    exists.case_id = glove_case.item_id
                continue
            itm = Item(
                name=name,
                item_type='glove',
                rarity='Knife/Glove',
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=glove_case.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            gcg_added += 1
        if gcg_added:
            db.commit()
            print(f"Přidáno Glove Case rukavic: {gcg_added}")

    # Gamma 2 Case skins and knives
    if gamma2_case:
        print("Kontroluji/seeduji Gamma 2 Case skiny...")
        gamma2_skins = [
            # Covert
            ("AK-47 | Neon Revolution", "Covert"),
            ("FAMAS | Roll Cage", "Covert"),
            # Classified
            ("Tec-9 | Fuel Injector", "Classified"),
            ("MP9 | Airlock", "Classified"),
            ("AUG | Syd Mead", "Classified"),
            # Restricted
            ("Desert Eagle | Directive", "Restricted"),
            ("Glock-18 | Weasel", "Restricted"),
            ("MAG-7 | Petroglyph", "Restricted"),
            ("SCAR-20 | Powercore", "Restricted"),
            ("SG 553 | Triarch", "Restricted"),
            # Mil-Spec
            ("XM1014 | Slipstream", "Mil-Spec"),
            ("P90 | Grim", "Mil-Spec"),
            ("G3SG1 | Ventilator", "Mil-Spec"),
            ("CZ75-Auto | Imprint", "Mil-Spec"),
            ("Negev | Dazzle", "Mil-Spec"),
            ("UMP-45 | Briefing", "Mil-Spec"),
            ("Five-SeveN | Scumbria", "Mil-Spec"),
        ]
        g2_added = 0
        for name, rarity in gamma2_skins:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'skin').first()
            if exists:
                if exists.case_id != gamma2_case.item_id:
                    exists.case_id = gamma2_case.item_id
                continue
            itm = Item(
                name=name,
                item_type='skin',
                rarity=rarity,
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=gamma2_case.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            g2_added += 1
        if g2_added:
            db.commit()
            print(f"Přidáno Gamma 2 skinů: {g2_added}")

        print("Kontroluji/seeduji Gamma 2 Case nože...")
        gamma2_knives = [
            "M9 Bayonet | Freehand",
            "M9 Bayonet | Autotronic",
            "Karambit | Bright Water",
            "Bayonet | Bright Water",
            "Bayonet | Gamma Doppler",
            "Karambit | Freehand",
            "Karambit | Lore",
            "Bayonet | Autotronic",
            "Gut Knife | Autotronic",
            "Flip Knife | Autotronic",
            "Bayonet | Freehand",
            "Karambit | Black Laminate",
            "Bayonet | Lore",
            "M9 Bayonet | Bright Water",
            "Gut Knife | Lore",
            "Flip Knife | Black Laminate",
            "M9 Bayonet | Black Laminate",
            "Gut Knife | Bright Water",
            "Flip Knife | Lore",
            "Flip Knife | Bright Water",
            "Bayonet | Black Laminate",
            "Flip Knife | Gamma Doppler",
            "Gut Knife | Gamma Doppler",
            "Flip Knife | Freehand",
            "Gut Knife | Freehand",
            "Gut Knife | Black Laminate",
            "M9 Bayonet | Lore",
            "M9 Bayonet | Gamma Doppler Phase 4",
            "M9 Bayonet | Gamma Doppler Phase 3",
            "M9 Bayonet | Gamma Doppler Phase 2",
            "M9 Bayonet | Gamma Doppler Phase 1",
            "M9 Bayonet | Gamma Doppler Emerald",
            "Karambit | Gamma Doppler Phase 4",
            "Karambit | Gamma Doppler Phase 3",
            "Karambit | Gamma Doppler Phase 2",
            "Karambit | Gamma Doppler Phase 1",
            "Karambit | Gamma Doppler Emerald",
            "Gut Knife | Gamma Doppler Phase 4",
            "Gut Knife | Gamma Doppler Phase 3",
            "Gut Knife | Gamma Doppler Phase 2",
            "Gut Knife | Gamma Doppler Phase 1",
            "Gut Knife | Gamma Doppler Emerald",
            "Flip Knife | Gamma Doppler Phase 4",
            "Flip Knife | Gamma Doppler Phase 3",
            "Flip Knife | Gamma Doppler Phase 2",
            "Flip Knife | Gamma Doppler Phase 1",
            "Flip Knife | Gamma Doppler Emerald",
            "Bayonet | Gamma Doppler Phase 4",
        ]
        g2k_added = 0
        for name in gamma2_knives:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'knife').first()
            if exists:
                if exists.case_id != gamma2_case.item_id:
                    exists.case_id = gamma2_case.item_id
                continue
            itm = Item(
                name=name,
                item_type='knife',
                rarity='Knife',
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=gamma2_case.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            g2k_added += 1
        if g2k_added:
            db.commit()
            print(f"Přidáno Gamma 2 nožů: {g2k_added}")

    # Gamma Case skins and knives (knives same as Gamma 2)
    if gamma_case:
        print("Kontroluji/seeduji Gamma Case skiny...")
        gamma_skins = [
            # Covert
            ("Glock-18 | Wasteland Rebel", "Covert"),
            ("M4A1-S | Mecha Industries", "Covert"),
            # Classified
            ("M4A4 | Desolate Space", "Classified"),
            ("P2000 | Imperial Dragon", "Classified"),
            ("SCAR-20 | Bloodsport", "Classified"),
            # Restricted
            ("AWP | Phobos", "Restricted"),
            ("AUG | Aristocrat", "Restricted"),
            ("P90 | Chopper", "Restricted"),
            ("R8 Revolver | Reboot", "Restricted"),
            ("Sawed-Off | Limelight", "Restricted"),
            # Mil-Spec
            ("Five-SeveN | Violent Daimyo", "Mil-Spec"),
            ("Tec-9 | Ice Cap", "Mil-Spec"),
            ("SG 553 | Aerial", "Mil-Spec"),
            ("Nova | Exo", "Mil-Spec"),
            ("MAC-10 | Carnivore", "Mil-Spec"),
            ("P250 | Iron Clad", "Mil-Spec"),
            ("PP-Bizon | Harvester", "Mil-Spec"),
        ]
        g_added = 0
        for name, rarity in gamma_skins:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'skin').first()
            if exists:
                if exists.case_id != gamma_case.item_id:
                    exists.case_id = gamma_case.item_id
                continue
            itm = Item(
                name=name,
                item_type='skin',
                rarity=rarity,
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=gamma_case.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            g_added += 1
        if g_added:
            db.commit()
            print(f"Přidáno Gamma skinů: {g_added}")

        print("Kontroluji/seeduji Gamma Case nože (stejné jako Gamma 2)...")
        gamma_knives = [
            "M9 Bayonet | Freehand",
            "M9 Bayonet | Autotronic",
            "Karambit | Bright Water",
            "Bayonet | Bright Water",
            "Bayonet | Gamma Doppler",
            "Karambit | Freehand",
            "Karambit | Lore",
            "Bayonet | Autotronic",
            "Gut Knife | Autotronic",
            "Flip Knife | Autotronic",
            "Bayonet | Freehand",
            "Karambit | Black Laminate",
            "Bayonet | Lore",
            "M9 Bayonet | Bright Water",
            "Gut Knife | Lore",
            "Flip Knife | Black Laminate",
            "M9 Bayonet | Black Laminate",
            "Gut Knife | Bright Water",
            "Flip Knife | Lore",
            "Flip Knife | Bright Water",
            "Bayonet | Black Laminate",
            "Flip Knife | Gamma Doppler",
            "Gut Knife | Gamma Doppler",
            "Flip Knife | Freehand",
            "Gut Knife | Freehand",
            "Gut Knife | Black Laminate",
            "M9 Bayonet | Lore",
            "M9 Bayonet | Gamma Doppler Phase 4",
            "M9 Bayonet | Gamma Doppler Phase 3",
            "M9 Bayonet | Gamma Doppler Phase 2",
            "M9 Bayonet | Gamma Doppler Phase 1",
            "M9 Bayonet | Gamma Doppler Emerald",
            "Karambit | Gamma Doppler Phase 4",
            "Karambit | Gamma Doppler Phase 3",
            "Karambit | Gamma Doppler Phase 2",
            "Karambit | Gamma Doppler Phase 1",
            "Karambit | Gamma Doppler Emerald",
            "Gut Knife | Gamma Doppler Phase 4",
            "Gut Knife | Gamma Doppler Phase 3",
            "Gut Knife | Gamma Doppler Phase 2",
            "Gut Knife | Gamma Doppler Phase 1",
            "Gut Knife | Gamma Doppler Emerald",
            "Flip Knife | Gamma Doppler Phase 4",
            "Flip Knife | Gamma Doppler Phase 3",
            "Flip Knife | Gamma Doppler Phase 2",
            "Flip Knife | Gamma Doppler Phase 1",
            "Flip Knife | Gamma Doppler Emerald",
            "Bayonet | Gamma Doppler Phase 4",
        ]
        gk_added = 0
        for name in gamma_knives:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'knife').first()
            if exists:
                if exists.case_id != gamma_case.item_id:
                    exists.case_id = gamma_case.item_id
                continue
            itm = Item(
                name=name,
                item_type='knife',
                rarity='Knife',
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=gamma_case.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            gk_added += 1
        if gk_added:
            db.commit()
            print(f"Přidáno Gamma nožů: {gk_added}")

    # Operation Broken Fang Case skins
    if broken_fang:
        print("Kontroluji/seeduji Operation Broken Fang Case skiny...")
        bf_skins = [
            # Covert
            ("M4A1-S | Printstream", "Covert"),
            ("Glock-18 | Neo-Noir", "Covert"),
            # Classified
            ("USP-S | Monster Mashup", "Classified"),
            ("M4A4 | Cyber Security", "Classified"),
            ("Five-SeveN | Fairy Tale", "Classified"),
            # Restricted
            ("AWP | Exoskeleton", "Restricted"),
            ("SSG 08 | Parallax", "Restricted"),
            ("Dual Berettas | Dezastre", "Restricted"),
            ("UMP-45 | Gold Bismuth", "Restricted"),
            ("Nova | Clear Polymer", "Restricted"),
            # Mil-Spec
            ("Galil AR | Vandal", "Mil-spec"),
            ("G3SG1 | Digital Mesh", "Mil-spec"),
            ("P90 | Cocoa Rampage", "Mil-spec"),
            ("MP5-SD | Condition Zero", "Mil-spec"),
            ("CZ75-Auto | Vendetta", "Mil-spec"),
            ("P250 | Contaminant", "Mil-spec"),
            ("M249 | Deep Relief", "Mil-spec"),
        ]
        bf_added = 0
        for name, rarity in bf_skins:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'skin').first()
            if exists:
                if exists.case_id != broken_fang.item_id:
                    exists.case_id = broken_fang.item_id
                continue
            itm = Item(
                name=name,
                item_type='skin',
                rarity=rarity,
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=broken_fang.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            bf_added += 1
        if bf_added:
            db.commit()
            print(f"Přidáno Broken Fang skinů: {bf_added}")

        print("Kontroluji/seeduji Broken Fang Case rukavice (stejné jako Snakebite/Recoil)...")
        # Reuse the Recoil glove list
        recoil_gloves = [
            "Sport Gloves | Slingshot",
            "Sport Gloves | Scarlet Shamagh",
            "Driver Gloves | Snow Leopard",
            "Sport Gloves | Nocts",
            "Moto Gloves | Smoke Out",
            "Specialist Gloves | Marble Fade",
            "Specialist Gloves | Field Agent",
            "Driver Gloves | Black Tie",
            "Moto Gloves | Blood Pressure",
            "Broken Fang Gloves | Jade",
            "Sport Gloves | Big Game",
            "Broken Fang Gloves | Unhinged",
            "Specialist Gloves | Tiger Strike",
            "Moto Gloves | 3rd Commando Company",
            "Moto Gloves | Finish Line",
            "Driver Gloves | Queen Jaguar",
            "Driver Gloves | Rezan the Red",
            "Specialist Gloves | Lt. Commander",
            "Broken Fang Gloves | Needle Point",
            "Broken Fang Gloves | Yellow-banded",
            "Hand Wraps | CAUTION!",
            "Hand Wraps | Giraffe",
            "Hand Wraps | Desert Shamagh",
            "Hand Wraps | Constrictor",
        ]
        bfg_added = 0
        for name in recoil_gloves:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'glove').first()
            if exists:
                if exists.case_id != broken_fang.item_id:
                    exists.case_id = broken_fang.item_id
                continue
            itm = Item(
                name=name,
                item_type='glove',
                rarity='Knife/Glove',
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=broken_fang.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            bfg_added += 1
        if bfg_added:
            db.commit()
            print(f"Přidáno Broken Fang rukavic: {bfg_added}")

    # Snakebite Case skins
    if snakebite:
        print("Kontroluji/seeduji Snakebite Case skiny...")
        snakebite_skins = [
            # Covert
            ("M4A4 | In Living Color", "Covert"),
            ("USP-S | The Traitor", "Covert"),
            # Classified
            ("Galil AR | Chromatic Aberration", "Classified"),
            ("MP9 | Food Chain", "Classified"),
            ("XM1014 | XOXO", "Classified"),
            # Restricted
            ("AK-47 | Slate", "Restricted"),
            ("Desert Eagle | Trigger Discipline", "Restricted"),
            ("Negev | dev_texture", "Restricted"),
            ("P250 | Cyber Shell", "Restricted"),
            ("MAC-10 | Button Masher", "Restricted"),
            # Mil-Spec
            ("Glock-18 | Clear Polymer", "Mil-spec"),
            ("Nova | Windblown", "Mil-spec"),
            ("SG 553 | Heavy Metal", "Mil-spec"),
            ("M249 | O.S.I.P.R.", "Mil-spec"),
            ("UMP-45 | Oscillator", "Mil-spec"),
            ("CZ75-Auto | Circaetus", "Mil-spec"),
            ("R8 Revolver | Junk Yard", "Mil-spec"),
        ]
        sb_added = 0
        for name, rarity in snakebite_skins:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'skin').first()
            if exists:
                if exists.case_id != snakebite.item_id:
                    exists.case_id = snakebite.item_id
                continue
            itm = Item(
                name=name,
                item_type='skin',
                rarity=rarity,
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=snakebite.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            sb_added += 1
        if sb_added:
            db.commit()
            print(f"Přidáno Snakebite skinů: {sb_added}")

        print("Kontroluji/seeduji Snakebite Case nože (stejné jako Recoil)...")
        # Reuse the Kukri knife list used in Recoil/Gallery/Kilowatt
        snakebite_knives = [
            "Kukri Knife | Slaughter",
            "Kukri Knife | Case Hardened",
            "Kukri Knife | Blue Steel",
            "Kukri Knife | Stained",
            "Kukri Knife | Scorched",
            "Kukri Knife | Fade",
            "Kukri Knife | Safari Mesh",
            "Kukri Knife | Boreal Forest",
            "Kukri Knife | Urban Masked",
            "Kukri Knife | Night Stripe",
            "Kukri Knife | Crimson Web",
            "Kukri Knife | Vanilla",
            "Kukri Knife | Forest DDPAT",
        ]
        sbk_added = 0
        for name in snakebite_knives:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'knife').first()
            if exists:
                if exists.case_id != snakebite.item_id:
                    exists.case_id = snakebite.item_id
                continue
            itm = Item(
                name=name,
                item_type='knife',
                rarity='Knife',
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=snakebite.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            sbk_added += 1
        if sbk_added:
            db.commit()
            print(f"Přidáno Snakebite nožů: {sbk_added}")

        # Recoil Case gloves
        print("Kontroluji/seeduji Recoil Case rukavice...")
        recoil_gloves = [
            "Sport Gloves | Slingshot",
            "Sport Gloves | Scarlet Shamagh",
            "Driver Gloves | Snow Leopard",
            "Sport Gloves | Nocts",
            "Moto Gloves | Smoke Out",
            "Specialist Gloves | Marble Fade",
            "Specialist Gloves | Field Agent",
            "Driver Gloves | Black Tie",
            "Moto Gloves | Blood Pressure",
            "Broken Fang Gloves | Jade",
            "Sport Gloves | Big Game",
            "Broken Fang Gloves | Unhinged",
            "Specialist Gloves | Tiger Strike",
            "Moto Gloves | 3rd Commando Company",
            "Moto Gloves | Finish Line",
            "Driver Gloves | Queen Jaguar",
            "Driver Gloves | Rezan the Red",
            "Specialist Gloves | Lt. Commander",
            "Broken Fang Gloves | Needle Point",
            "Broken Fang Gloves | Yellow-banded",
            "Hand Wraps | CAUTION!",
            "Hand Wraps | Giraffe",
            "Hand Wraps | Desert Shamagh",
            "Hand Wraps | Constrictor",
        ]
        rg_added = 0
        for name in recoil_gloves:
            sl = slugify(name)
            exists = db.query(Item).filter(Item.slug == sl, Item.item_type == 'glove').first()
            if exists:
                if exists.case_id != recoil.item_id:
                    exists.case_id = recoil.item_id
                continue
            itm = Item(
                name=name,
                item_type='glove',
                rarity='Knife/Glove',
                wear=None,
                wearValue=None,
                pattern=None,
                collection=None,
                case_id=recoil.item_id,
                current_price=None,
                slug=sl,
            )
            db.add(itm)
            rg_added += 1
        if rg_added:
            db.commit()
            print(f"Přidáno Recoil rukavic: {rg_added}")

    # No sample user inventory seeding

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