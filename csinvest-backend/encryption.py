import os
import binascii
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from config import Config

cfg = Config()

def _get_key():
    key_hex = cfg.CSFLOAT_ENCRYPTION_KEY
    if not key_hex:
        raise ValueError("CSFLOAT_ENCRYPTION_KEY is missing in .env")
    return binascii.unhexlify(key_hex)

def encrypt_api_key(api_key: str) -> dict:
    key = _get_key()
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
    key = _get_key()
    aesgcm = AESGCM(key)
    
    nonce = binascii.unhexlify(iv_hex)
    ciphertext = binascii.unhexlify(ciphertext_hex)
    tag = binascii.unhexlify(tag_hex)
    
    # Recombine for decryption
    data = ciphertext + tag
    
    plaintext = aesgcm.decrypt(nonce, data, None)
    return plaintext.decode('utf-8')
