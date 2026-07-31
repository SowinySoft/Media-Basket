"""
Pytest configuration and fixtures for MediaBasket backend tests.
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient
from unittest.mock import AsyncMock, MagicMock, patch
from app.main import app
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    """Synchronous test client (no real DB required for route-level tests)."""
    with TestClient(app) as c:
        yield c


@pytest.fixture
async def async_client():
    """Async test client for endpoint tests."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def mock_session():
    """Return a mock async database session."""
    session = AsyncMock()
    session.execute = AsyncMock()
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.scalars = MagicMock()
    return session


@pytest.fixture
def mock_request():
    """Return a mock FastAPI Request object."""
    req = MagicMock()
    req.state = MagicMock()
    req.state.user = MagicMock()
    req.state.org_id = "test-org-id"
    req.state.request_id = "test-request-id"
    return req


@pytest.fixture
def mock_current_user():
    """Return a mock CurrentUser."""
    from app.schemas.schemas import CurrentUser
    return CurrentUser(
        sub="test-user-id",
        org_id="test-org-id",
        member_id="test-member-id",
        role="member",
    )


@pytest.fixture
def auth_headers(mock_current_user):
    """Return auth headers for testing."""
    return {"Authorization": "Bearer test-token"}
