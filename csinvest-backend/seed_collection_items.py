from database import SessionLocal
from models import Item
import re

def slugify(name: str) -> str:
    s = name.lower()
    s = re.sub(r"[|]+", "", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip('-')
    return s

def seed_collection_items():
    db = SessionLocal()
    print("Seeding collection items...")

    # ---------------------------------------------------------
    # ZDE VLOZTE NAZVY SKINU PRO JEDNOTLIVE KOLEKCE
    # Format: ("Nazev skinu", "Rarity")
    # Rarity: Consumer Grade, Industrial Grade, Mil-Spec Grade, Restricted, Classified, Covert, Contraband
    # ---------------------------------------------------------

    # The Train 2025 Collection
    train_2025_skins = [
        ("AWP | LongDog", "Covert"),
("M4A4 | Hellish", "Classified"),
("MP9 | Latte Rush", "Classified"),
("Tec-9 | Whiteout", "Restricted"),
("Zeus x27 | Charged Up", "Restricted"),
("MAC-10 | Derailment", "Restricted"),
("Glock-18 | Green Line", "Mil-Spec"),
("UMP-45 | Late Night Transit", "Mil-Spec"),
("FAMAS | 2A2F", "Mil-Spec"),
("XM1014 | Run Run Run", "Mil-Spec"),
("Galil AR | Green Apple", "Industrial Grade"),
("P90 | Straight Dimes", "Industrial Grade"),
("AUG | Steel Sentinel", "Industrial Grade"),
("P250 | Constructivist", "Industrial Grade"),
("Nova | Rain Station", "Industrial Grade"),
("CZ75-Auto | Copper Fiber", "Industrial Grade")
    ]

    # The Overpass 2024 Collection
    overpass_2024_skins = [
        ("AK-47 | B the Monster", "Covert"),
("AWP | Crakow!", "Classified"),
("Zeus x27 | Dragon Snore", "Classified"),
("Dual Berettas | Sweet Little Angels", "Restricted"),
("AUG | Eye of Zapems", "Restricted"),
("XM1014 | Monster Melt", "Restricted"),
("MAC-10 | Pipsqueak", "Mil-Spec"),
("Nova | Wurst Hölle", "Mil-Spec"),
("Galil AR | Metallic Squeezer", "Mil-Spec"),
("Glock-18 | Teal Graf", "Mil-Spec"),
("Desert Eagle | Tilted", "Industrial Grade"),
("M4A1-S | Wash me plz", "Industrial Grade"),
("Negev | Wall Bang", "Industrial Grade"),
("Five-SeveN | Midnight Paintover", "Industrial Grade"),
("P90 | Wash me", "Industrial Grade"),
("MP5-SD | Neon Squeezer", "Industrial Grade")
    ]

    # The Sport & Field Collection
    sport_field_skins = [
        ("M4A1-S | Fade", "Covert"),
("Glock-18 | AXIA", "Classified"),
("Galil AR | Rainbow Spoon", "Classified"),
("Five-SeveN | Heat Treated", "Restricted"),
("MP9 | Arctic Tri-Tone", "Restricted"),
("UMP-45 | Crimson Foil", "Restricted"),
("USP-S | Alpine Camo", "Mil-Spec"),
("Nova | Yorkshire", "Mil-Spec"),
("SSG 08 | Zeno", "Mil-Spec"),
("P250 | Small Game", "Mil-Spec"),
("AK-47 | Olive Polycam", "Industrial Grade"),
("FAMAS | Half Sleeve", "Industrial Grade"),
("PP-Bizon | Cold Cell", "Industrial Grade"),
("Tec-9 | Tiger Stencil", "Industrial Grade"),
("MAG-7 | Wildwood", "Industrial Grade"),
("MP5-SD | Savannah Halftone", "Industrial Grade")
    ]

    # The Graphic Design Collection
    graphic_design_skins = [
        ("AWP | CMYK", "Covert"),
("Desert Eagle | Starcade", "Classified"),
("AUG | Lil' Pig", "Classified"),
("M4A4 | Polysoup", "Restricted"),
("CZ75-Auto | Slalom", "Restricted"),
("P90 | Attack Vector", "Restricted"),
("AK-47 | Crossfade", "Mil-Spec"),
("SG 553 | Berry Gel Coat", "Mil-Spec"),
("SCAR-20 | Wild Berry", "Mil-Spec"),
("XM1014 | Halftone Shift", "Mil-Spec"),
("MP7 | Astrolabe", "Industrial Grade"),
("Galil AR | NV", "Industrial Grade"),
("FAMAS | Halftone Wash", "Industrial Grade"),
("M249 | Spectrogram", "Industrial Grade"),
("P2000 | Coral Halftone", "Industrial Grade"),
("SSG 08 | Halftone Whorl", "Industrial Grade")
    ]

    # The Ascent Collection
    ascent_skins = [
        ("M4A1-S | Stratosphere", "Classified"),
("AK-47 | Midnight Laminate", "Restricted"),
("USP-S | Royal Guard", "Restricted"),
("FAMAS | Yeti Camo", "Mil-Spec"),
("MP9 | Cobalt Paisley", "Mil-Spec"),
("Desert Eagle | Mint Fan", "Mil-Spec"),
("P2000 | Royal Baroque", "Mil-Spec"),
("P90 | Reef Grief", "Mil-Spec"),
("Glock-18 | Ocean Topo", "Industrial Grade"),
("Zeus x27 | Electric Blue", "Industrial Grade"),
("M4A4 | Naval Shred Camo", "Industrial Grade"),
("Negev | Sour Grapes", "Industrial Grade"),
("Five-SeveN | Sky Blue", "Industrial Grade"),
("Galil AR | Robin's Egg", "Industrial Grade"),
("Dual Berettas | Rose Nacre", "Industrial Grade"),
("XM1014 | Gum Wall Camo", "Industrial Grade"),
("Nova | Turquoise Pour", "Industrial Grade"),
("Tec-9 | Blue Blast", "Consumer Grade"),
("MP9 | Buff Blue", "Consumer Grade"),
("R8 Revolver | Cobalt Grip", "Consumer Grade"),
("MAC-10 | Storm Camo", "Consumer Grade"),
("SG 553 | Night Camo", "Consumer Grade"),
("Sawed-Off | Runoff", "Consumer Grade"),
("Galil AR | Grey Smoke", "Consumer Grade"),
("MP5-SD | Lime Hex", "Consumer Grade"),
("P250 | Plum Netting", "Consumer Grade"),
("SSG 08 | Grey Smoke", "Consumer Grade"),
("P90 | Blue Tac", "Consumer Grade")
    ]

    # The Boreal Collection
    boreal_skins = [
        ("AWP | Green Energy", "Classified"),
("M4A4 | Sheet Lightning", "Restricted"),
("Glock-18 | Glockingbird", "Restricted"),
("AK-47 | Wintergreen", "Mil-Spec"),
("USP-S | Tropical Breeze", "Mil-Spec"),
("MAC-10 | Poplar Thicket", "Mil-Spec"),
("MP5-SD | Gold Leaf", "Mil-Spec"),
("XM1014 | Copperflage", "Mil-Spec"),
("AK-47 | VariCamo Grey", "Industrial Grade"),
("Dual Berettas | Polished Malachite", "Industrial Grade"),
("Tec-9 | Garter-9", "Industrial Grade"),
("Galil AR | Acid Dart", "Industrial Grade"),
("P2000 | Marsh", "Industrial Grade"),
("P90 | Mustard Gas", "Industrial Grade"),
("SSG 08 | Tiger Tear", "Industrial Grade"),
("MAC-10 | Acid Hex", "Industrial Grade"),
("R8 Revolver | Leafhopper", "Industrial Grade"),
("SSG 08 | Green Ceramic", "Consumer Grade"),
("P250 | Copper Oxide", "Consumer Grade"),
("FAMAS | Palm", "Consumer Grade"),
("UMP-45 | Green Swirl", "Consumer Grade"),
("Tec-9 | Raw Ceramic", "Consumer Grade"),
("MP9 | Pine", "Consumer Grade"),
("Negev | Raw Ceramic", "Consumer Grade"),
("Zeus x27 | Swamp DDPAT", "Consumer Grade"),
("M249 | Sage Camo", "Consumer Grade"),
("G3SG1 | Green Cell", "Consumer Grade"),
("MAG-7 | Copper Oxide", "Consumer Grade"),
("AUG | Commando Company", "Consumer Grade")
    ]

    # The Radiant Collection
    radiant_skins = [
        ("AK-47 | Nouveau Rouge", "Classified"),
("Desert Eagle | Mulberry", "Restricted"),
("M4A1-S | Glitched Paint", "Restricted"),
("USP-S | Bleeding Edge", "Restricted"),
("Glock-18 | Coral Bloom", "Mil-Spec"),
("AWP | Arsenic Spill", "Mil-Spec"),
("P250 | Red Tide", "Mil-Spec"),
("SSG 08 | Blush Pour", "Mil-Spec"),
("MP9 | Shredded", "Mil-Spec"),
("M4A1-S | Rose Hex", "Mil-Spec"),
("M4A4 | Steel Work", "Industrial Grade"),
("P250 | Sedimentary", "Industrial Grade"),
("Galil AR | O-Ranger", "Industrial Grade"),
("Tec-9 | Citric Acid", "Industrial Grade"),
("SG 553 | Basket Halftone", "Industrial Grade"),
("FAMAS | Grey Ghost", "Industrial Grade"),
("MAC-10 | Bronzer", "Consumer Grade"),
("MP7 | Short Ochre", "Consumer Grade"),
("Dual Berettas | BorDeux", "Consumer Grade"),
("SCAR-20 | Short Ochre", "Consumer Grade"),
("Five-SeveN | Autumn Thicket", "Consumer Grade"),
("CZ75-Auto | Pink Pearl", "Consumer Grade"),
("G3SG1 | Red Jasper", "Consumer Grade"),
("XM1014 | Canvas Cloud", "Consumer Grade"),
("Nova | Marsh Grass", "Consumer Grade"),
("MP9 | Multi-Terrain", "Consumer Grade"),
("P90 | Desert Halftone", "Consumer Grade"),
("PP-Bizon | Wood Block Camo", "Consumer Grade")
    ]

    # The 2018 Inferno Collection
    inferno_2018_skins = [
        ("Dual Berettas | Twin Turbo", "Classified"),
("SG 553 | Integrale", "Classified"),
("P250 | Vino Primo", "Restricted"),
("AK-47 | Safety Net", "Restricted"),
("MP7 | Fade", "Restricted"),
("SSG 08 | Hand Brake", "Mil-Spec"),
("M4A4 | Converter", "Mil-Spec"),
("USP-S | Check Engine", "Mil-Spec"),
("Sawed-Off | Brake Light", "Mil-Spec"),
("R8 Revolver | Nitro", "Industrial Grade"),
("Glock-18 | High Beam", "Industrial Grade"),
("MAC-10 | Calf Skin", "Industrial Grade"),
("PP-Bizon | Candy Apple", "Industrial Grade"),
("MP9 | Slide", "Consumer Grade"),
("MP5-SD | Dirt Drop", "Consumer Grade"),
("UMP-45 | Mudder", "Consumer Grade"),
("MAG-7 | Rust Coat", "Consumer Grade"),
("AUG | Sweeper", "Consumer Grade")
    ]

    # The 2018 Nuke Collection
    nuke_2018_skins = [
        ("M4A1-S | Control Panel", "Classified"),
("Tec-9 | Remote Control", "Classified"),
("Glock-18 | Nuclear Garden", "Restricted"),
("MAG-7 | Core Breach", "Restricted"),
("AUG | Random Access", "Restricted"),
("AWP | Acheron", "Mil-Spec"),
("MP5-SD | Co-Processor", "Mil-Spec"),
("P250 | Exchanger", "Mil-Spec"),
("P90 | Facility Negative", "Mil-Spec"),
("Galil AR | Cold Fusion", "Industrial Grade"),
("M4A4 | Mainframe", "Industrial Grade"),
("Negev | Bulkhead", "Industrial Grade"),
("MP7 | Motherboard", "Industrial Grade"),
("PP-Bizon | Facility Sketch", "Consumer Grade"),
("Five-SeveN | Coolant", "Consumer Grade"),
("P250 | Facility Draft", "Consumer Grade"),
("Nova | Mandrel", "Consumer Grade"),
("UMP-45 | Facility Dark", "Consumer Grade")
    ]

    # The 2021 Dust 2 Collection
    dust_2_2021_skins = [
        ("AK-47 | Gold Arabesque", "Covert"),
("SSG 08 | Death Strike", "Classified"),
("UMP-45 | Fade", "Classified"),
("M4A4 | Red DDPAT", "Restricted"),
("USP-S | Orange Anolis", "Restricted"),
("MAC-10 | Case Hardened", "Restricted"),
("P250 | Black & Tan", "Mil-Spec"),
("Galil AR | Amber Fade", "Mil-Spec"),
("G3SG1 | New Roots", "Mil-Spec"),
("Nova | Quick Sand", "Mil-Spec"),
("Five-SeveN | Withered Vine", "Industrial Grade"),
("MP9 | Old Roots", "Industrial Grade"),
("AUG | Spalted Wood", "Industrial Grade"),
("M249 | Midnight Palm", "Industrial Grade"),
("P90 | Desert DDPAT", "Consumer Grade"),
("MP7 | Prey", "Consumer Grade"),
("SG 553 | Bleached", "Consumer Grade"),
("Sawed-Off | Parched", "Consumer Grade"),
("R8 Revolver | Desert Brush", "Consumer Grade")
    ]

    # The 2021 Mirage Collection
    mirage_2021_skins = [
        ("AWP | Desert Hydra", "Covert"),
("Desert Eagle | Fennec Fox", "Classified"),
("MP5-SD | Oxide Oasis", "Classified"),
("Glock-18 | Pink DDPAT", "Restricted"),
("AUG | Sand Storm", "Restricted"),
("XM1014 | Elegant Vines", "Restricted"),
("USP-S | Purple DDPAT", "Mil-Spec"),
("SG 553 | Desert Blossom", "Mil-Spec"),
("M249 | Humidor", "Mil-Spec"),
("MP9 | Music Box", "Mil-Spec"),
("P90 | Verdant Growth", "Industrial Grade"),
("Dual Berettas | Drift Wood", "Industrial Grade"),
("CZ75-Auto | Midnight Palm", "Industrial Grade"),
("FAMAS | CaliCamo", "Industrial Grade"),
("SSG 08 | Prey", "Consumer Grade"),
("P250 | Drought", "Consumer Grade"),
("MAG-7 | Navy Sheen", "Consumer Grade"),
("MAC-10 | Sienna Damask", "Consumer Grade"),
("PP-Bizon | Anolis", "Consumer Grade")
    ]

    # The 2021 Train Collection
    train_2021_skins = [
        ("M4A4 | The Coalition", "Covert"),
("Glock-18 | Gamma Doppler", "Covert"),
("USP-S | Whiteout", "Classified"),
("FAMAS | Meltdown", "Classified"),
("MAC-10 | Propaganda", "Classified"),
("AWP | POP AWP", "Restricted"),
("P2000 | Space Race", "Restricted"),
("Nova | Red Quartz", "Restricted"),
("CZ75-Auto | Syndicate", "Restricted"),
("MP5-SD | Autumn Twilly", "Restricted"),
("M4A1-S | Fizzy POP", "Mil-Spec"),
("AUG | Amber Fade", "Mil-Spec"),
("Desert Eagle | Sputnik", "Mil-Spec"),
("R8 Revolver | Blaze", "Mil-Spec"),
("Tec-9 | Safety Net", "Mil-Spec"),
("SSG 08 | Spring Twilly", "Mil-Spec"),
("UMP-45 | Full Stop", "Mil-Spec")
    ]

    # The 2021 Vertigo Collection
    vertigo_2021_skins = [
        ("M4A1-S | Imminent Danger", "Covert"),
        ("Five-SeveN | Fall Hazard", "Classified"),
        ("SG 553 | Hazard Pay", "Classified"),
        ("P250 | Digital Architect", "Restricted"),
        ("Galil AR | CAUTION!", "Restricted"),
        ("MAG-7 | Prism Terrace", "Restricted"),
        ("AK-47 | Green Laminate", "Mil-Spec"),
        ("P90 | Schematic", "Mil-Spec"),
        ("Nova | Interlock", "Mil-Spec"),
        ("Negev | Infrastructure", "Mil-Spec"),
        ("SSG 08 | Carbon Fiber", "Industrial Grade"),
        ("Glock-18 | Red Tire", "Industrial Grade"),
        ("PP-Bizon | Breaker Box", "Industrial Grade"),
        ("UMP-45 | Mechanism", "Industrial Grade"),
        ("CZ75-Auto | Framework", "Consumer Grade"),
        ("FAMAS | Faulty Wiring", "Consumer Grade"),
        ("MAC-10 | Strats", "Consumer Grade"),
        ("Dual Berettas | Oil Change", "Consumer Grade"),
        ("XM1014 | Blue Tire", "Consumer Grade")
    ]

    # The Alpha Collection
    alpha_skins = [
        ("FAMAS | Spitfire", "Restricted"),
("SCAR-20 | Emerald", "Restricted"),
("MAG-7 | Hazard", "Mil-Spec"),
("AUG | Anodized Navy", "Mil-Spec"),
("PP-Bizon | Rust Coat", "Mil-Spec"),
("Glock-18 | Sand Dune", "Industrial Grade"),
("Sawed-Off | Mosaico", "Industrial Grade"),
("SSG 08 | Mayan Dreams", "Industrial Grade"),
("Negev | Palm", "Industrial Grade"),
("P250 | Facets", "Industrial Grade"),
("Tec-9 | Tornado", "Consumer Grade"),
("XM1014 | Jungle", "Consumer Grade"),
("MP9 | Dry Season", "Consumer Grade"),
("MP7 | Groundwater", "Consumer Grade"),
("M249 | Jungle DDPAT", "Consumer Grade"),
("Five-SeveN | Anodized Gunmetal", "Consumer Grade")
    ]

    # The Ancient Collection
    ancient_skins = [
        ("M4A1-S | Welcome to the Jungle", "Covert"),
("AK-47 | Panthera onca", "Classified"),
("P90 | Run and Hide", "Classified"),
("XM1014 | Ancient Lore", "Restricted"),
("MAC-10 | Gold Brick", "Restricted"),
("USP-S | Ancient Visions", "Restricted"),
("Galil AR | Dusk Ruins", "Mil-Spec"),
("AUG | Carved Jade", "Mil-Spec"),
("FAMAS | Dark Water", "Mil-Spec"),
("Tec-9 | Blast From the Past", "Mil-Spec"),
("CZ75-Auto | Silver", "Industrial Grade"),
("MP7 | Tall Grass", "Industrial Grade"),
("P2000 | Panther Camo", "Industrial Grade"),
("G3SG1 | Ancient Ritual", "Industrial Grade"),
("P90 | Ancient Earth", "Consumer Grade"),
("SG 553 | Lush Ruins", "Consumer Grade"),
("SSG 08 | Jungle Dashed", "Consumer Grade"),
("R8 Revolver | Night", "Consumer Grade"),
("Nova | Army Sheen", "Consumer Grade")
    ]

    # The Anubis Collection
    anubis_skins = [
        ("M4A4 | Eye of Horus", "Covert"),
("FAMAS | Waters of Nephthys", "Classified"),
("P250 | Apep's Curse", "Classified"),
("Glock-18 | Ramese's Reach", "Restricted"),
("P90 | ScaraB Rush", "Restricted"),
("Nova | Sobek's Bite", "Restricted"),
("AWP | Black Nile", "Mil-Spec"),
("AK-47 | Steel Delta", "Mil-Spec"),
("Tec-9 | Mummy's Rot", "Mil-Spec"),
("MAG-7 | Copper Coated", "Mil-Spec"),
("M4A1-S | Mud-Spec", "Industrial Grade"),
("USP-S | Desert Tactical", "Industrial Grade"),
("SSG 08 | Azure Glyph", "Industrial Grade"),
("MAC-10 | Echoing Sands", "Industrial Grade"),
("MP7 | Sunbaked", "Consumer Grade"),
("XM1014 | Hieroglyph", "Consumer Grade"),
("R8 Revolver | Inlay", "Consumer Grade"),
("AUG | Snake Pit", "Consumer Grade"),
("M249 | Submerged", "Consumer Grade")
    ]

    # The Assault Collection
    assault_skins = [
        ("MP9 | Bulldozer", "Restricted"),
("Glock-18 | Fade", "Restricted"),
("AUG | Hot Rod", "Mil-Spec"),
("Negev | Anodized Navy", "Mil-Spec"),
("Five-SeveN | Candy Apple", "Industrial Grade"),
("UMP-45 | Caramel", "Consumer Grade"),
("SG 553 | Tornado", "Consumer Grade")
    ]

    # The Aztec Collection
    aztec_skins = [
        ("Tec-9 | Ossified", "Mil-Spec"),
("AK-47 | Jungle Spray", "Industrial Grade"),
("M4A4 | Jungle Tiger", "Industrial Grade"),
("Five-SeveN | Jungle", "Consumer Grade"),
("Nova | Forest Leaves", "Consumer Grade"),
("SSG 08 | Lichen Dashed", "Consumer Grade")
    ]

    # The Baggage Collection
    baggage_skins = [
        ("AK-47 | Jet Set", "Classified"),
("AK-47 | First Class", "Restricted"),
("Desert Eagle | Pilot", "Restricted"),
("Sawed-Off | First Class", "Mil-Spec"),
("XM1014 | Red Leather", "Mil-Spec"),
("USP-S | Business Class", "Mil-Spec"),
("MAC-10 | Commuter", "Industrial Grade"),
("P2000 | Coach Class", "Industrial Grade"),
("P90 | Leather", "Industrial Grade"),
("SG 553 | Traveler", "Industrial Grade"),
("SSG 08 | Sand Dune", "Consumer Grade"),
("G3SG1 | Contractor", "Consumer Grade"),
("MP9 | Green Plaid", "Consumer Grade"),
("CZ75-Auto | Green Plaid", "Consumer Grade"),
("MP7 | Olive Plaid", "Consumer Grade")
    ]

    # The Bank Collection
    bank_skins = [
        ("P250 | Franklin", "Classified"),
("AK-47 | Emerald Pinstripe", "Restricted"),
("Desert Eagle | Meteorite", "Mil-Spec"),
("Galil AR | Tuxedo", "Mil-Spec"),
("CZ75-Auto | Tuxedo", "Mil-Spec"),
("MAC-10 | Silver", "Industrial Grade"),
("Glock-18 | Death Rattle", "Industrial Grade"),
("UMP-45 | Carbon Fiber", "Industrial Grade"),
("G3SG1 | Green Apple", "Industrial Grade"),
("Nova | Caged Steel", "Industrial Grade"),
("R8 Revolver | Bone Mask", "Consumer Grade"),
("Tec-9 | Urban DDPAT", "Consumer Grade"),
("MP7 | Forest DDPAT", "Consumer Grade"),
("Sawed-Off | Forest DDPAT", "Consumer Grade"),
("SG 553 | Army Sheen", "Consumer Grade"),
("Negev | Army Sheen", "Consumer Grade")
    ]

    # The Blacksite Collection
    blacksite_skins = [
        ("MP5-SD | Lab Rats", "Restricted")
    ]

    # The Cache Collection
    cache_skins = [
        ("Galil AR | Cerberus", "Restricted"),
("FAMAS | Styx", "Restricted"),
("Glock-18 | Reactor", "Mil-Spec"),
("MP9 | Setting Sun", "Mil-Spec"),
("Tec-9 | Toxic", "Mil-Spec"),
("MAC-10 | Nuclear Garden", "Mil-Spec"),
("XM1014 | Bone Machine", "Mil-Spec"),
("Five-SeveN | Hot Shot", "Industrial Grade"),
("PP-Bizon | Chemical Green", "Industrial Grade"),
("P250 | Contamination", "Industrial Grade"),
("Negev | Nuclear Waste", "Industrial Grade"),
("SG 553 | Fallout Warning", "Industrial Grade"),
("AUG | Radiation Hazard", "Industrial Grade")
    ]

    # The Canals Collection
    canals_skins = [
        ("AWP | The Prince", "Covert"),
("MAG-7 | Cinquedea", "Classified"),
("Nova | Baroque Orange", "Restricted"),
("MP9 | Stained Glass", "Restricted"),
("MAC-10 | Red Filigree", "Restricted"),
("P90 | Baroque Red", "Mil-Spec"),
("Dual Berettas | Emerald", "Mil-Spec"),
("SSG 08 | Orange Filigree", "Mil-Spec"),
("G3SG1 | Violet Murano", "Mil-Spec"),
("AK-47 | Baroque Purple", "Industrial Grade"),
("SG 553 | Candy Apple", "Industrial Grade"),
("Tec-9 | Orange Murano", "Industrial Grade"),
("P250 | Dark Filigree", "Industrial Grade"),
("CZ75-Auto | Indigo", "Consumer Grade"),
("Negev | Boroque Sand", "Consumer Grade"),
("R8 Revolver | Canal Spray", "Consumer Grade"),
("AUG | Navy Murano", "Consumer Grade"),
("SCAR-20 | Stone Mosaico", "Consumer Grade")
    ]

    # The Chop Shop Collection
    chop_shop_skins = [
        ("Glock-18 | Twilight Galaxy", "Classified"),
("M4A1-S | Hot Rod", "Classified"),
("Dual Berettas | Duelist", "Restricted"),
("SG 553 | Bulldozer", "Restricted"),
("P250 | Whiteout", "Mil-Spec"),
("MAC-10 | Fade", "Mil-Spec"),
("CZ75-Auto | Emerald", "Mil-Spec"),
("MP7 | Full Stop", "Mil-Spec"),
("Five-SeveN | Nitro", "Mil-Spec"),
("Desert Eagle | Night", "Industrial Grade"),
("USP-S | Para Green", "Industrial Grade"),
("Galil AR | Urban Rubble", "Industrial Grade"),
("SCAR-20 | Army Sheen", "Consumer Grade"),
("CZ75-Auto | Army Sheen", "Consumer Grade"),
("MAG-7 | Seabird", "Consumer Grade"),
("M249 | Impact Drill", "Consumer Grade")
    ]

    # The Cobblestone Collection
    cobblestone_skins = [
        ("AWP | Dragon Lore", "Covert"),
("M4A1-S | Knight", "Classified"),
("Desert Eagle | Hand Cannon", "Restricted"),
("CZ75-Auto | Chalice", "Restricted"),
("MP9 | Dark Age", "Mil-Spec"),
("P2000 | Chainmail", "Mil-Spec"),
("USP-S | Royal Blue", "Industrial Grade"),
("MAG-7 | Silver", "Industrial Grade"),
("Nova | Green Apple", "Industrial Grade"),
("Sawed-Off | Rust Coat", "Industrial Grade"),
("MAC-10 | Indigo", "Consumer Grade"),
("P90 | Storm", "Consumer Grade"),
("UMP-45 | Indigo", "Consumer Grade"),
("SCAR-20 | Storm", "Consumer Grade"),
("Dual Berettas | Briar", "Consumer Grade")
    ]

    # The Control Collection
    control_skins = [
        ("AWP | Fade", "Covert"),
("M4A1-S | Blue Phosphor", "Classified"),
("USP-S | Target Acquired", "Classified"),
("Five-SeveN | Berries And Cherries", "Restricted"),
("UMP-45 | Crime Scene", "Restricted"),
("FAMAS | Prime Conspiracy", "Restricted"),
("M4A4 | Global Offensive", "Mil-Spec"),
("SCAR-20 | Magna Carta", "Mil-Spec"),
("SSG 08 | Threat Detected", "Mil-Spec"),
("P2000 | Dispatch", "Mil-Spec"),
("Desert Eagle | The Bronze", "Industrial Grade"),
("MP5-SD | Nitro", "Industrial Grade"),
("MAG-7 | Carbon Fiber", "Industrial Grade"),
("Dual Berettas | Switch Board", "Industrial Grade"),
("P250 | Forest Night", "Consumer Grade"),
("CZ75-Auto | Jungle Dashed", "Consumer Grade"),
("XM1014 | Charter", "Consumer Grade"),
("MP9 | Army Sheen", "Consumer Grade"),
("AUG | Surveillance", "Consumer Grade")
    ]

    # The Dust 2 Collection
    dust_2_skins = [
        ("R8 Revolver | Amber Fade", "Classified"),
("P2000 | Amber Fade", "Restricted"),
("PP-Bizon | Brass", "Mil-Spec"),
("M4A1-S | VariCamo", "Mil-Spec"),
("SG 553 | Damascus Steel", "Mil-Spec"),
("AK-47 | Safari Mesh", "Industrial Grade"),
("Five-SeveN | Orange Peel", "Industrial Grade"),
("Sawed-Off | Snake Camo", "Industrial Grade"),
("MAC-10 | Palm", "Industrial Grade"),
("Tec-9 | VariCamo", "Industrial Grade"),
("P250 | Sand Dune", "Consumer Grade"),
("MP9 | Sand Dashed", "Consumer Grade"),
("G3SG1 | Desert Storm", "Consumer Grade"),
("Nova | Predator", "Consumer Grade"),
("P90 | Sand Spray", "Consumer Grade"),
("SCAR-20 | Sand Mesh", "Consumer Grade")
    ]

    # The Dust Collection
    dust_skins = [
        ("Desert Eagle | Blaze", "Restricted"),
("Glock-18 | Brass", "Restricted"),
("P2000 | Scorpion", "Restricted"),
("AWP | Snake Camo", "Mil-Spec"),
("Sawed-Off | Copper", "Mil-Spec"),
("AUG | Copperhead", "Mil-Spec"),
("SCAR-20 | Palm", "Industrial Grade"),
("AK-47 | Predator", "Industrial Grade"),
("M4A4 | Desert Storm", "Industrial Grade")
    ]

    # The Gods and Monsters Collection
    gods_monsters_skins = [
        ("AWP | Medusa", "Covert"),
("M4A4 | Poseidon", "Classified"),
("M4A1-S | Icarus Fell", "Restricted"),
("G3SG1 | Chronos", "Restricted"),
("MP9 | Pandora's Box", "Mil-Spec"),
("UMP-45 | Minotaur's Labyrinth", "Mil-Spec"),
("AWP | Sun in Leo", "Industrial Grade"),
("Tec-9 | Hades", "Industrial Grade"),
("M249 | Shipping Forecast", "Industrial Grade"),
("P2000 | Pathfinder", "Industrial Grade"),
("Nova | Moon in Libra", "Consumer Grade"),
("Dual Berettas | Moon in Libra", "Consumer Grade"),
("AUG | Daedalus", "Consumer Grade"),
("MP7 | Asterion", "Consumer Grade")
    ]

    # The Havoc Collection
    havoc_skins = [
        ("AK-47 | X-Ray", "Covert"),
("AWP | Silk Tiger", "Classified"),
("MAC-10 | Hot Snakes", "Classified"),
("Glock-18 | Franklin", "Restricted"),
("Galil AR | Phoenix Blacklight", "Restricted"),
("SG 553 | Hypnotic", "Restricted"),
("Desert Eagle | Night Heist", "Mil-Spec"),
("Negev | Phoenix Stencil", "Mil-Spec"),
("P250 | Bengal Tiger", "Mil-Spec"),
("P90 | Tiger Pit", "Mil-Spec"),
("MP7 | Vault Heist", "Industrial Grade"),
("Nova | Rust Coat", "Industrial Grade"),
("UMP-45 | Houndstooth", "Industrial Grade"),
("R8 Revolver | Phoenix Marker", "Industrial Grade"),
("PP-Bizon | Death Rattle", "Consumer Grade"),
("Sawed-Off | Clay Ambush", "Consumer Grade"),
("Tec-9 | Phoenix Chalk", "Consumer Grade"),
("Dual Berettas | Heist", "Consumer Grade"),
("M249 | Predator", "Consumer Grade")
    ]

    # The Inferno Collection
    inferno_skins = [
        ("Tec-9 | Brass", "Mil-Spec"),
("Dual Berettas | Anodized Navy", "Mil-Spec"),
("M4A4 | Tornado", "Industrial Grade"),
("P250 | Gunsmoke", "Industrial Grade"),
("MAG-7 | Sand Dune", "Consumer Grade"),
("Nova | Walnut", "Consumer Grade")
    ]

    # The Italy Collection
    italy_skins = [
        ("AWP | Pit Viper", "Restricted"),
("Glock-18 | Candy Apple", "Mil-Spec"),
("MP7 | Anodized Navy", "Mil-Spec"),
("Sawed-Off | Full Stop", "Mil-Spec"),
("XM1014 | CaliCamo", "Industrial Grade"),
("M4A1-S | Boreal Forest", "Industrial Grade"),
("UMP-45 | Gunsmoke", "Industrial Grade"),
("Nova | Candy Apple", "Industrial Grade"),
("Dual Berettas | Stained", "Industrial Grade"),
("P2000 | Granite Marbleized", "Industrial Grade"),
("AUG | Contractor", "Consumer Grade"),
("Tec-9 | Groundwater", "Consumer Grade"),
("Nova | Sand Dune", "Consumer Grade"),
("PP-Bizon | Sand Dashed", "Consumer Grade"),
("FAMAS | Colony", "Consumer Grade")
    ]

    # The Lake Collection
    lake_skins = [
        ("Dual Berettas | Cobalt Quartz", "Restricted"),
("USP-S | Night Ops", "Mil-Spec"),
("SG 553 | Anodized Navy", "Mil-Spec"),
("P90 | Teardown", "Mil-Spec"),
("PP-Bizon | Night Ops", "Industrial Grade"),
("AWP | Safari Mesh", "Industrial Grade"),
("Desert Eagle | Mudder", "Industrial Grade"),
("XM1014 | Blue Steel", "Industrial Grade"),
("FAMAS | Cyanospatter", "Industrial Grade"),
("G3SG1 | Jungle Dashed", "Consumer Grade"),
("AUG | Storm", "Consumer Grade"),
("SG 553 | Waves Perforated", "Consumer Grade"),
("XM1014 | Blue Spruce", "Consumer Grade"),
("Galil AR | Sage Spray", "Consumer Grade"),
("P250 | Boreal Forest", "Consumer Grade")
    ]

    # The Militia Collection
    militia_skins = [
        ("SCAR-20 | Splash Jam", "Classified"),
        ("M4A4 | Modern Hunter", "Restricted"),
        ("P250 | Modern Hunter", "Mil-Spec"),
        ("Nova | Blaze Orange", "Mil-Spec"),
        ("XM1014 | Blaze Orange", "Mil-Spec"),
        ("PP-Bizon | Modern Hunter", "Mil-Spec"),
        ("Nova | Modern Hunter", "Mil-Spec"),
        ("P2000 | Grassland Leaves", "Industrial Grade"),
        ("MAC-10 | Tornado", "Consumer Grade"),
        ("XM1014 | Grassland", "Consumer Grade"),
        ("PP-Bizon | Forest Leaves", "Consumer Grade")
    ]

    # The Mirage Collection
    mirage_skins = [
        ("MAG-7 | Bulldozer", "Restricted"),
        ("MP9 | Hot Rod", "Mil-Spec"),
        ("UMP-45 | Blaze", "Mil-Spec"),
        ("MAC-10 | Amber Fade", "Mil-Spec"),
        ("Glock-18 | Groundwater", "Industrial Grade"),
        ("SSG 08 | Tropical Storm", "Industrial Grade"),
        ("MP7 | Orange Peel", "Industrial Grade"),
        ("SG 553 | Gator Mesh", "Industrial Grade"),
        ("Negev | CaliCamo", "Industrial Grade"),
        ("Five-SeveN | Contractor", "Consumer Grade"),
        ("P90 | Scorched", "Consumer Grade"),
        ("AUG | Colony", "Consumer Grade"),
        ("G3SG1 | Safari Mesh", "Consumer Grade"),
        ("P250 | Bone Mask", "Consumer Grade"),
        ("Galil AR | Hunting Blind", "Consumer Grade")
    ]

    # The Norse Collection
    norse_skins = [
        ("AWP | Gungnir", "Covert"),
        ("Negev | Mjölnir", "Classified"),
        ("AUG | Flame Jörmungandr", "Restricted"),
        ("P90 | Astral Jörmungandr", "Restricted"),
        ("Desert Eagle | Emerald Jörmungandr", "Restricted"),
        ("MAC-10 | Copper Borre", "Mil-Spec"),
        ("SCAR-20 | Brass", "Mil-Spec"),
        ("XM1014 | Frost Borre", "Mil-Spec"),
        ("CZ75-Auto | Emerald Quartz", "Mil-Spec"),
        ("M4A1-S | Moss Quartz", "Industrial Grade"),
        ("Dual Berettas | Pyre", "Industrial Grade"),
        ("USP-S | Pathfinder", "Industrial Grade"),
        ("MAG-7 | Chainmail", "Industrial Grade"),
        ("SSG 08 | Red Stone", "Consumer Grade"),
        ("Galil AR | Tornado", "Consumer Grade"),
        ("MP7 | Scorched", "Consumer Grade"),
        ("FAMAS | Night Borre", "Consumer Grade"),
        ("SG 553 | Barricade", "Consumer Grade")
    ]

    # The Nuke Collection
    nuke_skins = [
        ("Tec-9 | Nuclear Threat", "Restricted"),
        ("P250 | Nuclear Threat", "Restricted"),
        ("M4A4 | Radiation Hazard", "Mil-Spec"),
        ("XM1014 | Fallout Warning", "Industrial Grade"),
        ("P90 | Fallout Warning", "Industrial Grade"),
        ("UMP-45 | Fallout Warning", "Industrial Grade"),
        ("Sawed-Off | Irradiated Alert", "Consumer Grade"),
        ("PP-Bizon | Irradiated Alert", "Consumer Grade"),
        ("MAG-7 | Irradiated Alert", "Consumer Grade")
    ]

    # The Office Collection
    office_skins = [
        ("MP7 | Whiteout", "Mil-Spec"),
        ("P2000 | Silver", "Mil-Spec"),
        ("G3SG1 | Arctic Camo", "Industrial Grade"),
        ("Galil AR | Winter Forest", "Industrial Grade"),
        ("M249 | Blizzard Marbleized", "Industrial Grade"),
        ("FAMAS | Contrast Spray", "Consumer Grade")
    ]

    # The Overpass Collection
    overpass_skins = [
        ("M4A1-S | Master Piece", "Classified"),
        ("AWP | Pink DDPAT", "Restricted"),
        ("USP-S | Road Rash", "Restricted"),
        ("CZ75-Auto | Nitro", "Mil-Spec"),
        ("SSG 08 | Detour", "Mil-Spec"),
        ("XM1014 | VariCamo Blue", "Mil-Spec"),
        ("Glock-18 | Night", "Industrial Grade"),
        ("Desert Eagle | Urban DDPAT", "Industrial Grade"),
        ("P2000 | Grassland", "Industrial Grade"),
        ("MP7 | Gunsmoke", "Industrial Grade"),
        ("MP9 | Storm", "Consumer Grade"),
        ("MAG-7 | Storm", "Consumer Grade"),
        ("Sawed-Off | Sage Spray", "Consumer Grade"),
        ("M249 | Contrast Spray", "Consumer Grade"),
        ("UMP-45 | Scorched", "Consumer Grade")
    ]

    # The Rising Sun Collection
    rising_sun_skins = [
        ("AUG | Akihabara Accept", "Covert"),
        ("AK-47 | Hydroponic", "Classified"),
        ("Desert Eagle | Sunset Storm 壱", "Restricted"),
        ("M4A4 | Daybreak", "Restricted"),
        ("Five-SeveN | Neon Kimono", "Restricted"),
        ("Desert Eagle | Sunset Storm 弐", "Restricted"),
        ("Tec-9 | Terrace", "Mil-Spec"),
        ("Galil AR | Aqua Terrace", "Mil-Spec"),
        ("MAG-7 | Counter Terrace", "Mil-Spec"),
        ("Desert Eagle | Midnight Storm", "Industrial Grade"),
        ("P250 | Crimson Kimono", "Industrial Grade"),
        ("Tec-9 | Bamboo Forest", "Consumer Grade"),
        ("PP-Bizon | Bamboo Print", "Consumer Grade"),
        ("P250 | Mint Kimono", "Consumer Grade"),
        ("G3SG1 | Orange Kimono", "Consumer Grade"),
        ("Sawed-Off | Bamboo Shadow", "Consumer Grade")
    ]

    # The Safehouse Collection
    safehouse_skins = [
        ("M4A1-S | Nitro", "Restricted"),
        ("SSG 08 | Acid Fade", "Mil-Spec"),
        ("FAMAS | Teardown", "Mil-Spec"),
        ("Five-SeveN | Silver Quartz", "Mil-Spec"),
        ("G3SG1 | VariCamo", "Industrial Grade"),
        ("M249 | Gator Mesh", "Industrial Grade"),
        ("Galil AR | VariCamo", "Industrial Grade"),
        ("AUG | Condemned", "Industrial Grade"),
        ("USP-S | Forest Leaves", "Industrial Grade"),
        ("MP9 | Orange Peel", "Industrial Grade"),
        ("Tec-9 | Army Mesh", "Consumer Grade"),
        ("SSG 08 | Blue Spruce", "Consumer Grade"),
        ("MP7 | Army Recon", "Consumer Grade"),
        ("Dual Berettas | Contractor", "Consumer Grade"),
        ("SCAR-20 | Contractor", "Consumer Grade")
    ]

    # The St. Marc Collection
    st_marc_skins = [
        ("AK-47 | Wild Lotus", "Covert"),
        ("MP9 | Wild Lily", "Classified"),
        ("AUG | Midnight Lily", "Restricted"),
        ("Glock-18 | Synth Leaf", "Restricted"),
        ("SSG 08 | Sea Calico", "Restricted"),
        ("Five-SeveN | Crimson Blossom", "Mil-Spec"),
        ("UMP-45 | Day Lily", "Mil-Spec"),
        ("MP7 | Teal Blossom", "Mil-Spec"),
        ("FAMAS | Sundown", "Mil-Spec"),
        ("M4A4 | Dark Blossom", "Industrial Grade"),
        ("P90 | Sunset Lily", "Industrial Grade"),
        ("XM1014 | Banana Leaf", "Industrial Grade"),
        ("Tec-9 | Rust Leaf", "Industrial Grade"),
        ("M249 | Jungle", "Consumer Grade"),
        ("MP5-SD | Bamboo Garden", "Consumer Grade"),
        ("Sawed-Off | Jungle Thicket", "Consumer Grade"),
        ("PP-Bizon | Seabird", "Consumer Grade"),
        ("MAC-10 | Surfwood", "Consumer Grade")
    ]

    # The Train Collection
    train_skins = [
        ("Tec-9 | Red Quartz", "Restricted"),
        ("Desert Eagle | Urban Rubble", "Mil-Spec"),
        ("Sawed-Off | Amber Fade", "Mil-Spec"),
        ("M4A4 | Urban DDPAT", "Industrial Grade"),
        ("P250 | Metallic DDPAT", "Industrial Grade"),
        ("MAC-10 | Candy Apple", "Industrial Grade"),
        ("MAG-7 | Metallic DDPAT", "Industrial Grade"),
        ("P90 | Ash Wood", "Industrial Grade"),
        ("SCAR-20 | Carbon Fiber", "Industrial Grade"),
        ("Nova | Polar Mesh", "Consumer Grade"),
        ("G3SG1 | Polar Camo", "Consumer Grade"),
        ("Five-SeveN | Forest Night", "Consumer Grade"),
        ("UMP-45 | Urban DDPAT", "Consumer Grade"),
        ("Dual Berettas | Colony", "Consumer Grade"),
        ("PP-Bizon | Urban Dashed", "Consumer Grade")
    ]

    # The Vertigo Collection
    vertigo_skins = [
        ("Dual Berettas | Demolition", "Restricted"),
    ("AK-47 | Black Laminate", "Mil-Spec"),
    ("P90 | Glacier Mesh", "Mil-Spec"),
    ("PP-Bizon | Carbon Fiber", "Industrial Grade"),
    ("MAC-10 | Urban DDPAT", "Consumer Grade"),
    ("XM1014 | Urban Perforated", "Consumer Grade")
    ]

    # The Huntsman Collection
    huntsman_skins = [
        ("M4A4 | Howl", "Contraband"),
        ("USP-S | Orion", "Classified"),
        ("MAC-10 | Curse", "Restricted"),
        ("CZ75-Auto | Poison Dart", "Mil-Spec"),
        ("Dual Berettas | Retribution", "Mil-Spec"),
        ("P90 | Desert Warfare", "Mil-Spec"),
    ]


    # ---------------------------------------------------------
    # MAPPING
    # ---------------------------------------------------------
    collections_map = {
        "The Train 2025 Collection": train_2025_skins,
        "The Overpass 2024 Collection": overpass_2024_skins,
        "The Sport & Field Collection": sport_field_skins,
        "The Graphic Design Collection": graphic_design_skins,
        "The Ascent Collection": ascent_skins,
        "The Boreal Collection": boreal_skins,
        "The Radiant Collection": radiant_skins,
        "The 2018 Inferno Collection": inferno_2018_skins,
        "The 2018 Nuke Collection": nuke_2018_skins,
        "The 2021 Dust 2 Collection": dust_2_2021_skins,
        "The 2021 Mirage Collection": mirage_2021_skins,
        "The 2021 Train Collection": train_2021_skins,
        "The 2021 Vertigo Collection": vertigo_2021_skins,
        "The Alpha Collection": alpha_skins,
        "The Ancient Collection": ancient_skins,
        "The Anubis Collection": anubis_skins,
        "The Assault Collection": assault_skins,
        "The Aztec Collection": aztec_skins,
        "The Baggage Collection": baggage_skins,
        "The Bank Collection": bank_skins,
        "The Blacksite Collection": blacksite_skins,
        "The Cache Collection": cache_skins,
        "The Canals Collection": canals_skins,
        "The Chop Shop Collection": chop_shop_skins,
        "The Cobblestone Collection": cobblestone_skins,
        "The Control Collection": control_skins,
        "The Dust 2 Collection": dust_2_skins,
        "The Dust Collection": dust_skins,
        "The Gods and Monsters Collection": gods_monsters_skins,
        "The Havoc Collection": havoc_skins,
        "The Inferno Collection": inferno_skins,
        "The Italy Collection": italy_skins,
        "The Lake Collection": lake_skins,
        "The Militia Collection": militia_skins,
        "The Mirage Collection": mirage_skins,
        "The Norse Collection": norse_skins,
        "The Nuke Collection": nuke_skins,
        "The Office Collection": office_skins,
        "The Overpass Collection": overpass_skins,
        "The Rising Sun Collection": rising_sun_skins,
        "The Safehouse Collection": safehouse_skins,
        "The St. Marc Collection": st_marc_skins,
        "The Train Collection": train_skins,
        "The Vertigo Collection": vertigo_skins,
        "The Huntsman Collection": huntsman_skins,
    }

    count = 0
    for col_name, skins in collections_map.items():
        if not skins:
            continue
            
        print(f"Processing {col_name} ({len(skins)} items)...")
        for name, rarity in skins:
            slug = slugify(name)
            
            # Fix for Sunset Storm collision
            if "Sunset Storm 壱" in name:
                slug = "desert-eagle-sunset-storm-1"
            elif "Sunset Storm 弐" in name:
                slug = "desert-eagle-sunset-storm-2"
            
            # Check if exists
            exists = db.query(Item).filter(Item.slug == slug, Item.item_type == 'skin').first()
            if exists:
                # Update collection if missing or different
                if exists.collection != col_name:
                    exists.collection = col_name
                    db.add(exists)
                    print(f"  Updated collection for {name}")
                continue
            
            item = Item(
                name=name,
                item_type='skin',
                rarity=rarity,
                collection=col_name,
                slug=slug,
                current_price=None
            )
            db.add(item)
            count += 1
            
    db.commit()
    print(f"Added {count} new collection skins.")
    db.close()

if __name__ == "__main__":
    seed_collection_items()
