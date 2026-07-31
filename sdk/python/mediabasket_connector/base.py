"""Base class for MediaBasket connectors."""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ConnectorManifest:
    name: str
    display_name: str
    version: str
    tier: str = "lightweight"
    icon: str = ""
    description: str = ""
    capabilities: dict = field(default_factory=dict)
    auth: dict = field(default_factory=dict)


class BaseConnector(ABC):
    """Base class for all MediaBasket connectors.

    Subclass this and implement all abstract methods.
    """
    manifest: ConnectorManifest

    @abstractmethod
    async def initialize(self, config: dict) -> None: ...

    @abstractmethod
    async def shutdown(self) -> None: ...

    @abstractmethod
    def get_auth_url(self, state: str) -> str: ...

    @abstractmethod
    async def exchange_code(self, code: str) -> dict: ...

    @abstractmethod
    async def refresh_token(self, refresh_token: str) -> dict: ...

    @abstractmethod
    async def fetch(self, params: dict) -> list[dict]: ...

    @abstractmethod
    async def moderate(self, action: str, content_id: str) -> dict: ...

    @abstractmethod
    async def respond(self, content_id: str, message: str) -> None: ...

    @abstractmethod
    def verify_webhook(self, signature: str, body: bytes) -> bool: ...

    @abstractmethod
    def parse_webhook(self, body: bytes) -> dict: ...
