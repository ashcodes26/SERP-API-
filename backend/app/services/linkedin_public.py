"""Public Google snippets via SerpApi; never fetch or scrape LinkedIn itself."""
from datetime import datetime, timezone
import re
import secrets
from urllib.parse import urlparse, unquote

from app.config import Settings
from app.schemas import LinkedInPublicSearchOut, LinkedInPublicSourceOut
from app.services.serpapi import request_search, SearchFailure
from app.services.resume_enhancer import claims
from app.validation import linkedin_url


def clean(value, limit):
    if not isinstance(value, str):
        return ''
    text = ' '.join(value.split())
    text = ''.join(c for c in text if ord(c) >= 32 and not 0xd800 <= ord(c) <= 0xdfff and ord(c) not in {0xfffe, 0xffff})
    return text[:limit]


def matching_source(value, slug):
    if not isinstance(value, str) or len(value) > 1000:
        return None
    try:
        link = urlparse(value)
        host = (link.hostname or '').lower()
        if link.scheme != 'https' or not (host in {'linkedin.com', 'www.linkedin.com'} or re.fullmatch(r'[a-z]{2,3}\.linkedin\.com', host)):
            return None
        if link.username or link.password or link.port not in {None, 443}:
            return None
        path = unquote(link.path).rstrip('/')
        match = re.fullmatch(r'/in/([A-Za-z0-9_.%-]{1,120})(/details/(?:skills|experience|education))?', path)
        if not match or match[1].casefold() != slug.casefold():
            return None
        return 'https://www.linkedin.com' + path + '/'
    except ValueError:
        return None


async def lookup(profile_url: str, settings: Settings, transport=None) -> LinkedInPublicSearchOut:
    canonical = linkedin_url(profile_url)
    if not canonical:
        raise SearchFailure('INVALID_PROFILE_URL', 'Enter a LinkedIn profile URL', 422)
    slug = urlparse(canonical).path.strip('/').split('/')[1]
    sources, seen = [], set()
    # Two bounded queries may expose different excerpts of the same exact profile.
    for suffix in ('', ' (skills OR experience OR education)'):
        payload = await request_search({'engine': 'google', 'q': f'site:linkedin.com/in/{slug}' + suffix,
                                        'hl': 'en', 'num': 10}, settings, transport, allow_empty_google=True)
        raw = payload.get('organic_results', [])
        if not isinstance(raw, list):
            raise SearchFailure('UPSTREAM_MALFORMED', 'Search provider returned an invalid profile result list')
        for item in raw[:20]:
            if not isinstance(item, dict):
                continue
            url = matching_source(item.get('link'), slug)
            title, snippet = clean(item.get('title'), 300), clean(item.get('snippet'), 1000)
            if not url or not title or not snippet or (url, snippet) in seen:
                continue
            sources.append(LinkedInPublicSourceOut(title=title, url=url, snippet=snippet))
            seen.add((url, snippet))
            if len(sources) >= 5:
                break
        if len(sources) >= 5:
            break
    retrieved = datetime.now(timezone.utc)
    excerpts = '\n\n'.join(f'{item.title}\n{item.snippet}\nSource: {item.url}' for item in sources)
    text = f'Public search snapshot\nProfile URL: {canonical}\nRetrieved: {retrieved.isoformat()}\n\n{excerpts}' if sources else ''
    skills = sorted(claims('\n'.join(f'{item.title}\n{item.snippet}' for item in sources), 'linkedin_public_search'))
    warnings = ['Public search snippets are partial and may be outdated. They do not verify skills or proficiency.',
                'Information not shown in this search is unavailable, not evidence that a skill or experience is absent.']
    if not sources:
        warnings.insert(0, 'No useful indexed information matched this exact LinkedIn profile URL. Existing saved profile text is preserved.')
    return LinkedInPublicSearchOut(id=secrets.token_urlsafe(24), profile_url=canonical,
        status='found' if sources else 'not_found', retrieved_at=retrieved, provenance='serpapi_live',
        sources=sources, detected_skills=skills, profile_text=text, warnings=warnings)
