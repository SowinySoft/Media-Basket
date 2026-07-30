import hashlib
import json
from app.connectors.youtube import YouTubeConnector
from app.connectors.reddit import RedditConnector
from app.connectors.whatsapp import WhatsAppConnector
from app.connectors.telegram import TelegramConnector
from app.connectors.instagram import InstagramConnector
from app.connectors.twitter import TwitterConnector
from app.connectors.base import ConnectorPlugin

CONNECTOR_REGISTRY: dict[str, ConnectorPlugin] = {}


def get_connector(connector_type: str) -> ConnectorPlugin | None:
    return CONNECTOR_REGISTRY.get(connector_type)


def register_connectors():
    CONNECTOR_REGISTRY["youtube"] = YouTubeConnector()
    CONNECTOR_REGISTRY["reddit"] = RedditConnector()
    CONNECTOR_REGISTRY["whatsapp"] = WhatsAppConnector()
    CONNECTOR_REGISTRY["telegram"] = TelegramConnector()
    CONNECTOR_REGISTRY["instagram"] = InstagramConnector()
    CONNECTOR_REGISTRY["twitter"] = TwitterConnector()


register_connectors()
