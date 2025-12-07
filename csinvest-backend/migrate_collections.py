from database import SessionLocal, engine
from models import Item
from sqlalchemy import text

def migrate_collections():
    session = SessionLocal()
    
    # 1. Add column if not exists
    print("Checking/Adding collection_id column...")
    try:
        with engine.connect() as conn:
            conn.execute(text('ALTER TABLE "ITEM" ADD COLUMN collection_id INTEGER REFERENCES "ITEM"(item_id)'))
            conn.commit()
            print("Column collection_id added.")
    except Exception as e:
        print(f"Column might already exist or error: {e}")

    # 2. Link skins to collections
    print("Linking skins to collections...")
    
    # Get all collections first
    collections = session.query(Item).filter(Item.item_type == 'collection').all()
    collection_map = {c.name: c.item_id for c in collections}
    
    print(f"Found {len(collections)} collections.")
    
    # Get all skins with a collection string but no collection_id
    skins = session.query(Item).filter(
        Item.item_type == 'skin', 
        Item.collection.isnot(None)
    ).all()
    
    count = 0
    for skin in skins:
        if skin.collection in collection_map:
            if skin.collection_id != collection_map[skin.collection]:
                skin.collection_id = collection_map[skin.collection]
                count += 1
        else:
            # Try fuzzy match or just log missing
            pass
            
    session.commit()
    print(f"Updated {count} skins with collection_id.")
    session.close()

if __name__ == "__main__":
    migrate_collections()
