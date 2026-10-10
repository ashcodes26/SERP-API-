"""Shared input validation without external retrieval."""
import re
from urllib.parse import urlparse, unquote


def linkedin_url(value: str | None) -> str | None:
    if not value or not value.strip():
        return None
    try:
        parsed = urlparse(value.strip())
        if parsed.scheme != 'https' or parsed.hostname not in {'linkedin.com', 'www.linkedin.com'} or parsed.username or parsed.password or parsed.port not in {None, 443}:
            raise ValueError()
        path = unquote(parsed.path)
        if not re.fullmatch(r'/in/[A-Za-z0-9_.%-]{1,120}/?', path):
            raise ValueError()
        return 'https://www.linkedin.com' + path.rstrip('/') + '/'
    except ValueError:
        raise ValueError('Use an HTTPS linkedin.com/in/profile URL') from None
