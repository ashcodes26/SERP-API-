"""Typed, server-only SerpApi transport and normalization."""
from urllib.parse import urlparse

import httpx
from pydantic import ValidationError

from app.config import Settings
from app.enums import ResourceProvenance
from app.schemas import ResourceLink, ResourceSearchIn, ResourceSearchOut

SERPAPI_URL = "https://serpapi.com/search.json"


class SearchFailure(Exception):
    def __init__(self, code: str, message: str, status: int = 502, retryable: bool = False):
        super().__init__(message)
        self.code, self.message, self.status, self.retryable = code, message, status, retryable


def _normalize(raw: object, limit: int, kind: str) -> list[ResourceLink]:
    if not isinstance(raw, list):
        raise SearchFailure("UPSTREAM_MALFORMED", "Search provider returned an invalid result list")
    results: list[ResourceLink] = []
    seen: set[str] = set()
    for item in raw:
        if not isinstance(item, dict):
            continue
        title = item.get("title")
        if kind == "job_postings":
            # Jobs may provide a canonical Google share link or an application URL.
            url = item.get("share_link")
            if not url and isinstance(item.get("apply_options"), list):
                url = next((o.get("link") for o in item["apply_options"] if isinstance(o, dict) and o.get("link")), None)
            snippet = item.get("description")
        else:
            url = item.get("link")
            snippet = item.get("snippet")
        if not isinstance(title, str) or not title.strip() or not isinstance(url, str):
            continue
        parsed = urlparse(url)
        if parsed.scheme not in ("https", "http") or not parsed.netloc or parsed.username or parsed.password:
            continue
        if url in seen:
            continue
        try:
            result = ResourceLink(
                title=title.strip(), url=url,
                snippet=snippet[:500] if isinstance(snippet, str) else None,
                source_domain=parsed.hostname,
                provenance=ResourceProvenance.serpapi_live,
            )
        except ValidationError:
            continue
        results.append(result)
        seen.add(url)
        if len(results) == limit:
            break
    return results


async def search_resources(request: ResourceSearchIn, settings: Settings, transport: httpx.AsyncBaseTransport | None = None) -> ResourceSearchOut:
    if not settings.serpapi_configured:
        raise SearchFailure("SERPAPI_NOT_CONFIGURED", "Search is unavailable: server API key is not configured", 503)
    skill = request.skill.strip()
    if not skill:
        raise SearchFailure("INVALID_QUERY", "Search query cannot be blank", 422)
    kind = request.kind
    query = f"{skill} tutorial OR course" if kind == "learning_resource" else f"{skill} jobs"
    params = {
        "engine": "google" if kind == "learning_resource" else "google_jobs",
        "q": query,
        "api_key": settings.serpapi_api_key.get_secret_value(),
        "output": "json",
    }
    try:
        async with httpx.AsyncClient(timeout=settings.serpapi_timeout_seconds, transport=transport) as client:
            response = await client.get(SERPAPI_URL, params=params)
            if response.status_code == 429:
                raise SearchFailure("SERPAPI_RATE_LIMITED", "Search provider is rate limited; retry later", 503, True)
            if response.status_code in (401, 403):
                raise SearchFailure("SERPAPI_AUTH_FAILED", "Search provider rejected server credentials", 502)
            if response.status_code >= 500:
                raise SearchFailure("SERPAPI_UNAVAILABLE", "Search provider is temporarily unavailable", 503, True)
            if response.status_code >= 400:
                raise SearchFailure("SERPAPI_REQUEST_FAILED", "Search provider rejected the request", 502)
            try:
                payload = response.json()
            except ValueError:
                raise SearchFailure("UPSTREAM_MALFORMED", "Search provider returned invalid JSON") from None
    except httpx.TimeoutException:
        raise SearchFailure("SERPAPI_TIMEOUT", "Search provider timed out", 504, True) from None
    except httpx.RequestError:
        raise SearchFailure("SERPAPI_NETWORK_ERROR", "Search provider could not be reached", 503, True) from None
    if not isinstance(payload, dict):
        raise SearchFailure("UPSTREAM_MALFORMED", "Search provider returned an invalid payload")
    if payload.get("error"):
        # Never reflect arbitrary provider error text (which could contain credentials/URLs).
        raise SearchFailure("SERPAPI_UPSTREAM_ERROR", "Search provider reported an error", 502)
    key = "organic_results" if kind == "learning_resource" else "jobs_results"
    results = _normalize(payload.get(key, []), min(request.max_results, settings.serpapi_max_results), kind)
    return ResourceSearchOut(query=query, results=results, provenance=ResourceProvenance.serpapi_live,
                             warnings=["No search results found"] if not results else [])
