from sqlalchemy import text
from database import get_db, engine

def add_columns_if_not_exists():
    with engine.connect() as conn:
        print("Checking if columns exist in USER table...")
        
        # Check csfloat_api_key_ciphertext
        res = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='USER' AND column_name='csfloat_api_key_ciphertext'"))
        if not res.fetchone():
            print("Adding csfloat_api_key_ciphertext...")
            conn.execute(text("ALTER TABLE \"USER\" ADD COLUMN csfloat_api_key_ciphertext VARCHAR"))
        else:
            print("csfloat_api_key_ciphertext exists.")

        # Check csfloat_api_key_iv
        res = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='USER' AND column_name='csfloat_api_key_iv'"))
        if not res.fetchone():
            print("Adding csfloat_api_key_iv...")
            conn.execute(text("ALTER TABLE \"USER\" ADD COLUMN csfloat_api_key_iv VARCHAR"))
        else:
            print("csfloat_api_key_iv exists.")

        # Check csfloat_api_key_tag
        res = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='USER' AND column_name='csfloat_api_key_tag'"))
        if not res.fetchone():
            print("Adding csfloat_api_key_tag...")
            conn.execute(text("ALTER TABLE \"USER\" ADD COLUMN csfloat_api_key_tag VARCHAR"))
        else:
            print("csfloat_api_key_tag exists.")
            
        conn.commit()
        print("Done.")

if __name__ == "__main__":
    add_columns_if_not_exists()
