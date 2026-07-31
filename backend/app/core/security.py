"""JWT security: token creation, verification, and session blacklisting."""
import json
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger("security")

settings = get_settings()

try:
    from bcrypt import hashpw, checkpw, gensalt
except ImportError:
    from bcrypt._bcrypt import hashpw, checkpw, gensalt

# In-memory blacklist (production: use Redis)
_token_blacklist: set[str] = set()

# Also try Redis if available
_redis_client = None
try:
    import redis.asyncio as aioredis
    if settings.REDIS_URL:
        _redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
except Exception:
    logger.warning("security_redis_init_failed")


def hash_password(password: str) -> str:
    return hashpw(password.encode("utf-8"), gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict | None:
    """Decode and validate a JWT token, checking the blacklist."""
    if is_token_blacklisted(token):
        return None
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


def blacklist_token(token: str) -> None:
    """Add a token to the blacklist (for logout/revocation)."""
    _token_blacklist.add(token)
    # Also store in Redis with TTL if available
    if _redis_client:
        try:
            # Decode to get expiry
            payload = jwt.get_unverified_claims(token)
            exp = payload.get("exp", 0)
            ttl = max(0, exp - int(datetime.now(timezone.utc).timestamp()))
            if ttl > 0:
                _redis_client.setex(f"blacklist:{token}", ttl, "1")
        except Exception:
            logger.warning("security_redis_blacklist_store_failed")


def is_token_blacklisted(token: str) -> bool:
    """Check if a token has been revoked."""
    if token in _token_blacklist:
        return True
    if _redis_client:
        try:
            return _redis_client.exists(f"blacklist:{token}") == 1
        except Exception:
            logger.warning("security_redis_blacklist_check_failed")
    return False
