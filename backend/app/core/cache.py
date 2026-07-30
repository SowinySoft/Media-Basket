"""
Caching Layer for API Responses
In-memory and Redis caching for performance
"""
import json
import time
import hashlib
from typing import Any, Optional, Callable
from functools import wraps
from collections import OrderedDict


class LRUCache:
    """In-memory LRU cache with TTL support"""
    
    def __init__(self, max_size: int = 1000, default_ttl: int = 300):
        self._cache: OrderedDict[str, tuple[Any, float]] = OrderedDict()
        self._max_size = max_size
        self._default_ttl = default_ttl
        self._hits = 0
        self._misses = 0
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if key in self._cache:
            value, expiry = self._cache[key]
            if time.time() < expiry:
                # Move to end (most recently used)
                self._cache.move_to_end(key)
                self._hits += 1
                return value
            else:
                # Expired
                del self._cache[key]
        
        self._misses += 1
        return None
    
    def set(self, key: str, value: Any, ttl: int = None):
        """Set value in cache"""
        if ttl is None:
            ttl = self._default_ttl
        
        # Remove if exists
        if key in self._cache:
            del self._cache[key]
        
        # Add new entry
        self._cache[key] = (value, time.time() + ttl)
        
        # Evict oldest if over max size
        if len(self._cache) > self._max_size:
            self._cache.popitem(last=False)
    
    def delete(self, key: str):
        """Delete value from cache"""
        if key in self._cache:
            del self._cache[key]
    
    def clear(self):
        """Clear all cache entries"""
        self._cache.clear()
    
    def get_stats(self) -> dict:
        """Get cache statistics"""
        total = self._hits + self._misses
        return {
            "size": len(self._cache),
            "max_size": self._max_size,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": self._hits / total if total > 0 else 0,
        }


class CacheKey:
    """Generate cache keys from request parameters"""
    
    @staticmethod
    def generate(*args, **kwargs) -> str:
        """Generate a unique cache key"""
        key_data = json.dumps({"args": args, "kwargs": kwargs}, sort_keys=True, default=str)
        return hashlib.md5(key_data.encode()).hexdigest()
    
    @staticmethod
    def for_endpoint(endpoint: str, **params) -> str:
        """Generate cache key for an API endpoint"""
        key_data = json.dumps({"endpoint": endpoint, "params": params}, sort_keys=True)
        return hashlib.md5(key_data.encode()).hexdigest()


class CacheLayer:
    """Multi-level caching layer"""
    
    def __init__(self, lru_max_size: int = 1000, default_ttl: int = 300):
        self._lru = LRUCache(max_size=lru_max_size, default_ttl=default_ttl)
        self._redis = None  # Optional Redis connection
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache (LRU first, then Redis)"""
        # Check LRU cache
        value = self._lru.get(key)
        if value is not None:
            return value
        
        # Check Redis if available
        if self._redis:
            try:
                value = await self._redis.get(key)
                if value:
                    value = json.loads(value)
                    # Populate LRU cache
                    self._lru.set(key, value)
                    return value
            except Exception:
                pass
        
        return None
    
    async def set(self, key: str, value: Any, ttl: int = None):
        """Set value in cache"""
        # Set in LRU cache
        self._lru.set(key, value, ttl)
        
        # Set in Redis if available
        if self._redis:
            try:
                await self._redis.setex(
                    key,
                    ttl or self._lru._default_ttl,
                    json.dumps(value, default=str)
                )
            except Exception:
                pass
    
    async def delete(self, key: str):
        """Delete value from cache"""
        self._lru.delete(key)
        
        if self._redis:
            try:
                await self._redis.delete(key)
            except Exception:
                pass
    
    async def clear(self):
        """Clear all cache"""
        self._lru.clear()
        
        if self._redis:
            try:
                await self._redis.flushdb()
            except Exception:
                pass
    
    def get_stats(self) -> dict:
        """Get cache statistics"""
        return self._lru.get_stats()


def cached(ttl: int = 300, key_prefix: str = ""):
    """Decorator for caching function results"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = key_prefix + ":" + CacheKey.generate(*args, **kwargs)
            
            # Check cache
            result = await cache.get(cache_key)
            if result is not None:
                return result
            
            # Execute function
            result = await func(*args, **kwargs)
            
            # Store in cache
            await cache.set(cache_key, result, ttl)
            
            return result
        return wrapper
    return decorator


def invalidate_cache(pattern: str = None):
    """Decorator to invalidate cache after function execution"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            result = await func(*args, **kwargs)
            
            # Invalidate cache
            if pattern:
                # In production, use Redis SCAN to find and delete matching keys
                # For now, just clear all
                await cache.clear()
            
            return result
        return wrapper
    return decorator


# Global cache instance
cache = CacheLayer()
