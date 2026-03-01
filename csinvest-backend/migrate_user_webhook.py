from database import engine
from sqlalchemy import text
from sqlalchemy.engine import reflection

def migrate():
    insp = reflection.Inspector.from_engine(engine)
    columns = [c['name'] for c in insp.get_columns('USER')]
    
    if 'discord_portfolio_webhook_url' not in columns:
        print("Adding discord_portfolio_webhook_url to USER table...")
        with engine.connect() as conn:
            # SQLite syntax is slightly different for ALTER TABLE depending on version, 
            # but ADD COLUMN works on SQLite 3.1.3+ and Postgres/MySQL
            try:
                # Quote "USER" because it's a reserved word in Postgres
                conn.execute(text('ALTER TABLE "USER" ADD COLUMN discord_portfolio_webhook_url VARCHAR'))
                print("Migration successful.")
            except Exception as e:
                print(f"Migration failed: {e}")
    else:
        print("Column discord_portfolio_webhook_url already exists.")

if __name__ == "__main__":
    migrate()
