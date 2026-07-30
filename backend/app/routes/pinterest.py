from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.vault import read_secret
from app.routes.auth import get_current_user
from app.connectors.registry import get_connector

router = APIRouter()


@router.get("/{service_id}/pinterest/profile")
async def get_pinterest_profile(
    service_id: str,
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user["org_id"]
    connector = get_connector("pinterest")
    if not connector:
        raise HTTPException(status_code=404, detail="Pinterest connector not found")

    credentials = read_secret(org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    items = await connector.fetch({"access_token": credentials.get("access_token", ""), "type": "me"})
    return {"profile": items[0]["payload"] if items else None}


@router.get("/{service_id}/pinterest/boards")
async def get_pinterest_boards(
    service_id: str,
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user["org_id"]
    connector = get_connector("pinterest")
    if not connector:
        raise HTTPException(status_code=404, detail="Pinterest connector not found")

    credentials = read_secret(org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    items = await connector.fetch({"access_token": credentials.get("access_token", ""), "type": "boards"})
    boards = [{"id": i["external_id"], "payload": i["payload"]} for i in items]
    return {"boards": boards, "total": len(boards)}


@router.get("/{service_id}/pinterest/board/{board_id}/pins")
async def get_pinterest_pins(
    service_id: str,
    board_id: str,
    current_user: dict = Depends(get_current_user),
):
    org_id = current_user["org_id"]
    connector = get_connector("pinterest")
    if not connector:
        raise HTTPException(status_code=404, detail="Pinterest connector not found")

    credentials = read_secret(org_id, service_id)
    if not credentials:
        raise HTTPException(status_code=400, detail="No credentials")

    items = await connector.fetch({
        "access_token": credentials.get("access_token", ""),
        "type": "pins",
        "board_id": board_id,
    })
    pins = [{"id": i["external_id"], "payload": i["payload"]} for i in items]
    return {"pins": pins, "total": len(pins)}
