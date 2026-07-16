import hashlib

import bcrypt


def _prepare_password(password: str) -> bytes:
    """bcrypt hard-caps input at 72 bytes; pre-hash so any password length is accepted."""
    return hashlib.sha256(password.encode("utf-8")).hexdigest().encode("utf-8")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_prepare_password(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(_prepare_password(password), password_hash.encode("utf-8"))
