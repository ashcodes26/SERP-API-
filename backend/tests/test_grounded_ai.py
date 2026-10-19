import json
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from app import models, document_models as m, schemas as s
from app.auth import Principal, current_principal
from app.config import get_settings
from app.main import app
from app.services import ai_gateway, ai_runtime, grounded_ai
from app.services.analysis import analyze
from test_document_intelligence import review  # noqa: F401


def role(factory, ids):
    with factory() as db:
        student = db.get(models.Student, ids[0])
        skill = models.Skill(canonical_name='Python'); db.add(skill); db.flush()
        job = models.Job(title='Synthetic role', is_seeded=True); db.add(job); db.flush()
        db.add(models.JobSkill(job_id=job.id, skill_id=skill.id, requirement_type='required', importance=1.0, expected_level=3))
        db.commit()
        report = analyze(db, student, job)
        return report.id, skill.id


def response(source='gap:1', action='assess', **extra):
    return SimpleNamespace(text=json.dumps({'items': [{'source_id':source,'action':action}], **extra}))


def test_readiness_cache_consent_no_score_or_progress_mutation(review, monkeypatch):
    client, factory, ids = review; analysis_id, skill_id = role(factory, ids)
    with factory() as db:
        db.add(models.RoadmapItem(student_pk=ids[0], analysis_id=analysis_id, skill_id=skill_id, task='Saved practice', status='done', completion_evidence='Synthetic completed task'))
        db.commit(); before = db.get(models.Analysis, analysis_id).alignment
    calls = []
    def generate(*args, **kwargs): calls.append(args[0]); return response(f'gap:{skill_id}')
    monkeypatch.setattr(ai_gateway, 'generate_structured', generate)
    path = f'/api/ai/readiness/{analysis_id}'
    assert client.post(path, json={'ai_consent':False}).json()['status'] == 'not_requested' and not calls
    first = client.post(path, json={'ai_consent':True}); assert first.status_code == 200, first.text
    assert first.json()['status'] == 'available' and not first.json()['cache_hit']
    assert first.json()['recommendations'][0]['status'] == 'done'
    assert client.post(path, json={'ai_consent':True}).json()['cache_hit'] and len(calls) == 1
    with factory() as db:
        assert db.get(models.Analysis, analysis_id).alignment == before
        assert db.scalar(select(models.RoadmapItem)).status == 'done'
        cache = db.scalar(select(m.AiCache)); assert cache.result_json == {'items':[{'source_id':f'gap:{skill_id}','action':'assess'}]}
        assert not db.scalar(select(models.StudentSkill))
        db.add(models.Evidence(student_pk=ids[0], source_type='self_report', extracted_summary='Explicit synthetic evidence')); db.commit()
    changed = client.post(path, json={'ai_consent':True}).json()
    assert not changed['cache_hit'] and changed['context_version'] != first.json()['context_version']
    app.dependency_overrides[current_principal] = lambda: Principal('student', ids[1])
    assert client.post(path, json={'ai_consent':True}).status_code == 404
    app.dependency_overrides[current_principal] = lambda: Principal('admin')
    assert client.post(path, json={'ai_consent':True}).status_code == 403


@pytest.mark.parametrize('payload', [response('invented'),response(action='practice'),response(score=100),SimpleNamespace(text='{}'),SimpleNamespace(text='x'*9000)])
def test_invalid_ungrounded_or_oversized_output_is_withheld(review, monkeypatch, payload):
    client, factory, ids = review; analysis_id, _ = role(factory, ids)
    monkeypatch.setattr(ai_gateway, 'generate_structured', lambda *args, **kwargs: payload)
    result = client.post(f'/api/ai/readiness/{analysis_id}', json={'ai_consent':True}).json()
    assert result['status'] == 'invalid_output' and not result['insights']
    with factory() as db: assert not db.scalar(select(m.AiCache))


@pytest.mark.parametrize('mode,status', [('timeout','timeout'),('quota','quota_limit'),('blocked','blocked'),('provider','unavailable')])
def test_provider_failures_are_generic(review, monkeypatch, mode, status):
    client, factory, ids = review; analysis_id, _ = role(factory, ids)
    def generate(*args, **kwargs):
        if mode == 'blocked': return SimpleNamespace(text=None)
        if mode == 'timeout': raise TimeoutError('private text')
        error = RuntimeError('private text synthetic-key'); error.code=429 if mode == 'quota' else 404; raise error
    monkeypatch.setattr(ai_gateway, 'generate_structured', generate)
    result = client.post(f'/api/ai/readiness/{analysis_id}', json={'ai_consent':True}).json()
    assert result['status'] == status and 'private text' not in json.dumps(result)


def test_durable_quota_and_cache_owner_model_schema_context_isolation(review, monkeypatch):
    _, factory, ids = review
    cfg = get_settings().model_copy(update={'gemini_task_limit_per_hour':1})
    sources = [s.AiSourceOut(id='gap:1',label='Python',detail='Unknown proficiency')]
    allowed = {'gap:1':['assess']}; calls=[]
    monkeypatch.setattr(ai_gateway, 'generate_structured', lambda *args, **kwargs: calls.append(1) or response())
    args = (factory.kw['bind'], ids[0], 'readiness_explanation_v1', sources, allowed)
    assert grounded_ai.explain(*args, {'v':1}, True, cfg).status == 'available'
    assert grounded_ai.explain(*args, {'v':1}, True, cfg).cache_hit
    assert grounded_ai.explain(*args, {'v':2}, True, cfg).status == 'quota_limit'
    other=(factory.kw['bind'],ids[1],'readiness_explanation_v1',sources,allowed)
    assert grounded_ai.explain(*other, {'v':1}, True, cfg).status == 'available' and len(calls)==2
    key=lambda model,schema,context: ai_runtime.cache_key(ids[0],'readiness_explanation_v1',context,cfg.model_copy(update={'gemini_model':model}),schema)
    assert len({key('one',{},{}),key('two',{},{}),key('one',{'v':2},{}),key('one',{}, {'v':2})}) == 4


def test_profile_changes_during_provider_call_hide_stale_result(review, monkeypatch):
    client,factory,ids=review; analysis_id,skill_id=role(factory,ids)
    def generate(*args,**kwargs):
        with factory() as db:
            db.add(models.Evidence(student_pk=ids[0],source_type='self_report',extracted_summary='Changed'));db.commit()
        return response(f'gap:{skill_id}')
    monkeypatch.setattr(ai_gateway,'generate_structured',generate)
    result=client.post(f'/api/ai/readiness/{analysis_id}',json={'ai_consent':True}).json()
    assert result['status']=='stale' and not result['insights']
