import json
import os
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


def get_vault_client():
    return None


def ensure_vault_mount(path: str = "media_basket") -> None:
    pass


def store_secret(org_id: str, service_id: str, data: dict, path: str | None = None) -> str:
    vault_path = path or f"{settings.VAULT_MOUNT_PATH}/{org_id}/{service_id}"
    _secrets_store[vault_path] = data
    _save_file()
    return vault_path


def read_secret(org_id: str, service_id: str) -> dict | None:
    vault_path = f"{settings.VAULT_MOUNT_PATH}/{org_id}/{service_id}"
    return _secrets_store.get(vault_path)


def delete_secret(org_id: str, service_id: str) -> bool:
    vault_path = f"{settings.VAULT_MOUNT_PATH}/{org_id}/{service_id}"
    if vault_path in _secrets_store:
        del _secrets_store[vault_path]
        _save_file()
        return True
    return False
