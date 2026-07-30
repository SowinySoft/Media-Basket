import hashlib
import json
from app.connectors.youtube import YouTubeConnector
from app.connectors.reddit import RedditConnector
from app.connectors.whatsapp import WhatsAppConnector
from app.connectors.telegram import TelegramConnector
from app.connectors.instagram import InstagramConnector
from app.connectors.twitter import TwitterConnector
from app.connectors.facebook import FacebookConnector
from app.connectors.linkedin import LinkedInConnector
from app.connectors.tiktok import TikTokConnector
from app.connectors.discord import DiscordConnector
from app.connectors.slack import SlackConnector
from app.connectors.mastodon import MastodonConnector
from app.connectors.pinterest import PinterestConnector
from app.connectors.snapchat import SnapchatConnector
from app.connectors.bluesky import BlueskyConnector
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
    CONNECTOR_REGISTRY["facebook"] = FacebookConnector()
    CONNECTOR_REGISTRY["linkedin"] = LinkedInConnector()
    CONNECTOR_REGISTRY["tiktok"] = TikTokConnector()
    CONNECTOR_REGISTRY["discord"] = DiscordConnector()
    CONNECTOR_REGISTRY["slack"] = SlackConnector()
    CONNECTOR_REGISTRY["mastodon"] = MastodonConnector()
    CONNECTOR_REGISTRY["pinterest"] = PinterestConnector()
    CONNECTOR_REGISTRY["snapchat"] = SnapchatConnector()
    CONNECTOR_REGISTRY["bluesky"] = BlueskyConnector()


register_connectors()
