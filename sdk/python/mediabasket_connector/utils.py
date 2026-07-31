"""Utility functions for connectors."""
import hashlib
import secrets
from datetime import datetime, timezone


def generate_content_hash(external_id: str, connector_type: str, org_id: str) -> str:
    """Deterministic content hash for deduplication."""
    payload = f"{external_id}:{connector_type}:{org_id}"
    return hashlib.sha256(payload.encode()).hexdigest()


def generate_state_token() -> str:
    """Generate a cryptographically secure state token for OAuth."""
    return secrets.token_urlsafe(32)


def parse_iso_datetime(dt_str: str) -> datetime:
    """Parse ISO 8601 datetime string."""
    from dateutil.parser import isoparse
    return isoparse(dt_str)
