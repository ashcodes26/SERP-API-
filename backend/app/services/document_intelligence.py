"""Student-reviewed facts only. Provider text has no persistence authority."""
from datetime import UTC, datetime, timedelta
import hashlib
import hmac
import json
from pathlib import PurePath
import re
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import delete, select, text as sql_text

from app import models, schemas as s
from app import document_models as m
from app.config import get_settings
from app.services.analysis import get_profile
from app.services.intelligence import known_skill_terms, normalize_skill

SCALARS = {'name', 'department', 'program', 'specialization', 'semester', 'graduation_year'}
WARNINGS = ['Text extraction is not credential or issuer verification; OCR is unavailable.',
            'Skill mentions never establish proficiency. Approved facts remain after review deletion.']


def now():
    return datetime.now(UTC).replace(tzinfo=None)


def fail(code, status=409):
    raise HTTPException(status, detail={'code': code, 'message': {
        'PROPOSAL_STALE': 'This review changed. Reload or refresh before deciding.',
        'EVIDENCE_NOT_VERIFIED': 'The value is not explicitly supported by a unique source excerpt.',
        'CONFLICT_REVIEW_REQUIRED': 'Review both values and explicitly confirm this replacement.',
    }.get(code, code.replace('_', ' ').capitalize()), 'retryable': False})


def configured():
    cfg = get_settings()
    if not cfg.document_review_enabled or not cfg.document_hmac_key or len(cfg.document_hmac_key.get_secret_value()) < 32:
        fail('DOCUMENT_REVIEW_DISABLED', 503)
    return cfg


def commitment(owner, value):
    key = configured().document_hmac_key.get_secret_value().encode()
    payload = json.dumps([owner, value], sort_keys=True, default=str, separators=(',', ':')).encode()
    return hmac.new(key, payload, hashlib.sha256).hexdigest()


def normalized(value):
    return re.sub(r'\s+', ' ', value).strip().casefold()


def fingerprint(db, student):
    return commitment(student.id, get_profile(db, student).model_dump(mode='json'))


def classify(source):
    lower = source.casefold()
    for kind, pattern in [('transcript', r'\b(transcript|grade report)\b'),
                          ('certificate', r'\b(certificate|certification of completion)\b'),
                          ('internship_document', r'\b(internship|intern offer)\b'),
                          ('project_report', r'\bproject report\b'),
                          ('resume', r'\b(resume|curriculum vitae)\b')]:
        if re.search(pattern, lower):
            return kind
    if re.search(r'(?im)^skills\s*:?\s*$', source) and re.search(r'(?im)^(education|experience|projects)\s*:?\s*$', source):
        return 'resume'
    return 'unknown'


def deterministic(source, kind):
    facts = []
    if kind != 'unknown':
        for line in source.splitlines():
            line = line.strip()
            if not line or len(line) > 600:
                continue
            # Academic transcript data stays source-only in v1.
            if kind == 'transcript':
                continue
            for field in sorted(SCALARS):
                label = field.replace('_', '[ _]')
                match = re.fullmatch(label + r'\s*:\s*(.{1,200})', line, re.I)
                if match:
                    facts.append(s.DocumentFact(id=f'fact-{len(facts)}', field=field,
                        value=s.DocumentScalar(value=match[1]), evidence=[s.SourceExcerpt(excerpt=line)]))
            found = set()
            for term, (canonical, _) in known_skill_terms().items():
                if canonical not in found and re.search(r'(?<![\w])' + re.escape(term) + r'(?![\w])', line, re.I):
                    found.add(canonical)
                    facts.append(s.DocumentFact(id=f'fact-{len(facts)}', field='skills',
                        value=s.DocumentSkill(name=canonical), evidence=[s.SourceExcerpt(excerpt=line)]))
            for label, field in [('project', 'projects'), ('experience', 'experience'), ('certification', 'certifications')]:
                match = re.fullmatch(label + r'\s*:\s*(.{1,500})', line, re.I)
                if match:
                    facts.append(s.DocumentFact(id=f'fact-{len(facts)}', field=field,
                        value=s.DocumentScalar(value=match[1]), evidence=[s.SourceExcerpt(excerpt=line)]))
    return s.DocumentExtractionResult(document_type=kind,
        classification=s.DocumentClassification(status='uncertain' if kind == 'unknown' else 'classified',
            confidence=0.5, rationale='Conservative text marker classification; student can correct type.'),
        facts=facts[:100], warnings=WARNINGS)


def verified(source, kind, fact):
    if kind in {'unknown', 'transcript'}:
        return False
    source = normalized(source)
    excerpts = [normalized(e.excerpt) for e in fact.evidence]
    # Page numbers are unavailable in the shared flattened parser. Never assert an unverified page.
    if any(e.page is not None for e in fact.evidence):
        return False
    if any(source.count(e) != 1 for e in excerpts):
        return False
    value = fact.value.name if isinstance(fact.value, s.DocumentSkill) else fact.value.value
    if fact.field == 'skills':
        canonical, _ = normalize_skill(value)
        terms = [term for term, pair in known_skill_terms().items() if pair[0] == canonical]
        return bool(terms) and any(re.search(r'(?<!\w)' + re.escape(term) + r'(?!\w)', e, re.I)
                                   for term in terms for e in excerpts)
    if fact.field in SCALARS:
        # Field labels prevent a provider assigning an arbitrary number/name to the wrong field.
        label = fact.field.replace('_', '[ _]')
        if not any(re.fullmatch(label + r'\s*:\s*' + re.escape(normalized(value)), e, re.I) for e in excerpts):
            return False
        if fact.field in {'semester', 'graduation_year'}:
            if not value.isascii() or not value.isdigit():
                return False
            return 1 <= int(value) <= 16 if fact.field == 'semester' else 1900 <= int(value) <= 2200
        return len(value) <= (200 if fact.field == 'name' else 120)
    # Evidence-only project/experience/certificate entries must be literal, whole labelled statements.
    labels = {'projects': 'project', 'experience': 'experience', 'certifications': 'certification'}
    if fact.field in labels:
        return any(e == labels[fact.field] + ': ' + normalized(value) for e in excerpts)
    if fact.field.endswith('_urls'):
        from urllib.parse import urlsplit
        try:
            url = urlsplit(value)
            if url.scheme != 'https' or not url.hostname or url.username or url.password or url.query or url.fragment:
                return False
            if fact.field == 'github_urls' and url.hostname != 'github.com': return False
            if fact.field == 'linkedin_urls' and url.hostname not in {'linkedin.com', 'www.linkedin.com'}: return False
            return any(normalized(value) in e for e in excerpts)
        except ValueError:
            return False
    return False


def current(db, student, field, value):
    if field in SCALARS:
        result = getattr(student, field)
        return {'value': str(result)} if result is not None else None
    if field == 'skills':
        skill = db.scalar(select(models.Skill).where(models.Skill.canonical_name == value['name']))
        link = db.scalar(select(models.StudentSkill).where(models.StudentSkill.student_pk == student.id,
                         models.StudentSkill.skill_id == skill.id)) if skill else None
        return {'name': value['name']} if link else None
    return None


def items(db, proposal):
    return db.scalars(select(m.ProposalItem).where(m.ProposalItem.proposal_id == proposal.id).order_by(m.ProposalItem.id)).all()


def build(db, student, document, result, engine='deterministic', status='available', ai_consent_at=None):
    for old in db.scalars(select(m.Proposal).where(m.Proposal.document_id == document.id, m.Proposal.status == 'ready_for_review')):
        old.status = 'superseded'; old.version += 1
        for item in items(db, old):
            if item.decision == 'pending': item.decision = 'stale'; item.version += 1
    extraction = m.Extraction(document_id=document.id, engine=engine,
        model=get_settings().gemini_model if engine == 'gemini' else None, status=status,
        result_json=result.model_dump(mode='json'), ai_consent_at=ai_consent_at, expires_at=document.expires_at)
    db.add(extraction); db.flush()
    proposal = m.Proposal(student_pk=student.id, document_id=document.id, extraction_id=extraction.id,
                          profile_fingerprint=fingerprint(db, student))
    db.add(proposal); db.flush()
    seen = set()
    for fact in result.facts:
        if not verified(document.text, document.document_type, fact): continue
        value = fact.value.model_dump()
        if fact.field == 'skills': value = {'name': normalize_skill(value['name'])[0]}
        key = json.dumps([fact.field, value], sort_keys=True)
        if key in seen: continue
        seen.add(key)
        existing = current(db, student, fact.field, value)
        comparison = 'no_change' if existing == value else ('conflict' if existing else 'new')
        db.add(m.ProposalItem(proposal_id=proposal.id, field_path=fact.field,
            operation='update' if comparison == 'conflict' else ('add' if fact.field in SCALARS and existing is None else 'attach_evidence'),
            current_value_json=existing, proposed_value_json=value,
            evidence_json=[e.model_dump() for e in fact.evidence], comparison_status=comparison))
    db.flush()
    return proposal


def purge(db, document, status):
    document.status = status; document.text = None; document.filename = None; document.mime_type = None
    document.duplicate_fingerprint = None; document.classification_status = 'unsupported'
    for extraction in db.scalars(select(m.Extraction).where(m.Extraction.document_id == document.id)):
        extraction.result_json = None
    for proposal in db.scalars(select(m.Proposal).where(m.Proposal.document_id == document.id)):
        proposal.status = status; proposal.profile_fingerprint = None; proposal.version += 1
        for item in items(db, proposal):
            item.current_value_json = None; item.proposed_value_json = None
            item.applied_value_json = None; item.evidence_json = None
            if item.decision == 'pending': item.decision = status
            item.version += 1


def purge_expired(db):
    for doc in db.scalars(select(m.Document).where(m.Document.status == 'active', m.Document.expires_at <= now())):
        purge(db, doc, 'expired')
    db.execute(delete(m.AiCache).where(m.AiCache.expires_at <= now()))
    db.execute(delete(m.AiWindow).where(m.AiWindow.expires_at <= now()))
    db.execute(delete(m.AiDiagnostic).where(m.AiDiagnostic.created_at < now() - timedelta(days=1)))
    db.commit()


def active(db, document):
    if document.status == 'active' and document.expires_at <= now():
        purge(db, document, 'expired'); db.commit()
    if document.status != 'active': fail('DOCUMENT_UNAVAILABLE', 410)


def get_document(db, student, document_id):
    result = db.scalar(select(m.Document).where(m.Document.id == document_id, m.Document.student_pk == student.id))
    if not result: fail('DOCUMENT_NOT_FOUND', 404)
    return result


def get_proposal(db, student, proposal_id):
    result = db.scalar(select(m.Proposal).where(m.Proposal.id == proposal_id, m.Proposal.student_pk == student.id))
    if not result: fail('PROPOSAL_NOT_FOUND', 404)
    return result


def proposal_out(db, proposal):
    return s.DocumentProposalOut(id=proposal.id, document_id=proposal.document_id, status=proposal.status,
        version=proposal.version, refresh_recommended=any(i.decision == 'applied' for i in items(db, proposal)),
        items=[s.DocumentItemOut(id=i.id, field_path=i.field_path, operation=i.operation,
            current_value=i.current_value_json, proposed_value=i.proposed_value_json, evidence=i.evidence_json or [],
            fact_kind=i.fact_kind, comparison_status=i.comparison_status, decision=i.decision, version=i.version)
            for i in items(db, proposal)])


def document_out(db, document):
    proposal = db.scalar(select(m.Proposal).where(m.Proposal.document_id == document.id).order_by(m.Proposal.id.desc()))
    extraction = db.scalar(select(m.Extraction).where(m.Extraction.document_id == document.id).order_by(m.Extraction.id.desc()))
    return s.DocumentOut(id=document.id, filename=document.filename, document_type=document.document_type,
        classification_status=document.classification_status, status=document.status, expires_at=document.expires_at,
        proposal=proposal_out(db, proposal) if proposal else None,
        extraction_status=extraction.status if extraction else 'not_requested', warnings=WARNINGS)


def store(db, student, source, filename, mime, size, consent):
    configured()
    if not consent: fail('STORAGE_CONSENT_REQUIRED', 422)
    purge_expired(db)
    digest = commitment(student.id, ['document-text-v1', normalized(source)])
    old = db.scalar(select(m.Document).where(m.Document.student_pk == student.id, m.Document.duplicate_fingerprint == digest,
                                           m.Document.status == 'active'))
    if old: return document_out(db, old)
    count = len(db.scalars(select(m.Document.id).where(m.Document.student_pk == student.id, m.Document.status == 'active')).all())
    if count >= 20: fail('DOCUMENT_REVIEW_LIMIT', 422)
    kind = classify(source)
    filename = re.sub(r'[\x00-\x1f\x7f]', '', PurePath(filename.replace('\\', '/')).name)[:200]
    document = m.Document(student_pk=student.id, duplicate_fingerprint=digest, filename=filename, mime_type=mime,
        byte_size=size, document_type=kind, classification_status='uncertain' if kind == 'unknown' else 'classified',
        text=source, expires_at=now() + timedelta(days=30))
    db.add(document); db.flush()
    build(db, student, document, deterministic(source, kind))
    db.commit()
    return document_out(db, document)


def decide(db, student_id, account_id, proposal_id, item_id, body):
    configured()
    # Acquire the SQLite writer reservation BEFORE re-reading profile/proposal state.
    db.rollback()
    if db.bind.dialect.name != 'sqlite': fail('DOCUMENT_DATABASE_UNSUPPORTED', 503)
    db.execute(sql_text('BEGIN IMMEDIATE'))
    try:
        student = db.get(models.Student, student_id)
        proposal = get_proposal(db, student, proposal_id)
        account = db.get(models.Account, account_id) if account_id else None
        if not account or not account.active or account.student_pk != student_id or account.role != 'student': fail('FORBIDDEN', 403)
        request_digest = commitment(student_id, [proposal_id, item_id, body.model_dump()])
        audit = db.scalar(select(m.Audit).where(m.Audit.actor_account_id == account_id, m.Audit.idempotency_key == body.idempotency_key))
        if audit:
            if audit.request_commitment != request_digest: fail('IDEMPOTENCY_KEY_REUSED')
            return {'proposal': proposal_out(db, proposal), 'profile': get_profile(db, student), 'replayed': True}
        document = get_document(db, student, proposal.document_id); active(db, document)
        item = db.scalar(select(m.ProposalItem).where(m.ProposalItem.id == item_id, m.ProposalItem.proposal_id == proposal.id))
        if not item: fail('PROPOSAL_ITEM_NOT_FOUND', 404)
        if proposal.status != 'ready_for_review' or item.decision != 'pending' or proposal.version != body.proposal_version or item.version != body.item_version:
            fail('PROPOSAL_STALE')
        if fingerprint(db, student) != proposal.profile_fingerprint: fail('PROPOSAL_STALE')
        value = body.edited_value.model_dump() if body.decision == 'edit' and body.edited_value else item.proposed_value_json
        if body.decision == 'edit' and body.edited_value is None: fail('EVIDENCE_NOT_VERIFIED', 422)
        before = item.current_value_json
        evidence = item.evidence_json
        provenance = str(uuid4())
        if body.decision != 'reject':
            fact = s.DocumentFact(id='fact-review', field=item.field_path, value=value, evidence=evidence)
            if not verified(document.text, document.document_type, fact): fail('EVIDENCE_NOT_VERIFIED', 422)
            if current(db, student, item.field_path, item.proposed_value_json) != before: fail('PROPOSAL_STALE')
            if item.comparison_status == 'conflict' and not body.confirm_conflict: fail('CONFLICT_REVIEW_REQUIRED')
            if item.field_path in SCALARS:
                setattr(student, item.field_path, int(value['value']) if item.field_path in {'semester', 'graduation_year'} else value['value'])
            summary = value.get('name', value.get('value', ''))
            ev = models.Evidence(student_pk=student.id, source_type='document_intelligence',
                source_ref=f'dil:{document.id}:{item.id}:{provenance}', extracted_summary=summary,
                extraction_confidence=0.5)
            db.add(ev); db.flush()
            if item.field_path == 'skills':
                canonical, category = normalize_skill(value['name'])
                skill = db.scalar(select(models.Skill).where(models.Skill.canonical_name == canonical))
                if not skill:
                    skill = models.Skill(canonical_name=canonical, category=category); db.add(skill); db.flush()
                link = db.scalar(select(models.StudentSkill).where(models.StudentSkill.student_pk == student.id, models.StudentSkill.skill_id == skill.id))
                if not link:
                    link = models.StudentSkill(student_pk=student.id, skill_id=skill.id, level=None, confidence=0.5, evidence_ids=[]); db.add(link)
                link.evidence_ids = list(dict.fromkeys([*(link.evidence_ids or []), ev.id]))
            item.decision = 'applied'; item.applied_at = now(); item.applied_value_json = value
        else:
            item.decision = 'rejected'
        item.version += 1; proposal.version += 1
        db.add(m.Audit(student_pk=student.id, proposal_item_id=item.id, actor_account_id=account_id,
            action=body.decision, provenance_id=provenance, idempotency_key=body.idempotency_key,
            before_commitment=commitment(student.id, before), after_commitment=commitment(student.id, value if body.decision != 'reject' else before),
            evidence_commitment=commitment(student.id, evidence), request_commitment=request_digest))
        db.flush(); db.expire(student, ['evidence', 'skills'])
        proposal.profile_fingerprint = fingerprint(db, student)
        if all(i.decision != 'pending' for i in items(db, proposal)): proposal.status = 'completed'
        db.commit()
        return {'proposal': proposal_out(db, proposal), 'profile': get_profile(db, student), 'replayed': False}
    except Exception:
        db.rollback()
        raise
