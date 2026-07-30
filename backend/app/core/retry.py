"""
Retry Logic with Exponential Backoff
Handles transient failures in API calls
"""
import asyncio
import logging
from typing import Callable, Any, Optional
from functools import wraps

logger = logging.getLogger(__name__)


class RetryConfig:
    """Configuration for retry logic"""
    
    def __init__(
        self,
        max_retries: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 30.0,
        exponential_base: float = 2.0,
        retryable_exceptions: tuple = (Exception,),
        retryable_status_codes: tuple = (429, 500, 502, 503, 504),
    ):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.retryable_exceptions = retryable_exceptions
        self.retryable_status_codes = retryable_status_codes


class RetryError(Exception):
    """Raised when all retries are exhausted"""
    
    def __init__(self, last_exception: Exception, attempts: int):
        self.last_exception = last_exception
        self.attempts = attempts
        super().__init__(f"Failed after {attempts} attempts: {last_exception}")


async def retry_async(
    func: Callable,
    config: RetryConfig = None,
    *args,
    **kwargs
) -> Any:
    """Execute async function with retry logic"""
    if config is None:
        config = RetryConfig()
    
    last_exception = None
    
    for attempt in range(config.max_retries + 1):
        try:
            result = await func(*args, **kwargs)
            return result
            
        except config.retryable_exceptions as e:
            last_exception = e
            
            if attempt == config.max_retries:
                break
            
            # Check if it's a rate limit error
            if hasattr(e, 'status_code') and e.status_code == 429:
                # Use Retry-After header if available
                retry_after = getattr(e, 'retry_after', None)
                if retry_after:
                    delay = float(retry_after)
                else:
                    delay = min(
                        config.base_delay * (config.exponential_base ** attempt),
                        config.max_delay
                    )
            else:
                delay = min(
                    config.base_delay * (config.exponential_base ** attempt),
                    config.max_delay
                )
            
            logger.warning(f"Retry attempt {attempt + 1}/{config.max_retries} after {delay}s: {e}")
            await asyncio.sleep(delay)
    
    raise RetryError(last_exception, config.max_retries + 1)


def with_retry(config: RetryConfig = None):
    """Decorator for retry logic"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            return await retry_async(func, config, *args, **kwargs)
        return wrapper
    return decorator


class HTTPRetryClient:
    """HTTP client with built-in retry logic"""
    
    def __init__(self, config: RetryConfig = None):
        self.config = config or RetryConfig()
        self._client = None
    
    async def _get_client(self):
        """Get or create HTTP client"""
        if self._client is None:
            import httpx
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client
    
    async def request(self, method: str, url: str, **kwargs) -> dict:
        """Make HTTP request with retry"""
        async def _make_request():
            client = await self._get_client()
            response = await client.request(method, url, **kwargs)
            
            if response.status_code in self.config.retryable_status_codes:
                from httpx import HTTPStatusError
                raise HTTPStatusError(
                    f"Retryable status: {response.status_code}",
                    request=response.request,
                    response=response,
                )
            
            return response.json()
        
        return await retry_async(_make_request, self.config)
    
    async def get(self, url: str, **kwargs) -> dict:
        return await self.request("GET", url, **kwargs)
    
    async def post(self, url: str, **kwargs) -> dict:
        return await self.request("POST", url, **kwargs)
    
    async def put(self, url: str, **kwargs) -> dict:
        return await self.request("PUT", url, **kwargs)
    
    async def delete(self, url: str, **kwargs) -> dict:
        return await self.request("DELETE", url, **kwargs)
    
    async def close(self):
        """Close HTTP client"""
        if self._client:
            await self._client.aclose()
            self._client = None


# Global retry client instance
retry_client = HTTPRetryClient()
