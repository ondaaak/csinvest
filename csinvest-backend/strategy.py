# strategy.py - KOMPLETNÍ, OPRAVENÝ KÓD
from abc import ABC, abstractmethod
import requests
import os
from dotenv import load_dotenv
import json
import urllib.parse
import time

# Načtení konfigurace hned na začátku
load_dotenv() 

class IMarketStrategy(ABC):
    @abstractmethod
    def fetch_price(self, skin_name: str) -> dict:
        pass

class CSFloatStrategy(IMarketStrategy):
    BASE_URL = "https://csfloat.com/api/v1/listings"
    API_KEY = os.getenv("CSFLOAT_API_KEY") 

    def fetch_price(self, skin_name: str) -> dict:
        print(f"[CSFloatStrategy] Hledám cenu USD pro: {skin_name}")
        
        # Klíčová změna: Používáme širší limit (limit=50) a spoléháme na robustní headers.
        params = {
            "market_hash_name": skin_name,
            "sort_by": "lowest_price",
            "limit": 50,
            "type": "buy_now"
        }
        
        headers = {
            "Authorization": self.API_KEY, 
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }

        try:
            response = requests.get(self.BASE_URL, params=params, headers=headers, timeout=10)
            
            # --- DIAGNOSTIKA STAVU ---
            print(f"DEBUG: Status kód z CSFloat: {response.status_code}")
            
            if response.status_code != 200:
                print(f"⚠️ Chyba API: {response.status_code}. Raw Response: {response.text}")
                return None
            
            # --- Zpracování dat ---
            data = response.json()
            listings = data if isinstance(data, list) else data.get("data", [])
            
            # VYPÍŠEME, CO SE NAŠLO, ABYCHOM VIDĚLI, PROČ NENÍ CENA
            print(f"DEBUG: Nalezeno inzerátů: {len(listings)}") 
            
            if not listings:
                print(f"⚠️ CSFloat vrátilo 2ód0 OK, ale NENALEZENO ŽÁDNÝ LISTING pro {skin_name}.")
                return None

            cheapest = min(listings, key=lambda x: x.get("price"))
            
            # Návrat: Vracíme pouze USD centy
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