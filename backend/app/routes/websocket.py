"""WebSocket routes with full event types, Redis pub/sub fan-out, and heartbeat."""
import json
import asyncio
from typing import Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from app.core.security import decode_token
from app.core.logging import get_logger
from app.core.metrics import ws_connections_active

router = APIRouter()
logger = get_logger("websocket")

# In-memory registry (fallback when Redis is unavailable)
connected_clients: dict[str, Set[WebSocket]] = {}

# Optional Redis pub/sub for multi-instance fan-out
_redis = None
_redis_sub = None


async def _get_redis():
    global _redis
    if _redis is not None:
        return _redis
    try:
        import redis.asyncio as aioredis
        from app.core.config import get_settings
        settings = get_settings()
        if settings.REDIS_URL:
            _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
            return _redis
    except Exception:
        pass
    return None


async def _publish(org_id: str, message: dict):
    """Publish a message to Redis channel for fan-out across instances."""
    r = await _get_redis()
    if r:
        try:
            await r.publish(f"ws:{org_id}", json.dumps(message))
        except Exception:
            pass


async def _subscribe(org_id: str):
    """Subscribe to a Redis channel for incoming messages from other instances."""
    r = await _get_redis()
    if r:
        try:
            pubsub = r.pubsub()
            await pubsub.subscribe(f"ws:{org_id}")
            return pubsub
        except Exception:
            pass
    return None


async def broadcast_to_org(org_id: str, message: dict):
    """Broadcast a message to all connected clients in an org.

    Uses in-memory registry for local clients and Redis pub/sub for
    cross-instance fan-out.
    """
    # Publish to Redis for other instances
    await _publish(org_id, message)

    # Deliver to local in-memory clients
    if org_id in connected_clients:
        dead_clients = set()
        for client in connected_clients[org_id]:
            try:
                await client.send_json(message)
            except Exception:
                dead_clients.add(client)
        connected_clients[org_id] -= dead_clients
        if not connected_clients[org_id]:
            del connected_clients[org_id]
            ws_connections_active.labels(org_id=org_id).set(0)
    else:
        ws_connections_active.labels(org_id=org_id).set(0)


# ── Event notification helpers ──────────────────────────────────────

async def notify_sync_complete(org_id: str, service_id: str, items_fetched: int):
    await broadcast_to_org(org_id, {
        "type": "sync_complete",
        "service_id": service_id,
        "items_fetched": items_fetched,
    })

async def notify_content_new(org_id: str, content_id: str, connector_type: str, title: str = ""):
    await broadcast_to_org(org_id, {
        "type": "content.new",
        "content_id": content_id,
        "connector_type": connector_type,
        "title": title,
    })

async def notify_content_analyzed(org_id: str, content_id: str, analysis: dict):
    await broadcast_to_org(org_id, {
        "type": "content.analyzed",
        "content_id": content_id,
        "analysis": analysis,
    })

async def notify_content_flagged(org_id: str, content_id: str, reason: str):
    await broadcast_to_org(org_id, {
        "type": "content.flagged",
        "content_id": content_id,
        "reason": reason,
    })

async def notify_moderation_action(org_id: str, content_id: str, action: str):
    await broadcast_to_org(org_id, {
        "type": "moderation.action",
        "content_id": content_id,
        "action": action,
    })

async def notify_service_connected(org_id: str, service_id: str, connector_type: str):
    await broadcast_to_org(org_id, {
        "type": "service.connected",
        "service_id": service_id,
        "connector_type": connector_type,
    })

async def notify_service_disconnected(org_id: str, service_id: str, connector_type: str):
    await broadcast_to_org(org_id, {
        "type": "service.disconnected",
        "service_id": service_id,
        "connector_type": connector_type,
    })

async def notify_credential_expiring(org_id: str, service_id: str, days_remaining: int):
    await broadcast_to_org(org_id, {
        "type": "credential.expiring",
        "service_id": service_id,
        "days_remaining": days_remaining,
    })

async def notify_credential_expired(org_id: str, service_id: str):
    await broadcast_to_org(org_id, {
        "type": "credential.expired",
        "service_id": service_id,
    })

async def notify_alert_triggered(org_id: str, alert_id: str, alert_type: str, message: str):
    await broadcast_to_org(org_id, {
        "type": "alert.triggered",
        "alert_id": alert_id,
        "alert_type": alert_type,
        "message": message,
    })

async def notify_member_joined(org_id: str, user_id: str, role: str):
    await broadcast_to_org(org_id, {
        "type": "member.joined",
        "user_id": user_id,
        "role": role,
    })

async def notify_member_removed(org_id: str, user_id: str):
    await broadcast_to_org(org_id, {
        "type": "member.removed",
        "user_id": user_id,
    })

async def notify_plugin_activated(org_id: str, plugin_name: str):
    await broadcast_to_org(org_id, {
        "type": "plugin.activated",
        "plugin_name": plugin_name,
    })

async def notify_plugin_error(org_id: str, plugin_name: str, error: str):
    await broadcast_to_org(org_id, {
        "type": "plugin.error",
        "plugin_name": plugin_name,
        "error": error,
    })


# ── WebSocket endpoint ──────────────────────────────────────────────

@router.websocket("/ws/{org_id}")
async def websocket_endpoint(websocket: WebSocket, org_id: str):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    payload = decode_token(token)
    if not payload or payload.get("org_id") != org_id:
        await websocket.close(code=4003, reason="Invalid token")
        return

    await websocket.accept()

    if org_id not in connected_clients:
        connected_clients[org_id] = set()
    connected_clients[org_id].add(websocket)
    ws_connections_active.labels(org_id=org_id).set(len(connected_clients[org_id]))

    # Subscribe to Redis channel for cross-instance fan-out
    pubsub = await _subscribe(org_id)

    async def _redis_listener():
        if not pubsub:
            return
        try:
            async for msg in pubsub.listen():
                if msg["type"] == "message":
                    try:
                        data = json.loads(msg["data"])
                        await websocket.send_json(data)
                    except Exception:
                        break
        except Exception:
            pass

    redis_task = asyncio.create_task(_redis_listener()) if pubsub else None

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            # Echo back (client-to-client within same instance)
            await broadcast_to_org(org_id, message)
    except WebSocketDisconnect:
        pass
    finally:
        connected_clients[org_id].discard(websocket)
        count = len(connected_clients.get(org_id, set()))
        ws_connections_active.labels(org_id=org_id).set(count)
        if not count:
            connected_clients.pop(org_id, None)
        if redis_task:
            redis_task.cancel()
        if pubsub:
            try:
                await pubsub.unsubscribe()
            except Exception:
                pass
