from database import SessionLocal
from models import Item

def update_collection_droptypes():
    db = SessionLocal()
    
    active_collections = [
        "The 2018 Inferno Collection",
        "The 2018 Nuke Collection",
        "The Ascent Collection",
        "The Boreal Collection",
        "The Dust 2 Collection",
        "The Radiant Collection",
        "The Safehouse Collection"
    ]

    obtainable_collections = [
        "The Overpass 2024 Collection",
        "The Sport & Field Collection",
        "The Train 2025 Collection",
        "The 2021 Dust 2 Collection",
        "The 2021 Mirage Collection",
        "The 2021 Train Collection",
        "The 2021 Vertigo Collection"
    ]

    print("Updating collection drop types...")
    
    collections = db.query(Item).filter(Item.item_type == 'collection').all()
    
    updated_count = 0
    for col in collections:
        old_type = col.drop_type
        new_type = "Not-obtainable" # Default
        
        if col.name in active_collections:
            new_type = "Active"
        elif col.name in obtainable_collections:
            new_type = "Obtainable"
            
        if old_type != new_type:
            col.drop_type = new_type
            updated_count += 1
            # print(f"Updated {col.name}: {old_type} -> {new_type}")

    db.commit()
    print(f"Updated drop_type for {updated_count} collections.")
    db.close()

if __name__ == "__main__":
    update_collection_droptypes()
