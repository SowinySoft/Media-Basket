"""Encrypted credential vault with envelope encryption (AES-256-GCM).

Architecture:
- KEK (Key Encryption Key): derived from JWT_SECRET_KEY (production: KMS/Vault Transit)
- DEK (Data Encryption Key): random 256-bit key per credential
- Encrypt: generate DEK → encrypt DEK with KEK → encrypt data with DEK → store in DB
- Decrypt: unwrap DEK with KEK → decrypt data with DEK
- Audit: every operation logs to vault_audit_log table
"""
import json
import secrets
import hashlib
from base64 import b64encode, b64decode
from uuid import UUID
from datetime import datetime, timezone
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import get_settings
from app.core.logging import get_logger

settings = get_settings()
logger = get_logger("vault")


def _get_kek() -> bytes:
    raw = settings.JWT_SECRET_KEY.encode()
    return hashlib.sha256(raw).digest()


def _generate_dek() -> bytes:
    return secrets.token_bytes(32)


def _encrypt_dek(dek: bytes, kek: bytes) -> bytes:
    nonce = secrets.token_bytes(12)
    aesgcm = AESGCM(kek)
    ciphertext = aesgcm.encrypt(nonce, dek, None)
    return nonce + ciphertext


def _decrypt_dek(wrapped: bytes, kek: bytes) -> bytes:
    nonce = wrapped[:12]
    ciphertext = wrapped[12:]
    aesgcm = AESGCM(kek)
    return aesgcm.decrypt(nonce, ciphertext, None)


def _encrypt_payload(data: dict, dek: bytes) -> tuple[str, str]:
    plaintext = json.dumps(data).encode("utf-8")
    nonce = secrets.token_bytes(12)
    aesgcm = AESGCM(dek)
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)
    return b64encode(ciphertext).decode(), b64encode(nonce).decode()


def _decrypt_payload(ciphertext_b64: str, nonce_b64: str, dek: bytes) -> dict:
    ciphertext = b64decode(ciphertext_b64)
    nonce = b64decode(nonce_b64)
    aesgcm = AESGCM(dek)
    plaintext = aesgcm.decrypt(nonce, ciphertext, None)
    return json.loads(plaintext.decode("utf-8"))


async def _audit(db: AsyncSession, org_id: str, service_id: str, action: str, user_id: str | None = None):
    """Write a vault_audit_log entry."""
    from app.core.vault_audit import log_vault_access
    try:
        await log_vault_access(
            db=db,
            org_id=UUID(org_id),
            user_id=UUID(user_id) if user_id else None,
            service_id=UUID(service_id),
            action=action,
        )
    except Exception as exc:
        logger.warning("vault_audit_write_failed", error=str(exc))


async def store_secret(
    db: AsyncSession,
    org_id: str | UUID,
    service_instance_id: str | UUID,
    data: dict,
    user_id: str | UUID | None = None,
) -> str:
    from app.models.models import CredentialVault

    org_id = str(org_id)
    service_id = str(service_instance_id)
    kek = _get_kek()
    dek = _generate_dek()
    wrapped_dek = _encrypt_dek(dek, kek)
    ciphertext_b64, nonce_b64 = _encrypt_payload(data, dek)

    result = await db.execute(
        select(CredentialVault).where(
            CredentialVault.org_id == org_id,
            CredentialVault.service_instance_id == service_id,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        old_version = existing.key_version
        existing.encrypted_data = ciphertext_b64
        existing.nonce = nonce_b64
        existing.wrapped_dek = b64encode(wrapped_dek).decode()
        existing.key_version = old_version + 1
        existing.algorithm = "AES-256-GCM"
        existing.rotated_at = datetime.now(timezone.utc)
        await db.flush()
        await _audit(db, org_id, service_id, "rotate", user_id)
        logger.info("secret_rotated", org_id=org_id, service_id=service_id, new_version=old_version + 1)
        return str(existing.id)
    else:
        entry = CredentialVault(
            org_id=org_id,
            service_instance_id=service_id,
            encrypted_data=ciphertext_b64,
            nonce=nonce_b64,
            wrapped_dek=b64encode(wrapped_dek).decode(),
            key_version=1,
            algorithm="AES-256-GCM",
        )
        db.add(entry)
        await db.flush()
        await _audit(db, org_id, service_id, "write", user_id)
        logger.info("secret_stored", org_id=org_id, service_id=service_id)
        return str(entry.id)


async def read_secret(
    db: AsyncSession,
    org_id: str | UUID,
    service_instance_id: str | UUID,
    user_id: str | UUID | None = None,
) -> dict | None:
    from app.models.models import CredentialVault

    result = await db.execute(
        select(CredentialVault).where(
            CredentialVault.org_id == str(org_id),
            CredentialVault.service_instance_id == str(service_instance_id),
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        return None

    kek = _get_kek()
    wrapped_dek = b64decode(entry.wrapped_dek)
    dek = _decrypt_dek(wrapped_dek, kek)
    data = _decrypt_payload(entry.encrypted_data, entry.nonce, dek)

    await _audit(db, str(org_id), str(service_instance_id), "read", user_id)
    logger.info("secret_read", org_id=str(org_id), service_id=str(service_instance_id), key_version=entry.key_version)
    return data


async def delete_secret(
    db: AsyncSession,
    org_id: str | UUID,
    service_instance_id: str | UUID,
    user_id: str | UUID | None = None,
) -> bool:
    from app.models.models import CredentialVault

    result = await db.execute(
        select(CredentialVault).where(
            CredentialVault.org_id == str(org_id),
            CredentialVault.service_instance_id == str(service_instance_id),
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        return False

    await db.delete(entry)
    await _audit(db, str(org_id), str(service_instance_id), "revoke", user_id)
    logger.info("secret_deleted", org_id=str(org_id), service_id=str(service_instance_id))
    return True


async def rotate_secret(
    db: AsyncSession,
    org_id: str | UUID,
    service_instance_id: str | UUID,
    new_data: dict,
    user_id: str | UUID | None = None,
) -> str | None:
    from app.models.models import CredentialVault

    result = await db.execute(
        select(CredentialVault).where(
            CredentialVault.org_id == str(org_id),
            CredentialVault.service_instance_id == str(service_instance_id),
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        return None

    kek = _get_kek()
    new_dek = _generate_dek()
    wrapped_dek = _encrypt_dek(new_dek, kek)
    ciphertext_b64, nonce_b64 = _encrypt_payload(new_data, new_dek)

    old_version = entry.key_version
    entry.encrypted_data = ciphertext_b64
    entry.nonce = nonce_b64
    entry.wrapped_dek = b64encode(wrapped_dek).decode()
    entry.key_version = old_version + 1
    entry.rotated_at = datetime.now(timezone.utc)
    await db.flush()

    await _audit(db, str(org_id), str(service_instance_id), "rotate", user_id)
    logger.info("secret_rotated", org_id=str(org_id), service_id=str(service_instance_id), old_version=old_version, new_version=old_version + 1)
    return str(entry.id)


async def get_vault_entry_info(
    db: AsyncSession,
    org_id: str | UUID,
    service_instance_id: str | UUID,
) -> dict | None:
    from app.models.models import CredentialVault

    result = await db.execute(
        select(CredentialVault).where(
            CredentialVault.org_id == str(org_id),
            CredentialVault.service_instance_id == str(service_instance_id),
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        return None

    return {
        "id": str(entry.id),
        "org_id": str(entry.org_id),
        "service_instance_id": str(entry.service_instance_id),
        "key_version": entry.key_version,
        "algorithm": entry.algorithm,
        "rotated_at": entry.rotated_at.isoformat() if entry.rotated_at else None,
    }
