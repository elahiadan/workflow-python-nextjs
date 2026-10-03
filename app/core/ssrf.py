"""SSRF protection for user-configured HTTP actions."""
import ipaddress
import socket
from urllib.parse import urlparse

from app.core.exceptions import BadRequestError

BLOCKED_HOSTNAMES = {"localhost", "metadata.google.internal"}
METADATA_IPS = {"169.254.169.254", "169.254.169.253", "fd00:ec2::254"}


def _is_private_ip(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return True  # fail closed
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
        or ip_str in METADATA_IPS
    )


def assert_safe_url(url: str) -> str:
    """Validate a user-supplied URL. Raises BadRequestError if unsafe.

    `mock://` URLs are allowed for tests/local dev and never hit the network.
    """
    if url.startswith("mock://"):
        return url
    try:
        parsed = urlparse(url)
    except Exception as e:
        raise BadRequestError(f"Invalid URL: {url}", "INVALID_URL") from e
    if parsed.scheme not in ("http", "https"):
        raise BadRequestError("Only http(s) URLs are allowed", "SSRF_BLOCKED")
    host = (parsed.hostname or "").lower()
    if not host or host in BLOCKED_HOSTNAMES:
        raise BadRequestError(f"Blocked host: {host or url}", "SSRF_BLOCKED")
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror as e:
        raise BadRequestError(f"Unable to resolve host: {host}", "INVALID_URL") from e
    for info in infos:
        if _is_private_ip(info[4][0]):
            raise BadRequestError(f"URL resolves to a private address: {host}", "SSRF_BLOCKED")
    return url
