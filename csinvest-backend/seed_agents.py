import re
import os
from database import SessionLocal
from models import Item
from sqlalchemy import func

# User provided list
raw_data = """
Master Agents

Sir Bloody Skullhead Darryl – Master Agent

Cmdr. Frank "Wet Sox" Baroud – Master Agent

Crasswater The Forgotten – Master Agent

Sir Bloody Silent Darryl – Master Agent

Sir Bloody Loudmouth Darryl – Master Agent

Chef d'Escadron Rouchard – Master Agent

Sir Bloody Miami Darryl – Master Agent

"Medium Rare" Crasswater – Master Agent

Cmdr. Mae "Dead Cold" Jamison – Master Agent

Cmdr. Davida "Goggles" Fernandez – Master Agent

"The Doctor" Romanov – Master Agent

Lt. Commander Ricksaw – Master Agent

Vypa Sista of the Revolution – Master Agent

Sir Bloody Darryl Royale – Master Agent

Special Agent Ava – Master Agent

The Elite Mr. Muhlik – Master Agent

Superior Agents

Rezan the Redshirt – Superior Agent

Number K – Superior Agent

"Two Times" McCoy (TACP Cavalry) – Superior Agent

Elite Trapper Solman – Superior Agent

Bloody Darryl The Strapped – Superior Agent

Safecracker Voltzmann – Superior Agent

Blackwolf – Superior Agent

Lieutenant Rex Krikey – Superior Agent

Chem-Haz Capitaine – Superior Agent

Michael Syfers – Superior Agent

"Two Times" McCoy (USAF TACP) – Superior Agent

Arno The Overgrown – Superior Agent

Rezan The Ready – Superior Agent

1st Lieutenant Farlow – Superior Agent

Prof. Shahmat – Superior Agent

Exceptional Agents

"Blueberries" Buckshot – Exceptional Agent

Buckshot – Exceptional Agent

Little Kev – Exceptional Agent

Getaway Sally – Exceptional Agent

Officer Jacques Beltram – Exceptional Agent

Sous-Lieutenant Medic – Exceptional Agent

Dragomir – Exceptional Agent

Osiris – Exceptional Agent

John "Van Healen" Kask – Exceptional Agent

Maximus – Exceptional Agent

Markus Delrow – Exceptional Agent

Col. Mangos Dabisi – Exceptional Agent

Trapper – Exceptional Agent

Lieutenant "Tree Hugger" Farlow – Exceptional Agent

Sergeant Bombson – Exceptional Agent

Slingshot – Exceptional Agent

Distinguished Agents

Chem-Haz Specialist – Distinguished Agent

Trapper Aggressor – Distinguished Agent

Jungle Rebel – Distinguished Agent

Dragomir (Footsoldier) – Distinguished Agent

Primeiro Tenente – Distinguished Agent

D Squadron Officer – Distinguished Agent

Bio-Haz Specialist – Distinguished Agent

Aspirant – Distinguished Agent

Soldier – Distinguished Agent

B Squadron Officer – Distinguished Agent

Ground Rebel – Distinguished Agent

Enforcer – Distinguished Agent

3rd Commando Company – Distinguished Agent

Street Soldier – Distinguished Agent

Seal Team 6 Soldier – Distinguished Agent

Operator – Distinguished Agent
"""

rarity_map = {
    "Master Agent": "Covert",
    "Superior Agent": "Classified",
    "Exceptional Agent": "Restricted",
    "Distinguished Agent": "Mil-Spec Grade" # Or just Mil-Spec
}

def slugify(name: str) -> str:
    s = name.lower()
    s = re.sub(r"[|]+", "", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip('-')
    return s

def extract_agents_from_html(file_path):
    if not os.path.exists(file_path):
        return {}
    
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Regex to find name and image
    # Structure: <h3><a href="...">Name</a></h3> ... <img ... src="...">
    # We use a non-greedy match for the content in between
    pattern = re.compile(r'<h3><a href="[^"]+">([^<]+)</a></h3>.*?<img.*?src="([^"]+)".*?>', re.DOTALL)
    matches = pattern.findall(content)
    
    agents = {}
    for name, img_src in matches:
        # Decode HTML entities in name if any (e.g. &#39; -> ')
        name = name.replace("&#39;", "'").replace("&amp;", "&")
        agents[name] = img_src
    return agents

def main():
    print("Starting agent seeding...")
    
    # 1. Parse user list
    parsed_agents = []
    lines = raw_data.strip().split('\n')
    current_category = None
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        if "Agents" in line and " – " not in line:
            current_category = line
            continue
            
        if " – " in line:
            parts = line.split(" – ")
            name_part = parts[0].strip()
            rarity_part = parts[1].strip()
            
            # Handle quotes in user input (e.g. "Wet Sox" -> 'Wet Sox')
            # The HTML seems to use single quotes for nicknames usually, but let's keep user input as base
            # We will try to match loosely
            
            parsed_agents.append({
                "user_name": name_part,
                "rarity_label": rarity_part,
                "mapped_rarity": rarity_map.get(rarity_part, "Common")
            })

    print(f"Parsed {len(parsed_agents)} agents from user list.")

    # 2. Extract from HTML
    html_files = [
        "../Broken Fang Agents - CS2 Skins.html",
        "../Broken Fang Agents - CS2 Skins2.html"
    ]
    
    html_agents = {}
    for hf in html_files:
        path = os.path.join(os.path.dirname(__file__), hf)
        extracted = extract_agents_from_html(path)
        html_agents.update(extracted)
        print(f"Extracted {len(extracted)} agents from {hf}")

    print(f"Total unique agents found in HTML: {len(html_agents)}")

    # 3. Match and Seed
    db = SessionLocal()
    
    count_added = 0
    count_skipped = 0
    
    for agent in parsed_agents:
        user_name = agent["user_name"]
        rarity = agent["mapped_rarity"]
        
        # Try to find full name in HTML agents
        # Strategy: Check if user_name is a substring of html_name, or vice versa
        # Also handle " vs ' quotes
        
        matched_name = None
        
        # Normalize user name for matching
        norm_user = user_name.replace('"', "'").lower()
        
        for html_name in html_agents.keys():
            norm_html = html_name.lower()
            
            # Check for exact match or substring
            # User: Cmdr. Frank "Wet Sox" Baroud
            # HTML: Cmdr. Frank 'Wet Sox' Baroud | SEAL Frogman
            
            # Remove the faction from HTML name for comparison
            if "|" in norm_html:
                base_html = norm_html.split("|")[0].strip()
            else:
                base_html = norm_html
                
            if norm_user == base_html:
                matched_name = html_name
                break
            
            # Fallback: if user name is contained in html name (start)
            if norm_html.startswith(norm_user):
                matched_name = html_name
                break
                
        final_name = matched_name if matched_name else user_name
        
        # Create Item
        slug = slugify(final_name)
        
        existing = db.query(Item).filter(Item.slug == slug).first()
        if existing:
            print(f"Skipping existing: {final_name}")
            count_skipped += 1
        else:
            print(f"Adding: {final_name} ({rarity})")
            new_item = Item(
                name=final_name,
                item_type="Agent",
                rarity=rarity,
                slug=slug,
                drop_type="Drop" # Agents are usually bought or from passes, but 'Drop' or 'Case' is fine. Let's use 'Drop' or maybe 'Agent' if that column allows arbitrary strings.
            )
            db.add(new_item)
            count_added += 1
            
    db.commit()
    print(f"Done. Added {count_added}, Skipped {count_skipped}.")

if __name__ == "__main__":
    main()
