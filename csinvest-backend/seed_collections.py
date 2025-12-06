from database import SessionLocal, engine, Base
from models import Item
import re

def slugify(name: str) -> str:
    s = name.lower()
    s = re.sub(r"[|]+", "", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip('-')
    return s

def seed_collections():
    db = SessionLocal()
    
    collections = [
        "The Train 2025 Collection",
        "The Overpass 2024 Collection",
        "The Sport & Field Collection",
        "The Graphic Design Collection",
        "The Ascent Collection",
        "The Boreal Collection",
        "The Radiant Collection",
        "The 2018 Inferno Collection",
        "The 2018 Nuke Collection",
        "The 2021 Dust 2 Collection",
        "The 2021 Mirage Collection",
        "The 2021 Train Collection",
        "The 2021 Vertigo Collection",
        "The Alpha Collection",
        "The Ancient Collection",
        "The Anubis Collection",
        "The Assault Collection",
        "The Aztec Collection",
        "The Baggage Collection",
        "The Bank Collection",
        "The Blacksite Collection",
        "The Cache Collection",
        "The Canals Collection",
        "The Chop Shop Collection",
        "The Cobblestone Collection",
        "The Control Collection",
        "The Dust 2 Collection",
        "The Dust Collection",
        "The Gods and Monsters Collection",
        "The Havoc Collection",
        "The Inferno Collection",
        "The Italy Collection",
        "The Lake Collection",
        "The Militia Collection",
        "The Mirage Collection",
        "The Norse Collection",
        "The Nuke Collection",
        "The Office Collection",
        "The Overpass Collection",
        "The Rising Sun Collection",
        "The Safehouse Collection",
        "The St. Marc Collection",
        "The Train Collection",
        "The Vertigo Collection",
        "The Huntsman Collection"
    ]

    print("Seeding collections...")
    count = 0
    for name in collections:
        slug = slugify(name)
        # Check if exists as collection
        exists = db.query(Item).filter(Item.slug == slug, Item.item_type == 'collection').first()
        if exists:
            print(f"Skipping {name} (already exists)")
            continue
        
        # Create item
        item = Item(
            name=name,
            item_type='collection',
            slug=slug,
            current_price=None
        )
        db.add(item)
        count += 1
    
    db.commit()
    print(f"Added {count} new collections.")
    db.close()

if __name__ == "__main__":
    seed_collections()
