"""Shared, bounded Gemini transport for consent-gated SkillUp AI tasks.

This module deliberately has no database writes and never logs user input or
provider responses. Domain services own prompts, Pydantic schemas, consent and
source verification; the gateway owns only transport-adjacent safety controls.
"""
from __future__ import annotations

import json
import time
from contextlib import contextmanager
from contextvars import ContextVar
from collections import defaultdict, deque
from dataclasses import dataclass
from threading import Lock
from typing import Any, TypeVar

import httpx
from pydantic import BaseModel, ValidationError


@dataclass(frozen=True)
class AiTask:
    id: str
    max_input_chars: int
    max_output_tokens: int


TASKS = {
    'document_extraction_v1': AiTask('document_extraction_v1', 40_000, 6_000),
    'readiness_explanation_v1': AiTask('readiness_explanation_v1', 30_000, 1_800),
    'linkedin_optimization_v1': AiTask('linkedin_optimization_v1', 30_000, 1_800),
    'job_explanation_v1': AiTask('job_explanation_v1', 30_000, 1_800),
    'resume_review_v1': AiTask('resume_review_v1', 45_000, 6_000),
    'resume_rewrite_verify_v1': AiTask('resume_rewrite_verify_v1', 20_000, 2_000),
    'roadmap_narrative_v1': AiTask('roadmap_narrative_v1', 30_000, 1_800),
}


class AiGatewayError(RuntimeError):
    """Safe gateway error; its message is suitable for a domain service, not a client."""


class AiRateLimited(AiGatewayError):
    pass


_windows: dict[tuple[int, str], deque[float]] = defaultdict(deque)
_window_lock = Lock()
_owner_scope = ContextVar('ai_owner_scope', default=None)


@contextmanager
def owner_scope(engine, owner_id):
    """Supply owner budgets without changing the existing adapter/test seams."""
    token = _owner_scope.set((engine, owner_id))
    try:
        yield
    finally:
        _owner_scope.reset(token)


def classify_provider_error(exc: Exception) -> str:
    """Return a stable, privacy-safe classification without exposing provider text."""
    if isinstance(exc, (httpx.TimeoutException, TimeoutError)):
        return 'timeout'
    code = getattr(exc, 'code', None) or getattr(getattr(exc, 'response', None), 'status_code', None)
    if code == 429:
        return 'quota_limit'
    if code in {400, 401, 403, 404}:
        return 'unavailable'
    if code in {408, 504}:
        return 'timeout'
    if isinstance(exc, httpx.RequestError):
        return 'unavailable'
    return 'error'


def check_task_limits(task_id: str, owner_id: int | None, cfg: Any) -> None:
    """Best-effort in-process guard; persistent quota accounting is added with DIL tables.

    Owner-less compatibility callers are intentionally not throttled here because
    legacy services do not yet receive a principal. New tasks must provide owner.
    """
    if task_id not in TASKS:
        raise AiGatewayError('Unknown AI task')
    if owner_id is None:
        return
    limit = int(getattr(cfg, 'gemini_task_limit_per_hour', 5))
    if limit < 1:
        raise AiRateLimited('AI requests are temporarily unavailable')
    now = time.monotonic()
    key = (owner_id, task_id)
    with _window_lock:
        window = _windows[key]
        while window and now - window[0] >= 3600:
            window.popleft()
        if len(window) >= limit:
            raise AiRateLimited('AI request limit reached')
        window.append(now)


def generate_structured(data: object, cfg: Any, schema: dict, system: str, timeout: float,
                        max_tokens: int, *, task_id: str, owner_id: int | None = None):
    """Perform one structured Gemini call. No retries, tools, files, or logging."""
    task = TASKS.get(task_id)
    if task is None:
        raise AiGatewayError('Unknown AI task')
    if max_tokens > task.max_output_tokens:
        raise AiGatewayError('Task output limit exceeded')
    encoded = json.dumps(data, separators=(',', ':'), ensure_ascii=False)
    if len(encoded) > task.max_input_chars:
        raise AiGatewayError('Task input limit exceeded')
    if not getattr(cfg, 'gemini_api_key', None) or not cfg.gemini_api_key.get_secret_value().strip():
        raise AiGatewayError('Gemini is not configured')
    scope = _owner_scope.get()
    if scope is not None:
        from sqlalchemy import inspect
        from app.services.ai_runtime import reserve
        engine, scoped_owner = scope
        if 'ai_request_windows' in inspect(engine).get_table_names():
            reserve(engine, scoped_owner, task_id, cfg)
        else:
            # Compatibility for pre-migration deployments; isolated per database/owner.
            check_task_limits(task_id, hash((str(engine.url), scoped_owner)), cfg)
    else:
        check_task_limits(task_id, owner_id, cfg)
    from google import genai
    from google.genai import types
    # attempts=1 includes the initial request. Provider retries and tool calls are disabled.
    with genai.Client(api_key=cfg.gemini_api_key.get_secret_value(), enterprise=False,
                      http_options=types.HttpOptions(timeout=int(timeout * 1000),
                          retry_options=types.HttpRetryOptions(attempts=1))) as client:
        return client.models.generate_content(model=cfg.gemini_model, contents=encoded,
            config=types.GenerateContentConfig(system_instruction=system,
                response_mime_type='application/json', response_json_schema=schema,
                temperature=0.1, max_output_tokens=max_tokens))


T = TypeVar('T', bound=BaseModel)


def validate_response(text: str | None, model: type[T], *, max_chars: int) -> T:
    if not text or len(text) > max_chars:
        raise ValueError('Empty or oversized structured response')
    try:
        return model.model_validate_json(text)
    except ValidationError:
        raise
