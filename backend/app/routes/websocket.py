import json
from typing import Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from app.routes.auth import decode_token

router = APIRouter()

connected_clients: dict[str, Set[WebSocket]] = {}


async def get_org_from_ws(websocket: WebSocket) -> str | None:
    token = websocket.query_params.get("token")
    if not token:
        return None
    payload = decode_token(token)
    if not payload:
        return None
    return payload.get("org_id")


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

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            await broadcast_to_org(org_id, message)
    except WebSocketDisconnect:
        connected_clients[org_id].discard(websocket)
        if not connected_clients[org_id]:
            del connected_clients[org_id]


async def broadcast_to_org(org_id: str, message: dict):
    if org_id in connected_clients:
        dead_clients = set()
        for client in connected_clients[org_id]:
            try:
                await client.send_json(message)
            except Exception:
                dead_clients.add(client)
        connected_clients[org_id] -= dead_clients


async def notify_sync_complete(org_id: str, service_id: str, items_fetched: int):
    await broadcast_to_org(org_id, {
        "type": "sync_complete",
        "service_id": service_id,
        "items_fetched": items_fetched,
    })


async def notify_content_analyzed(org_id: str, content_id: str, analysis: dict):
    await broadcast_to_org(org_id, {
        "type": "content_analyzed",
        "content_id": content_id,
        "analysis": analysis,
    })


async def notify_moderation_action(org_id: str, content_id: str, action: str):
    await broadcast_to_org(org_id, {
        "type": "moderation_action",
        "content_id": content_id,
        "action": action,
    })
