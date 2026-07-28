import hvac
from app.core.config import get_settings

settings = get_settings()

client = hvac.Client(url=settings.VAULT_URL, token=settings.VAULT_TOKEN)


def get_vault_client() -> hvac.Client:
    return client


def ensure_vault_mount(path: str = "media_basket") -> None:
    if not client.secrets.kv.v2.list_secrets(mount_point=path):
        try:
            client.sys.enable_secrets_engine(
                backend_type="kv",
                path=path,
                options={"version": "2"},
            )
        except Exception:
            pass


def store_secret(org_id: str, service_id: str, data: dict, path: str | None = None) -> str:
    vault_path = path or f"{settings.VAULT_MOUNT_PATH}/{org_id}/{service_id}"
    client.secrets.kv.v2.create_or_update_secret(
        mount_point=settings.VAULT_MOUNT_PATH,
        path=f"{org_id}/{service_id}",
        secret=data,
    )
    return vault_path


def read_secret(org_id: str, service_id: str) -> dict | None:
    try:
        result = client.secrets.kv.v2.read_secret(
            mount_point=settings.VAULT_MOUNT_PATH,
            path=f"{org_id}/{service_id}",
        )
        return result.get("data", {}).get("data", {})
    except Exception:
        return None


def delete_secret(org_id: str, service_id: str) -> bool:
    try:
        client.secrets.kv.v2.delete_secret(
            mount_point=settings.VAULT_MOUNT_PATH,
            path=f"{org_id}/{service_id}",
        )
        return True
    except Exception:
        return False
