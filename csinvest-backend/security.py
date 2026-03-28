import re
import time
import threading
from urllib.parse import urlparse
from collections import defaultdict, deque

DISCORD_WEBHOOK_ALLOWED_HOSTS = {
    "discord.com",
    "ptb.discord.com",
    "canary.discord.com",
    "discordapp.com",
}

_DISCORD_WEBHOOK_PATH_RE = re.compile(r"^/api/webhooks/\d+/[A-Za-z0-9._-]+$")
_NOTIFICATION_TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


class FixedWindowRateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str, limit: int, window_seconds: int) -> bool:
        if limit <= 0:
            return False

        now = time.time()
        cutoff = now - float(window_seconds)
        with self._lock:
            bucket = self._hits[key]
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()

            if len(bucket) >= limit:
                return False

            bucket.append(now)
            return True

    def clear(self, key: str) -> None:
        with self._lock:
            if key in self._hits:
                del self._hits[key]


def get_client_ip(request) -> str:
    xff = (request.headers.get("x-forwarded-for") or "").strip()
    if xff:
        first = xff.split(",", 1)[0].strip()
        if first:
            return first

    real_ip = (request.headers.get("x-real-ip") or "").strip()
    if real_ip:
        return real_ip

    return request.client.host if request.client and request.client.host else "unknown"


def sanitize_text(value: str | None, max_length: int | None = None) -> str | None:
    if value is None:
        return None

    cleaned = str(value).strip()
    if max_length is not None:
        cleaned = cleaned[:max_length]
    return cleaned


def is_valid_notification_time(value: str | None) -> bool:
    if value is None:
        return True
    return bool(_NOTIFICATION_TIME_RE.match(value))


def is_valid_discord_webhook_url(url: str | None) -> bool:
    if not url:
        return False

    try:
        parsed = urlparse(url)
    except Exception:
        return False

    if parsed.scheme != "https":
        return False

    hostname = (parsed.hostname or "").lower()
    if hostname not in DISCORD_WEBHOOK_ALLOWED_HOSTS:
        return False

    if parsed.port is not None and parsed.port != 443:
        return False

    if parsed.params or parsed.fragment:
        return False

    if not _DISCORD_WEBHOOK_PATH_RE.match(parsed.path or ""):
        return False

    return True
