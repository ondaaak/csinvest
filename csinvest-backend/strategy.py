from abc import ABC, abstractmethod
import requests
import os
from dotenv import load_dotenv
import json
import urllib.parse
import time
from config import Config

load_dotenv() 

class IMarketStrategy(ABC):
    @abstractmethod
    def fetch_price(self, skin_name: str, min_float: float = None, max_float: float = None) -> dict:
        pass

class CSFloatStrategy(IMarketStrategy):
    BASE_URL = "https://csfloat.com/api/v1/listings"
    
    # Doppler Phases -> Paint Index Mapping
    DOPPLER_PHASES = {
        "Phase 1": 418,
        "Phase 2": 419,
        "Phase 3": 420,
        "Phase 4": 421,
        "Ruby": 415,
        "Sapphire": 416,
        "Black Pearl": 417
    }

    # Gamma Doppler Phases -> Paint Index Mapping
    GAMMA_DOPPLER_PHASES = {
        "Phase 1": 569,
        "Phase 2": 570,
        "Phase 3": 571,
        "Phase 4": 572,
        "Emerald": 568
    }

    def __init__(self, config: Config | None = None) -> None:
        self.config = config or Config()


    def _extract_phase(self, skin_name: str):
        """
        Extracts phase from skin name (Phase 1-4, Ruby, Sapphire, etc.)
        Returns (base_name, phase_string)
        e.g. ("★ Karambit | Doppler (Factory New)", "Phase 2")
        """
        import re
        # Regex to catch "Phase X", "Sapphire", "Ruby", "Black Pearl", "Emerald"
        # Case insensitive
        pattern = r"(Phase\s\d+|Sapphire|Ruby|Black Pearl|Emerald)"
        match = re.search(pattern, skin_name, re.IGNORECASE)
        
        if match:
            phase_filter = match.group(0) # e.g. "Sapphire" or "Phase 1"
            # Remove phase from name to get base name for search
            # e.g. "★ Karambit | Doppler (Factory New) Sapphire" -> "★ Karambit | Doppler (Factory New)"
            base_name = skin_name.replace(phase_filter, "").strip()
            # Clean up double spaces or trailing/leading spaces
            base_name = " ".join(base_name.split())
            return base_name, phase_filter
            
        return skin_name, None

    def fetch_price(self, skin_name: str, min_float: float = None, max_float: float = None) -> dict:
        print(f"[CSFloatStrategy] Hledám cenu pro: {skin_name} (Float: {min_float}-{max_float})")
        
        base_name, phase_filter = self._extract_phase(skin_name)
        
        if phase_filter:
             print(f"[CSFloatStrategy] Detekována fáze: '{phase_filter}', hledám base_name: '{base_name}'")
             # Pokud hledáme specifickou fázi, zkusíme ji přidat do parametrů
             # CSFloat API někdy podporuje 'phase' jako parametr, pro gemy je to kritické
             # protože jinak jsou "utopeny" pod levnými fázemi 1-4.
             pass

        params = {
            "market_hash_name": base_name,
            "sort_by": "lowest_price",
            "limit": 50,
            "type": "buy_now"  # Explicitly only buy_now to avoid auctions
        }
        
        # Klíčová oprava: Pro vzácné fáze (Emerald, Ruby, Sapphire, Black Pearl)
        # musíme specifikovat 'phase' v requestu, jinak dostaneme jen levné Phase 1-4.
        if phase_filter:
            params["phase"] = phase_filter

        if min_float is not None:
            params["min_float"] = min_float
        if max_float is not None:
            params["max_float"] = max_float
        
        headers = {
            "Authorization": self.config.CSFLOAT_API_KEY,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }

        try:
            response = requests.get(self.BASE_URL, params=params, headers=headers, timeout=10)
            
            # print(f"DEBUG: Status kód z CSFloat: {response.status_code}")
            
            if response.status_code != 200:
                print(f"⚠️ Chyba API: {response.status_code}. Raw Response: {response.text}")
                return None
            
            data = response.json()
            listings = data if isinstance(data, list) else data.get("data", [])
            
            # print(f"DEBUG: Nalezeno inzerátů (před filtrem): {len(listings)}") 
            
            if not listings:
                print(f"⚠️ CSFloat vrátilo OK, ale NENALEZENO ŽÁDNÝ LISTING pro {base_name}.")
                return None

            # Filter by phase if specified
            if phase_filter:
                original_count = len(listings)
                # CSFloat item object has a 'phase' field? Or we check market_hash_name or other fields?
                # User script says: item.item.phase
                # Let's inspect CSFloat API response structure typically:
                # { "item": { "phase": "Phase 2", ... }, ... }
                # Note: CSFloat API structure for item:
                # "item": { "market_hash_name": "...", "phase": "Phase 2", ... }
                
                filtered_listings = []
                target_phase = phase_filter.lower()
                
                for listing in listings:
                    # Filter out auctions explicitly just in case API returns them
                    if listing.get("type") == "auction":
                        continue

                    item_data = listing.get("item", {})
                    item_phase = item_data.get("phase")
                    
                    # Some items might not have 'phase' field populated or it might be null
                    if item_phase and str(item_phase).lower() == target_phase:
                        filtered_listings.append(listing)
                
                listings = filtered_listings
                # print(f"DEBUG: Po filtrování fáze '{phase_filter}': {original_count} -> {len(listings)}")
            
            if not listings:
                print(f"⚠️ Žádný inzerát neodpovídá fázi {phase_filter}.")
                return None

            cheapest = min(listings, key=lambda x: x.get("price"))
            
            return {
                "success": True,
                "price_cents_usd": cheapest.get("price"),
                "item_name": cheapest.get("item", {}).get("market_hash_name"),
                "market_name": "CSFloat"
            }

        except json.JSONDecodeError:
            print(f"⚠️ API vrátilo neplatný JSON. Response Text: {response.text}")
            return None
        except Exception as e:
            print(f"⚠️ Kritická chyba spojení: {e}")
            return None