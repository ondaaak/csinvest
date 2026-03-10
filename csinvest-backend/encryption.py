import os
import binascii
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from config import Config

cfg = Config()

def _get_keys():
    key_hexes = [cfg.CSFLOAT_ENCRYPTION_KEY, *cfg.CSFLOAT_ENCRYPTION_LEGACY_KEYS]
    key_hexes = [key_hex for key_hex in key_hexes if key_hex]
    if not key_hexes:
        raise ValueError("CSFLOAT_ENCRYPTION_KEY is missing in .env")
    return [binascii.unhexlify(key_hex) for key_hex in key_hexes]

def encrypt_api_key(api_key: str) -> dict:
    key = _get_keys()[0]
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    
    # encrypt returns ciphertext + tag
    encrypted_data = aesgcm.encrypt(nonce, api_key.encode('utf-8'), None)
    
    # Split tag (last 16 bytes)
    tag = encrypted_data[-16:]
    ciphertext = encrypted_data[:-16]
    
    return {
        "ciphertext": binascii.hexlify(ciphertext).decode('utf-8'),
        "iv": binascii.hexlify(nonce).decode('utf-8'),
        "tag": binascii.hexlify(tag).decode('utf-8')
    }

def decrypt_api_key(ciphertext_hex: str, iv_hex: str, tag_hex: str) -> str:
    nonce = binascii.unhexlify(iv_hex)
    ciphertext = binascii.unhexlify(ciphertext_hex)
    tag = binascii.unhexlify(tag_hex)
    
    # Recombine for decryption
    data = ciphertext + tag

    last_error = None
    for key in _get_keys():
        aesgcm = AESGCM(key)
        try:
            plaintext = aesgcm.decrypt(nonce, data, None)
            return plaintext.decode('utf-8')
        except Exception as exc:
            last_error = exc

    raise last_error or ValueError("Unable to decrypt API key")
