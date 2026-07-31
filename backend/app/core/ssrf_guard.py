"""SSRF protection — validate outbound URLs against private IP ranges."""
import ipaddress
import socket
from urllib.parse import urlparse
import httpx

BLOCKED_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
]

BLOCKED_SCHEMES = {"file", "gopher", "dict", "ftp"}


def validate_url(url: str) -> bool:
    """Return True if URL is safe to fetch."""
    parsed = urlparse(url)
    if parsed.scheme.lower() in BLOCKED_SCHEMES:
        return False
    if parsed.scheme.lower() not in ("http", "https"):
        return False
    hostname = parsed.hostname
    if not hostname:
        return False
    try:
        ip = ipaddress.ip_address(hostname)
        for network in BLOCKED_NETWORKS:
            if ip in network:
                return False
    except ValueError:
        try:
            resolved = socket.getaddrinfo(hostname, None)
            for family, _, _, _, sockaddr in resolved:
                ip = ipaddress.ip_address(sockaddr[0])
                for network in BLOCKED_NETWORKS:
                    if ip in network:
                        return False
        except (socket.gaierror, OSError):
            return False
    return True


async def safe_post(url: str, **kwargs) -> httpx.Response:
    """POST to a URL with SSRF protection."""
    if not validate_url(url):
        raise ValueError(f"URL blocked by SSRF guard: {url}")
    async with httpx.AsyncClient(timeout=10) as client:
        return await client.post(url, **kwargs)
