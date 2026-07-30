"""
API Tests for MediaBasket
Test all core functionality
"""
import pytest
from httpx import AsyncClient
from app.main import app


@pytest.fixture
async def client():
    """Create test client"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client


@pytest.fixture
def auth_headers():
    """Get auth headers for testing"""
    return {"Authorization": "Bearer test-token"}


class TestHealthEndpoints:
    """Test health check endpoints"""
    
    @pytest.mark.asyncio
    async def test_health(self, client):
        response = await client.get("/api/v1/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
    
    @pytest.mark.asyncio
    async def test_readiness(self, client):
        response = await client.get("/api/v1/health/ready")
        assert response.status_code == 200


class TestAuthEndpoints:
    """Test authentication endpoints"""
    
    @pytest.mark.asyncio
    async def test_signup(self, client):
        response = await client.post("/api/v1/auth/signup", json={
            "email": "test@example.com",
            "password": "testpassword123",
            "name": "Test User"
        })
        assert response.status_code in [200, 201, 400]  # 400 if already exists
    
    @pytest.mark.asyncio
    async def test_login(self, client):
        response = await client.post("/api/v1/auth/login", json={
            "email": "test@example.com",
            "password": "testpassword123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data


class TestSearchEndpoints:
    """Test search endpoints"""
    
    @pytest.mark.asyncio
    async def test_search(self, client, auth_headers):
        response = await client.get(
            "/api/v1/orgs/test-org-id/search",
            headers=auth_headers
        )
        assert response.status_code in [200, 401, 403]
    
    @pytest.mark.asyncio
    async def test_search_with_query(self, client, auth_headers):
        response = await client.get(
            "/api/v1/orgs/test-org-id/search?q=test",
            headers=auth_headers
        )
        assert response.status_code in [200, 401, 403]


class TestAnalyticsEndpoints:
    """Test analytics endpoints"""
    
    @pytest.mark.asyncio
    async def test_summary(self, client, auth_headers):
        response = await client.get(
            "/api/v1/orgs/test-org-id/analytics/summary",
            headers=auth_headers
        )
        assert response.status_code in [200, 401, 403]
    
    @pytest.mark.asyncio
    async def test_connector_analytics(self, client, auth_headers):
        response = await client.get(
            "/api/v1/orgs/test-org-id/analytics/connector/youtube",
            headers=auth_headers
        )
        assert response.status_code in [200, 401, 403]
    
    @pytest.mark.asyncio
    async def test_timeline(self, client, auth_headers):
        response = await client.get(
            "/api/v1/orgs/test-org-id/analytics/timeline",
            headers=auth_headers
        )
        assert response.status_code in [200, 401, 403]


class TestSchedulerEndpoints:
    """Test scheduler endpoints"""
    
    @pytest.mark.asyncio
    async def test_list_scheduled(self, client, auth_headers):
        response = await client.get(
            "/api/v1/orgs/test-org-id/scheduled",
            headers=auth_headers
        )
        assert response.status_code in [200, 401, 403]
    
    @pytest.mark.asyncio
    async def test_schedule_post(self, client, auth_headers):
        response = await client.post(
            "/api/v1/orgs/test-org-id/schedule",
            headers=auth_headers,
            json={
                "service_id": "test-service-id",
                "connector_type": "twitter",
                "content": "Test post",
                "scheduled_at": "2024-12-31T23:59:59Z"
            }
        )
        assert response.status_code in [200, 201, 400, 401, 403]


class TestRateLimiting:
    """Test rate limiting"""
    
    @pytest.mark.asyncio
    async def test_rate_limit_headers(self, client):
        response = await client.get("/api/v1/health")
        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers
        assert "X-RateLimit-Reset" in response.headers


class TestCache:
    """Test caching functionality"""
    
    def test_lru_cache(self):
        from app.core.cache import LRUCache
        
        cache = LRUCache(max_size=3, default_ttl=60)
        
        # Test basic set/get
        cache.set("key1", "value1")
        assert cache.get("key1") == "value1"
        
        # Test miss
        assert cache.get("nonexistent") is None
        
        # Test eviction
        cache.set("key2", "value2")
        cache.set("key3", "value3")
        cache.set("key4", "value4")  # Should evict key1
        assert cache.get("key1") is None
        assert cache.get("key2") == "value2"
        
        # Test stats
        stats = cache.get_stats()
        assert stats["size"] == 3
        assert stats["hits"] > 0
    
    def test_cache_key_generation(self):
        from app.core.cache import CacheKey
        
        key1 = CacheKey.generate("arg1", "arg2")
        key2 = CacheKey.generate("arg1", "arg2")
        key3 = CacheKey.generate("arg1", "arg3")
        
        assert key1 == key2  # Same args = same key
        assert key1 != key3  # Different args = different key


class TestRetryLogic:
    """Test retry functionality"""
    
    @pytest.mark.asyncio
    async def test_retry_success(self):
        from app.core.retry import retry_async, RetryConfig
        
        call_count = 0
        
        async def flaky_function():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise ValueError("Transient error")
            return "success"
        
        config = RetryConfig(max_retries=3, base_delay=0.01)
        result = await retry_async(flaky_function, config)
        
        assert result == "success"
        assert call_count == 3
    
    @pytest.mark.asyncio
    async def test_retry_exhaustion(self):
        from app.core.retry import retry_async, RetryConfig, RetryError
        
        async def always_fail():
            raise ValueError("Permanent error")
        
        config = RetryConfig(max_retries=2, base_delay=0.01)
        
        with pytest.raises(RetryError) as exc_info:
            await retry_async(always_fail, config)
        
        assert exc_info.value.attempts == 3  # 2 retries + 1 initial


class TestRateLimiter:
    """Test rate limiter"""
    
    def test_rate_limiter(self):
        from app.core.rate_limiter import RateLimiter
        
        limiter = RateLimiter()
        limiter.set_limit("/api/test", 3, 60)
        
        # First 3 requests should pass
        for i in range(3):
            is_limited, info = limiter.is_rate_limiter("client1", 3, 60)
            assert not is_limited
            assert info["remaining"] == 2 - i
        
        # 4th request should be limited
        is_limited, info = limiter.is_rate_limiter("client1", 3, 60)
        assert is_limited
