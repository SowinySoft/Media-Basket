# MediaBasket Connector SDK

Build custom connectors for MediaBasket.

## Quick Start

```python
from mediabasket_connector import BaseConnector, ConnectorManifest, OAuth2Helper

class MyConnector(BaseConnector):
    manifest = ConnectorManifest(
        name="my-service",
        display_name="My Service",
        version="1.0.0",
        tier="lightweight",
    )

    def __init__(self):
        self.oauth = OAuth2Helper(
            client_id="...",
            client_secret="...",
            redirect_uri="http://localhost:8000/api/v1/services/callback/my-service",
            auth_url="https://my-service.com/oauth/authorize",
            token_url="https://my-service.com/oauth/token",
        )

    async def initialize(self, config): pass
    async def shutdown(self): pass
    def get_auth_url(self, state): return self.oauth.get_auth_url(["read", "write"], state)
    async def exchange_code(self, code): return await self.oauth.exchange_code(code)
    async def refresh_token(self, rt): return await self.oauth.refresh_token(rt)
    async def fetch(self, params): return []
    async def moderate(self, action, cid): return {"status": "ok"}
    async def respond(self, cid, msg): pass
    def verify_webhook(self, sig, body): return True
    def parse_webhook(self, body): return {}
```

## Install

```bash
pip install mediabasket-connector
```
