"""Durable owner/task quotas and opt-in ID-only cache for new domain adapters."""
from datetime import UTC, datetime, timedelta
import hashlib
import json

from sqlalchemy import delete
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.orm import Session

from app import document_models as m
from app.services import ai_gateway as gateway


def now():
    return datetime.now(UTC).replace(tzinfo=None)


def cache_key(owner, task, payload, cfg, schema):
    # Digest never stored for source-document tasks. Cache values are IDs/enums only.
    return hashlib.sha256(json.dumps([owner, task, payload, cfg.gemini_model, 'prompt-v1', schema],
        sort_keys=True, default=str).encode()).hexdigest()


def reserve(engine, owner, task, cfg):
    stamp = now()
    hour = stamp.replace(minute=0, second=0, microsecond=0)
    key = f'{owner}:{task}:{hour.isoformat()}'
    with Session(engine) as db:
        db.execute(delete(m.AiWindow).where(m.AiWindow.expires_at <= stamp))
        statement = insert(m.AiWindow).values(key=key, attempts=1, expires_at=hour + timedelta(hours=1))
        statement = statement.on_conflict_do_update(index_elements=['key'],
            set_={'attempts': m.AiWindow.attempts + 1}, where=m.AiWindow.attempts < cfg.gemini_task_limit_per_hour)
        if db.execute(statement).rowcount != 1:
            raise gateway.AiRateLimited('AI request limit reached')
        db.commit()


def diagnostic(engine, task, status):
    with Session(engine) as db:
        db.execute(delete(m.AiDiagnostic).where(m.AiDiagnostic.created_at < now() - timedelta(days=1)))
        db.add(m.AiDiagnostic(task_id=task, status=status)); db.commit()


def request(engine, owner, task, payload, cfg, schema, system, tokens):
    reserve(engine, owner, task, cfg)
    try:
        response = gateway.generate_structured(payload, cfg, schema, system,
            cfg.gemini_timeout_seconds, tokens, task_id=task)
        if not getattr(response, 'text', None):
            diagnostic(engine, task, 'blocked')
            return None
        return response
    except Exception as exc:
        diagnostic(engine, task, gateway.classify_provider_error(exc))
        raise
