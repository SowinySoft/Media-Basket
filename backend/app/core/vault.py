import json
import os
import secrets
import hashlib
from datetime import datetime, timezone
from base64 import b64encode, b64decode
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.core.config import get_settings

settings = get_settings()

SECRETS_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "secrets.json")

_secrets_store: dict[str, dict] = {}


def _load_file():
    global _secrets_store
    if os.path.exists(SECRETS_FILE):
        with open(SECRETS_FILE, "r") as f:
            _secrets_store = json.load(f)


def _save_file():
    with open(SECRETS_FILE, "w") as f:
        json.dump(_secrets_store, f, indent=2)


_load_file()


def _get_kek() -> bytes:
    """Get the Key Encryption Key (KEK). In production, this comes from KMS/Vault Transit."""
    raw = settings.JWT_SECRET_KEY.encode()
    return hashlib.sha256(raw).digest()


def _generate_dek() -> bytes:
    """Generate a random 256-bit Data Encryption Key."""
    return secrets.token_bytes(32)


def _encrypt_dek(dek: bytes, kek: bytes) -> bytes:
    """Encrypt a DEK with the KEK using AES-256-GCM."""
    nonce = secrets.token_bytes(12)
    aesgcm = AESGCM(kek)
    ciphertext = aesgcm.encrypt(nonce, dek, None)
    return nonce + ciphertext


def _decrypt_dek(wrapped: bytes, kek: bytes) -> bytes:
    """Decrypt a DEK that was encrypted with the KEK."""
    nonce = wrapped[:12]
    ciphertext = wrapped[12:]
    aesgcm = AESGCM(kek)
    return aesgcm.decrypt(nonce, ciphertext, None)


def _encrypt_data(data: dict, dek: bytes) -> dict:
    """Encrypt a dict payload using AES-256-GCM with the given DEK."""
    plaintext = json.dumps(data).encode("utf-8")
    nonce = secrets.token_bytes(12)
    aesgcm = AESGCM(dek)
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)
    return {
        "ciphertext": b64encode(ciphertext).decode(),
        "nonce": b64encode(nonce).decode(),
        "algorithm": "AES-256-GCM",
    }


def _decrypt_data(encrypted: dict, dek: bytes) -> dict:
    """Decrypt an encrypted payload using the given DEK."""
    ciphertext = b64decode(encrypted["ciphertext"])
    nonce = b64decode(encrypted["nonce"])
    aesgcm = AESGCM(dek)
    plaintext = aesgcm.decrypt(nonce, ciphertext, None)
    return json.loads(plaintext.decode("utf-8"))


def get_vault_client():
    return None


def ensure_vault_mount(path: str = "media_basket") -> None:
    pass


def store_secret(org_id: str, service_id: str, data: dict, path: str | None = None) -> str:
    """Store a secret with envelope encryption. Returns vault_path."""
    vault_path = path or f"{settings.VAULT_MOUNT_PATH}/{org_id}/{service_id}"
    kek = _get_kek()
    dek = _generate_dek()
    wrapped_dek = _encrypt_dek(dek, kek)
    encrypted_data = _encrypt_data(data, dek)

    _secrets_store[vault_path] = {
        "encrypted_data": encrypted_data,
        "wrapped_dek": b64encode(wrapped_dek).decode(),
        "key_version": 1,
        "algorithm": "AES-256-GCM",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _save_file()
    return vault_path


def read_secret(org_id: str, service_id: str) -> dict | None:
    """Read and decrypt a secret."""
    vault_path = f"{settings.VAULT_MOUNT_PATH}/{org_id}/{service_id}"
    entry = _secrets_store.get(vault_path)
    if not entry:
        return None

    kek = _get_kek()
    wrapped_dek = b64decode(entry["wrapped_dek"])
    dek = _decrypt_dek(wrapped_dek, kek)
    return _decrypt_data(entry["encrypted_data"], dek)


def delete_secret(org_id: str, service_id: str) -> bool:
    """Delete a secret and its encryption keys."""
    vault_path = f"{settings.VAULT_MOUNT_PATH}/{org_id}/{service_id}"
    if vault_path in _secrets_store:
        del _secrets_store[vault_path]
        _save_file()
        return True
    return False


def rotate_secret(org_id: str, service_id: str, new_data: dict) -> str:
    """Re-encrypt a secret with a new DEK (key rotation)."""
    vault_path = f"{settings.VAULT_MOUNT_PATH}/{org_id}/{service_id}"
    entry = _secrets_store.get(vault_path)
    old_version = entry.get("key_version", 1) if entry else 0

    kek = _get_kek()
    new_dek = _generate_dek()
    wrapped_dek = _encrypt_dek(new_dek, kek)
    encrypted_data = _encrypt_data(new_data, new_dek)

    _secrets_store[vault_path] = {
        "encrypted_data": encrypted_data,
        "wrapped_dek": b64encode(wrapped_dek).decode(),
        "key_version": old_version + 1,
        "algorithm": "AES-256-GCM",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "rotated_from_version": old_version,
    }
    _save_file()
    return vault_path


def get_vault_entry_info(org_id: str, service_id: str) -> dict | None:
    """Get vault entry metadata without decrypting the data."""
    vault_path = f"{settings.VAULT_MOUNT_PATH}/{org_id}/{service_id}"
    entry = _secrets_store.get(vault_path)
    if not entry:
        return None
    return {
        "vault_path": vault_path,
        "key_version": entry.get("key_version", 1),
        "algorithm": entry.get("algorithm", "AES-256-GCM"),
        "created_at": entry.get("created_at"),
    }
