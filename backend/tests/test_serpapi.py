import asyncio

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import app
from app.schemas import ResourceSearchIn
from app.services.serpapi import SearchFailure, search_resources


def execute(payload, status=200):
    def handler(request):
        assert request.url.host == "serpapi.com"
        assert request.url.params["api_key"] == "test-secret"
        return httpx.Response(status, json=payload)
    return httpx.MockTransport(handler)


def run(req, transport, **settings):
    config = Settings(_env_file=None, serpapi_api_key="test-secret", **settings)
    return asyncio.run(search_resources(ResourceSearchIn(**req), config, transport))


def test_learning_resources_are_normalized_bounded_and_deduplicated():
    payload = {"organic_results": [
        {"title": "SQL guide", "link": "https://example.org/sql", "snippet": "Study SQL"},
        {"title": "SQL guide", "link": "https://example.org/sql"},
        {"title": "Unsafe", "link": "javascript:alert(1)"},
        {"title": "Course", "link": "https://university.edu/course"},
    ]}
    result = run({"skill": "SQL", "max_results": 1}, execute(payload))
    assert result.query == "SQL tutorial OR course"
    assert len(result.results) == 1
    assert result.results[0].source_domain == "example.org"
    assert result.results[0].provenance.value == "serpapi_live"


def test_job_postings():
    result = run({"skill": "Python", "kind": "job_postings"}, execute({"jobs_results": [
        {"title": "Python Engineer", "share_link": "https://google.com/jobs/123", "description": "Python"}
    ]}))
    assert len(result.results) == 1
    assert result.results[0].snippet == "Python"


def test_empty_results():
    result = run({"skill": "SQL"}, execute({"organic_results": []}))
    assert result.results == [] and result.warnings


@pytest.mark.parametrize("status,code", [(401,"SERPAPI_AUTH_FAILED"),(403,"SERPAPI_AUTH_FAILED"),
                                              (429,"SERPAPI_RATE_LIMITED"),(500,"SERPAPI_UNAVAILABLE")])
def test_upstream_http_failures(status,code):
    with pytest.raises(SearchFailure) as err:
        run({"skill": "SQL"}, execute({},status))
    assert err.value.code == code
    assert "test-secret" not in err.value.message


def test_provider_error_body_and_invalid_structure():
    for payload, code in [({"error":"Invalid API key"},"SERPAPI_UPSTREAM_ERROR"),
                          ({"organic_results": {}},"UPSTREAM_MALFORMED")]:
        with pytest.raises(SearchFailure) as err:
            run({"skill": "SQL"}, execute(payload))
        assert err.value.code == code


def test_timeout():
    def handler(request):
        raise httpx.ReadTimeout("timed out")
    with pytest.raises(SearchFailure) as err:
        run({"skill":"SQL"}, httpx.MockTransport(handler))
    assert err.value.status == 504 and err.value.retryable


def test_missing_key_endpoint_and_invalid_input(monkeypatch):
    with TestClient(app) as client:
        # No key in the environment in this test environment.
        resp = client.post("/api/resources/search", json={"skill": "SQL"})
        assert resp.status_code == 503
        assert resp.json()["code"] == "SERPAPI_NOT_CONFIGURED"
        assert resp.json()["retryable"] is False
        assert client.post("/api/resources/search", json={"skill": ""}).status_code == 422


def test_endpoint_returns_typed_success(monkeypatch):
    from app import main as main_module
    from app.enums import ResourceProvenance
    from app.schemas import ResourceLink, ResourceSearchOut

    async def fake_search(request, settings):
        assert request.kind == "learning_resource"
        return ResourceSearchOut(
            query="SQL tutorial OR course",
            results=[ResourceLink(title="Reference", url="https://example.org/sql",
                                  provenance=ResourceProvenance.serpapi_live)],
            provenance=ResourceProvenance.serpapi_live,
        )

    monkeypatch.setattr(main_module, "search_resources", fake_search)
    with TestClient(app) as client:
        response = client.post("/api/resources/search", json={"skill": "SQL"})
    assert response.status_code == 200
    assert response.json()["results"][0]["url"] == "https://example.org/sql"
