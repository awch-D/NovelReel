"""API 密钥对称加密，基于机器 MAC 地址派生密钥"""

import base64
import hashlib
import uuid

from cryptography.fernet import Fernet

_PREFIX = "enc:"
_SALT = b"novel2toon_settings_v1"


def _derive_key() -> bytes:
    """从机器 MAC 地址 + 固定盐派生 Fernet 密钥"""
    mac = str(uuid.getnode()).encode()
    dk = hashlib.pbkdf2_hmac("sha256", mac, _SALT, 100_000, dklen=32)
    return base64.urlsafe_b64encode(dk)


_fernet = Fernet(_derive_key())


def is_encrypted(value: str) -> bool:
    return value.startswith(_PREFIX)


def encrypt(plaintext: str) -> str:
    if not plaintext or is_encrypted(plaintext):
        return plaintext
    token = _fernet.encrypt(plaintext.encode("utf-8"))
    return _PREFIX + token.decode("ascii")


def decrypt(ciphertext: str) -> str:
    if not ciphertext or not is_encrypted(ciphertext):
        return ciphertext
    token = ciphertext[len(_PREFIX):]
    return _fernet.decrypt(token.encode("ascii")).decode("utf-8")
