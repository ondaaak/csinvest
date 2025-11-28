import time
import webbrowser
from urllib.parse import quote

LISTING_BASE = "https://steamcommunity.com/market/listings/730/"

TEST_NAMES = [
"★ Sport Gloves | Vice (Factory New)",
"★ Driver Gloves | Imperial Plaid (Factory New)",
"★ Moto Gloves | Polygon (Factory New)",
"★ Sport Gloves | Omega (Factory New)",
"★ Hand Wraps | Overprint (Factory New)",
"★ Driver Gloves | Racing Green (Factory New)",
"★ Sport Gloves | Bronze Morph (Factory New)",
"★ Hand Wraps | Cobalt Skulls (Factory New)",
"★ Hydra Gloves | Emerald (Factory New)",
"★ Hydra Gloves | Mangrove (Factory New)",
"★ Moto Gloves | Transport (Factory New)",
"★ Hydra Gloves | Case Hardened (Factory New)",
"★ Driver Gloves | Overtake (Factory New)",
"★ Sport Gloves | Amphibious (Factory New)",
"★ Moto Gloves | Turtle (Factory New)",
"★ Specialist Gloves | Mogul (Factory New)",
"★ Hand Wraps | Duct Tape (Factory New)",
"★ Driver Gloves | King Snake (Factory New)",
"★ Hydra Gloves | Rattler (Factory New)",
"★ Specialist Gloves | Buckshot (Factory New)",
"★ Specialist Gloves | Fade (Factory New)",
"★ Specialist Gloves | Crimson Web (Factory New)",
"★ Hand Wraps | Arboreal (Factory New)",
"★ Moto Gloves | POW! (Factory New)",


]


def name_to_url(name: str) -> str:
    # Use percent-encoding for spaces (%20), not '+'
    return LISTING_BASE + quote(name, safe="")


def open_pages(names: list[str], delay_sec: float = 1.0):
    print("Opening Market pages in your default browser...")
    for name in names:
        url = name_to_url(name)
        print(f"-> {url}")
        webbrowser.open_new_tab(url)
        time.sleep(delay_sec)
    print("Done. You can right-click and save images manually.")


if __name__ == "__main__":
    open_pages(TEST_NAMES, delay_sec=0.7)
