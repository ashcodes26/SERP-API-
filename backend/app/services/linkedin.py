"""Official LinkedIn OIDC member consent and bounded, server-only token exchange."""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode, parse_qs

import httpx
from fastapi import HTTPException
from sqlalchemy import delete, select, update

from app import models
from app.config import get_settings


def now():
    return datetime.now(timezone.utc)


def fail(status, code, message):
    raise HTTPException(status, detail={'code': code, 'message': message, 'retryable': False})


def purge(db):
    # Authorization attempts expire; successful member receipts remain visible until cleared.
    db.execute(delete(models.LinkedInAuthorization).where(models.LinkedInAuthorization.expires_at <= now(),
                                                         models.LinkedInAuthorization.status != 'connected'))


def latest_connection(db, student):
    purge(db); db.commit()
    return db.scalar(select(models.LinkedInAuthorization).where(
        models.LinkedInAuthorization.student_pk == student.id)
        .order_by(models.LinkedInAuthorization.expires_at.desc()).limit(1))


def start(db, student):
    cfg = get_settings()
    if not cfg.linkedin_configured:
        fail(503, 'LINKEDIN_NOT_CONFIGURED', 'Set LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET and an exact HTTPS LINKEDIN_REDIRECT_URI in backend/.env, then restart the backend.')
    purge(db)
    # One active attempt per student; reconnecting invalidates older callback states.
    db.execute(delete(models.LinkedInAuthorization).where(models.LinkedInAuthorization.student_pk == student.id))
    state = secrets.token_urlsafe(32)
    item = models.LinkedInAuthorization(id=secrets.token_urlsafe(24), student_pk=student.id,
        state_hash=hashlib.sha256(state.encode()).hexdigest(), expires_at=now() + timedelta(minutes=10), status='pending')
    db.add(item); db.commit()
    url = 'https://www.linkedin.com/oauth/v2/authorization?' + urlencode({
        'response_type': 'code', 'client_id': cfg.linkedin_client_id, 'redirect_uri': cfg.linkedin_redirect_uri,
        'state': state, 'scope': 'openid profile', 'enable_extended_login': 'true'})
    return {'id': item.id, 'authorization_url': url, 'expires_at': item.expires_at}


def connection(db, student, attempt_id):
    purge(db); db.commit()
    item = db.scalar(select(models.LinkedInAuthorization).where(
        models.LinkedInAuthorization.id == attempt_id, models.LinkedInAuthorization.student_pk == student.id))
    if not item:
        fail(404, 'LINKEDIN_CONNECTION_EXPIRED', 'This connection expired or is unavailable. Connect again.')
    return item


async def member_name(code, cfg, transport=None):
    async def bounded_json(client, method, url, **kwargs):
        async with client.stream(method, url, **kwargs) as response:
            if response.status_code == 429:
                raise ValueError('LinkedIn rate limit reached. Try connecting later.')
            if response.status_code in (401, 403):
                raise ValueError('LinkedIn rejected access. Check the app credentials, approved OpenID Connect product and redirect URI.')
            if response.status_code >= 400:
                raise ValueError('LinkedIn could not complete the connection. Check the app configuration and reconnect.')
            data = bytearray()
            async for chunk in response.aiter_bytes():
                data.extend(chunk)
                if len(data) > 65536:
                    raise ValueError('LinkedIn returned an unsupported response.')
            import json
            try:
                payload = json.loads(data)
            except (ValueError, UnicodeError):
                raise ValueError('LinkedIn returned an unsupported response.') from None
            if not isinstance(payload, dict):
                raise ValueError('LinkedIn returned an unsupported response.')
            return payload

    async with httpx.AsyncClient(timeout=15, follow_redirects=False, transport=transport) as client:
        token = await bounded_json(client, 'POST', 'https://www.linkedin.com/oauth/v2/accessToken', data={
            'grant_type': 'authorization_code', 'code': code, 'redirect_uri': cfg.linkedin_redirect_uri,
            'client_id': cfg.linkedin_client_id, 'client_secret': cfg.linkedin_client_secret.get_secret_value()})
        access = token.get('access_token')
        if not isinstance(access, str) or not access or len(access) > 8192 or any(not 33 <= ord(char) <= 126 for char in access):
            raise ValueError('LinkedIn returned an unsupported response.')
        # Read the HTTPS userinfo endpoint, never decode/trust an unverified ID token.
        member = await bounded_json(client, 'GET', 'https://api.linkedin.com/v2/userinfo',
                                    headers={'Authorization': 'Bearer ' + access})
        name = member.get('name')
        if not isinstance(member.get('sub'), str) or not member['sub'] or not isinstance(name, str) or not name.strip():
            raise ValueError('LinkedIn did not return a member name. Confirm the profile permission.')
        return ' '.join(name.split())[:200]


async def callback(db, params):
    states, codes, errors = params.get('state', []), params.get('code', []), params.get('error', [])
    if len(states) != 1 or not 20 <= len(states[0]) <= 128:
        fail(400, 'INVALID_LINKEDIN_STATE', 'Invalid or expired LinkedIn connection. Start again from Skillup.')
    purge(db)
    item = db.scalar(select(models.LinkedInAuthorization).where(
        models.LinkedInAuthorization.state_hash == hashlib.sha256(states[0].encode()).hexdigest()))
    if not item:
        db.commit()
        fail(400, 'INVALID_LINKEDIN_STATE', 'Invalid or expired LinkedIn connection. Start again from Skillup.')
    changed = db.execute(update(models.LinkedInAuthorization).where(
        models.LinkedInAuthorization.id == item.id, models.LinkedInAuthorization.status == 'pending')
        .values(status='exchanging'), execution_options={'synchronize_session': False}).rowcount
    db.commit()
    if changed != 1:
        fail(400, 'LINKEDIN_STATE_USED', 'This LinkedIn connection has already been used. Start again.')
    name, message, status = None, None, 'failed'
    if errors:
        message = 'LinkedIn authorization was declined or unavailable. You can reconnect.'
    elif len(codes) != 1 or not codes[0] or len(codes[0]) > 4096:
        message = 'LinkedIn did not return a valid authorization code. Reconnect.'
    else:
        try:
            cfg = get_settings()
            if not cfg.linkedin_configured:
                raise ValueError('LinkedIn configuration changed. Configure the app and reconnect.')
            name = await member_name(codes[0], cfg)
            status, message = 'connected', 'Basic member details received from the official LinkedIn API. Add experience and skills in the profile editor for career analysis.'
        except httpx.HTTPError:
            message = 'LinkedIn could not be reached. Try connecting again.'
        except ValueError as exc:
            message = str(exc)
    db.execute(update(models.LinkedInAuthorization).where(models.LinkedInAuthorization.id == item.id)
               .values(status=status, name=name, message=message))
    db.commit()
    return status


class PrivateLinkedInCallback:
    """Remove OAuth query credentials before routing and Uvicorn access logging."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] == 'http' and scope.get('path') == '/api/profile/linkedin/callback':
            raw = scope.get('query_string', b'')
            try:
                params = parse_qs(raw.decode('ascii', errors='replace'), max_num_fields=12) if len(raw) <= 16384 else {}
            except ValueError:
                params = {}
            scope.setdefault('state', {})['linkedin_callback_params'] = params
            scope['query_string'] = b''
        await self.app(scope, receive, send)
