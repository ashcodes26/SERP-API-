"""Official OAuth flow with explicitly synthetic provider fixtures; no live credentials."""
import asyncio
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
from sqlalchemy import select

from app import models
from app.auth import Principal, current_principal
from app.config import get_settings
from app.main import app
from app.services import linkedin
from test_workspace import workspace  # noqa: F401 -- shared isolated database/student fixture


@pytest.fixture
def configured(workspace, monkeypatch):
    monkeypatch.setenv('LINKEDIN_CLIENT_ID', 'demo-fixture-client')
    monkeypatch.setenv('LINKEDIN_CLIENT_SECRET', 'demo-fixture-secret')
    monkeypatch.setenv('LINKEDIN_REDIRECT_URI', 'https://backend.example/api/profile/linkedin/callback')
    get_settings.cache_clear()
    return workspace


def begin(client):
    response = client.post('/api/profile/linkedin/automatic', json={'consent': True})
    assert response.status_code == 200, response.text
    value = response.json()
    query = parse_qs(urlsplit(value['authorization_url']).query)
    assert query['scope'] == ['openid profile']
    assert query['redirect_uri'] == ['https://backend.example/api/profile/linkedin/callback']
    assert 'secret' not in response.text
    return value, query['state'][0]


def test_official_oauth_success_is_private_single_use_and_preserves_work(configured, monkeypatch):
    client, factory, ids = configured
    profile = {'consent': True, 'profile_text': 'SKILLS\nPython and SQL\nPROJECTS\nBuilt a SQL dashboard.', 'confirmed': True}
    assert client.put('/api/profile/linkedin', json=profile).status_code == 200
    before = client.get('/api/profile/linkedin').json()
    assert before['automatic_import_available']
    calls = []
    def provider(request):
        calls.append(request.url.path)
        if request.url.path.endswith('/accessToken'):
            body = parse_qs(request.content.decode())
            assert body['client_secret'] == ['demo-fixture-secret']
            assert body['code'] == ['demo-fixture-code']
            return httpx.Response(200, json={'access_token': 'demo_fixture-token', 'id_token': 'ignored-unverified', 'provenance': 'demo_fixture'})
        assert str(request.url) == 'https://api.linkedin.com/v2/userinfo'
        assert request.headers['authorization'] == 'Bearer demo_fixture-token'
        return httpx.Response(200, json={'sub': 'demo_fixture-subject', 'name': 'Demo Fixture Student', 'provenance': 'demo_fixture'})
    original = linkedin.member_name
    async def fetch(code, cfg):
        return await original(code, cfg, transport=httpx.MockTransport(provider))
    monkeypatch.setattr(linkedin, 'member_name', fetch)
    attempt, state = begin(client)
    assert client.get(f'/api/profile/linkedin/connection/{attempt["id"]}').json()['status'] == 'pending'
    callback = client.get('/api/profile/linkedin/callback', params={'state': state, 'code': 'demo-fixture-code'})
    assert callback.status_code == 200
    assert callback.headers['cache-control'] == 'no-store'
    assert callback.headers['referrer-policy'] == 'no-referrer'
    assert 'demo-fixture-code' not in callback.text and state not in callback.text
    result = client.get(f'/api/profile/linkedin/connection/{attempt["id"]}')
    assert result.json()['status'] == 'connected'
    assert result.json()['name'] == 'Demo Fixture Student'
    assert result.json()['source'] == 'linkedin_oidc'
    assert 'token' not in result.text
    assert calls == ['/oauth/v2/accessToken', '/v2/userinfo']
    assert client.get('/api/profile/linkedin').json() == before
    assert client.get('/api/profile/linkedin/callback', params={'state': state, 'code': 'replay'}).status_code == 400
    assert len(calls) == 2
    # A refreshed screen can recover the receipt even after the OAuth attempt expires.
    with factory() as db:
        db.get(models.LinkedInAuthorization, attempt['id']).expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()
    latest = client.get('/api/profile/linkedin/connection')
    assert latest.status_code == 200 and latest.headers['cache-control'] == 'no-store'
    assert latest.json() == result.json()
    assert client.get(f'/api/profile/linkedin/connection/{attempt["id"]}').json()['status'] == 'connected'
    app.dependency_overrides[current_principal] = lambda: Principal('student', ids[1])
    assert client.get('/api/profile/linkedin/connection').json() is None
    assert client.get(f'/api/profile/linkedin/connection/{attempt["id"]}').status_code == 404
    assert client.delete(f'/api/profile/linkedin/connection/{attempt["id"]}').status_code == 404
    app.dependency_overrides[current_principal] = lambda: Principal('student', ids[0])
    assert client.delete('/api/profile/linkedin').status_code == 200
    with factory() as db:
        assert not db.scalar(select(models.LinkedInAuthorization))


def test_oauth_consent_configuration_denial_cancel_expiry_and_reconnect(configured, monkeypatch):
    client, factory, _ = configured
    assert client.post('/api/profile/linkedin/automatic', json={'consent': False}).status_code == 422
    first, first_state = begin(client)
    second, second_state = begin(client)
    assert client.get('/api/profile/linkedin/callback', params={'state': first_state, 'code': 'unused'}).status_code == 400
    denied = client.get('/api/profile/linkedin/callback', params={'state': second_state, 'error': 'access_denied', 'error_description': 'private provider text'})
    assert denied.status_code == 200 and 'private provider text' not in denied.text
    assert client.get(f'/api/profile/linkedin/connection/{second["id"]}').json()['status'] == 'failed'
    assert client.delete(f'/api/profile/linkedin/connection/{second["id"]}').status_code == 200
    assert client.get('/api/profile/linkedin/callback', params={'state': second_state, 'code': 'unused'}).status_code == 400
    third, state = begin(client)
    with factory() as db:
        db.get(models.LinkedInAuthorization, third['id']).expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()
    assert client.get('/api/profile/linkedin/callback', params={'state': state, 'code': 'unused'}).status_code == 400
    assert client.get(f'/api/profile/linkedin/connection/{third["id"]}').status_code == 404
    assert client.get('/api/profile/linkedin/connection').json() is None
    assert client.get('/api/profile/linkedin/callback?' + '&'.join(f'x{i}=private' for i in range(13))).status_code == 400
    assert client.get('/api/profile/linkedin/callback', params={'state': 'wrong-state-with-enough-length', 'code': 'private'}).status_code == 400
    monkeypatch.setenv('LINKEDIN_CLIENT_SECRET', ''); get_settings.cache_clear()
    response = client.post('/api/profile/linkedin/automatic', json={'consent': True})
    assert response.status_code == 503 and response.json()['detail']['code'] == 'LINKEDIN_NOT_CONFIGURED'


@pytest.mark.parametrize('kind', ['denied', 'rate_limit', 'malformed', 'oversize', 'timeout', 'missing_name'])
def test_provider_failures_are_bounded_and_do_not_expose_credentials(configured, monkeypatch, kind):
    client, _, _ = configured
    def provider(request):
        if kind == 'timeout':
            raise httpx.ReadTimeout('private-provider-token', request=request)
        if kind == 'denied':
            return httpx.Response(401, text='private-provider-token')
        if kind == 'rate_limit':
            return httpx.Response(429, text='private-provider-token')
        if kind == 'malformed':
            return httpx.Response(200, text='private-provider-token')
        if kind == 'oversize':
            return httpx.Response(200, content=b'x' * 65537)
        if request.url.path.endswith('/accessToken'):
            return httpx.Response(200, json={'access_token': 'private-provider-token', 'provenance': 'demo_fixture'})
        return httpx.Response(200, json={'sub': 'demo_fixture-subject', 'provenance': 'demo_fixture'})
    original = linkedin.member_name
    async def fetch(code, cfg):
        return await original(code, cfg, transport=httpx.MockTransport(provider))
    monkeypatch.setattr(linkedin, 'member_name', fetch)
    attempt, state = begin(client)
    assert client.get('/api/profile/linkedin/callback', params={'state': state, 'code': 'fixture'}).status_code == 200
    result = client.get(f'/api/profile/linkedin/connection/{attempt["id"]}')
    assert result.json()['status'] == 'failed'
    assert 'private-provider-token' not in result.text and 'demo-fixture-secret' not in result.text


def test_callback_query_is_removed_before_access_logging():
    scope = {'type': 'http', 'path': '/api/profile/linkedin/callback', 'query_string': b'code=private-code&state=private-state'}
    async def downstream(current, receive, send):
        assert current['query_string'] == b''
        assert current['state']['linkedin_callback_params']['code'] == ['private-code']
    asyncio.run(linkedin.PrivateLinkedInCallback(downstream)(scope, None, None))
    assert scope['query_string'] == b''
