import re

data = """Extraordinary	Baby Karat CT
Extraordinary	Baby Karat T
Exotic	Semi-Precious
Exotic	Titeenium AWP
Exotic	Lil' Squirt
Remarkable	Die-cast AK
Remarkable	Glamour Shot
Remarkable	POP Art
Remarkable	Disco MAC
Remarkable	Hot Hands
High Grade	Baby's AK
High Grade	Whittle Knife
High Grade	Pocket AWP
High Grade	Stitch-Loaded
High Grade	Backsplash
High Grade	Lil' Cap Gun
Extraordinary	Lil' Boo
Extraordinary	Lil' Serpent
Extraordinary	Lil' Eldritch
Extraordinary	Quick Silver
Exotic	Lil' Hero
Exotic	Lil' Happy
Exotic	Piñatita
Exotic	Lil' Chirp
Exotic	Lil' Prick
Remarkable	Magmatude
Remarkable	Lil' Goop
Remarkable	Lil' Moments
Remarkable	Pocket Pop
Remarkable	Lil' Buns
Remarkable	Hang Loose
High Grade	Lil' No. 2
High Grade	Dead Weight
High Grade	Lil' Cackle
High Grade	Lil' Baller
High Grade	Lil' Tusk
High Grade	Lil' Curse
High Grade	Lil' Smokey
High Grade	Lil' Vino
Extraordinary	Hot Howl
Extraordinary	Hot Wurst
Exotic	Diamond Dog
Exotic	Lil' Monster
Exotic	Diner Dog
Remarkable	Lil' Teacup
Remarkable	That's Bananas
Remarkable	Chicken Lil'
Remarkable	Lil' Whiskers
Remarkable	Lil' Sandy
Remarkable	Lil' Squatch
High Grade	Lil' SAS
High Grade	Lil' Crass
High Grade	Hot Sauce
High Grade	Pinch O' Salt
High Grade	Big Kev
High Grade	Lil' Ava
Extraordinary	Butane Buddy
Extraordinary	Glitter Bomb
Extraordinary	Lil' Ferno
Extraordinary	8 Ball IGL
Exotic	Hungry Eyes
Exotic	Lil' Yeti
Exotic	Lil' Eco
Exotic	Flash Bomb
Exotic	Eye of Ball
Remarkable	Lil' Bloody
Remarkable	Bomb Tag
Remarkable	Lil' Dumplin'
Remarkable	Dr. Brian
Remarkable	Big Brain
Remarkable	Lil' Facelift
Remarkable	Lil' Chomper
High Grade	Lil' Zen
High Grade	Splatter Cat
High Grade	Biomech
High Grade	Whittle Guy
High Grade	Gritty
High Grade	Fluffy"""

lines = data.strip().split('\n')
sql_statements = []
slugs = []

for line in lines:
    parts = line.split('\t')
    if len(parts) == 2:
        rarity = parts[0].strip()
        name = parts[1].strip()
        
        # Generate slug
        slug = name.lower()
        slug = re.sub(r"[^a-z0-9\s-]", "", slug)
        slug = re.sub(r"[\s-]+", "-", slug)
        slug = f"charm-{slug}"
        
        slugs.append(slug)
        
        # SQL
        escaped_name = name.replace("'", "''")
        sql = f"INSERT INTO items (slug, name, item_type, rarity) VALUES ('{slug}', '{escaped_name}', 'charm', '{rarity}');"
        sql_statements.append(sql)

print("--- SQL ---")
print("\n".join(sql_statements))
print("\n--- SLUGS ---")
print("\n".join(slugs))
