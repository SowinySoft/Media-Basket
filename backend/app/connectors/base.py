from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class ConnectorManifest:
    name: str
    display_name: str
    version: str
    tier: str  # "full" | "lightweight"
    icon: str
    capabilities: dict = field(default_factory=dict)
    auth: dict = field(default_factory=dict)


class ConnectorPlugin(ABC):
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
