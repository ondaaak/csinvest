from datetime import datetime

class PriceFactory:
    @staticmethod
    def create_price(raw_data: dict, skin_id: int, market_id: int):
        if not raw_data:
            return None

        price = 0.0

        if "price_cents_usd" in raw_data:
            try:
                cents_usd = int(raw_data["price_cents_usd"])
                price_usd = float(cents_usd) / 100.0
                price = round(price_usd, 2)
            except (ValueError, TypeError):
                print("Chyba ve Factory: Nelze převést centy na cenu.")
                return None
        else:
            return None

        return {
            "market_id": market_id,
            "skin_id": skin_id,
            "price": price,
            "timestamp": datetime.now()
        }
