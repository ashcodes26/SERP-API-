import json
from types import SimpleNamespace

import pytest

from app.config import Settings
from app.services import ai_gateway


def cfg(**values):
    return Settings(_env_file=None, gemini_api_key='synthetic-test-key', gemini_model='gemini-test', **values)


def test_gateway_rejects_unknown_and_oversized_tasks_without_sdk_call():
    with pytest.raises(ai_gateway.AiGatewayError):
        ai_gateway.generate_structured({}, cfg(), {}, 'system', 1, 1, task_id='unknown')
    with pytest.raises(ai_gateway.AiGatewayError):
        ai_gateway.generate_structured({'x': 'a' * 45_000}, cfg(), {}, 'system', 1, 1, task_id='resume_review_v1')
    with pytest.raises(ai_gateway.AiGatewayError):
        ai_gateway.generate_structured({}, cfg(), {}, 'system', 1, 6001, task_id='resume_review_v1')


def test_gateway_owner_task_limit_is_scoped(monkeypatch):
    ai_gateway._windows.clear()
    settings = cfg(gemini_task_limit_per_hour=1)
    ai_gateway.check_task_limits('roadmap_narrative_v1', 1, settings)
    with pytest.raises(ai_gateway.AiRateLimited):
        ai_gateway.check_task_limits('roadmap_narrative_v1', 1, settings)
    ai_gateway.check_task_limits('resume_review_v1', 1, settings)
    ai_gateway.check_task_limits('roadmap_narrative_v1', 2, settings)


@pytest.mark.parametrize('code, expected', [(429, 'quota_limit'), (404, 'unavailable'), (504, 'timeout'), (500, 'error')])
def test_provider_error_classification(code, expected):
    exc = RuntimeError('private input')
    exc.code = code
    assert ai_gateway.classify_provider_error(exc) == expected


def test_gateway_uses_one_sdk_attempt_without_leaking_payload(monkeypatch):
    from google import genai
    calls = []
    class Client:
        def __init__(self, **kwargs):
            calls.append(kwargs); self.models = self
        def __enter__(self): return self
        def __exit__(self, *args): return None
        def generate_content(self, **kwargs): calls.append(kwargs); return SimpleNamespace(text='{}')
    monkeypatch.setattr(genai, 'Client', Client)
    ai_gateway.generate_structured({'text': 'Synthetic only'}, cfg(), {'type': 'object'}, 'System', 3, 10,
                                   task_id='roadmap_narrative_v1')
    assert calls[0]['http_options'].retry_options.attempts == 1
    assert json.loads(calls[1]['contents']) == {'text': 'Synthetic only'}
