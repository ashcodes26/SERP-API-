"""Private student-only document review. New routes preserve existing contracts."""
from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app import schemas as s
from app import document_models as m
from app.auth import Principal, current_principal
from app.db import get_db
from app.routes.workspace import owner
from app.services import document_intelligence as service
from app.services.resume_files import MAX_RESUME_BYTES, parse_resume
from app.services.serpapi import SearchFailure

router = APIRouter(prefix='/api', tags=['private document review'])


async def parsed(file):
    try:
        data = await file.read(MAX_RESUME_BYTES + 1)
        source = await run_in_threadpool(parse_resume, data, file.filename or '', file.content_type)
        return source, len(data)
    except SearchFailure as exc:
        service.fail(exc.code.replace('RESUME_', 'DOCUMENT_'), exc.status)
    finally:
        await file.close()


@router.get('/documents/capabilities')
def capabilities(student=Depends(owner)):
    try:
        service.configured()
        enabled = True
    except Exception:
        enabled = False
    return {'review_enabled': enabled, 'review_retention_days': 30, 'binary_retained': False}


@router.post('/documents/preview', response_model=s.DocumentExtractionResult)
async def preview(file: UploadFile = File(), student=Depends(owner)):
    source, _ = await parsed(file)
    return service.deterministic(source, service.classify(source))


@router.post('/documents', response_model=s.DocumentOut, status_code=201)
async def create(file: UploadFile = File(), storage_consent: bool = Form(), db: Session = Depends(get_db), student=Depends(owner)):
    service.configured()
    if not storage_consent: service.fail('STORAGE_CONSENT_REQUIRED', 422)
    source, size = await parsed(file)
    return service.store(db, student, source, file.filename or '', file.content_type, size, storage_consent)


@router.get('/documents', response_model=list[s.DocumentOut])
def documents(db: Session = Depends(get_db), student=Depends(owner)):
    service.configured(); service.purge_expired(db)
    return [service.document_out(db, doc) for doc in db.scalars(select(m.Document).where(m.Document.student_pk == student.id).order_by(m.Document.id.desc()).limit(100))]


@router.get('/documents/{document_id}', response_model=s.DocumentOut)
def detail(document_id: int, db: Session = Depends(get_db), student=Depends(owner)):
    service.configured(); service.purge_expired(db)
    return service.document_out(db, service.get_document(db, student, document_id))


@router.delete('/documents/{document_id}')
def remove(document_id: int, db: Session = Depends(get_db), student=Depends(owner)):
    service.configured()
    student_id = student.id; db.rollback(); db.execute(text('BEGIN IMMEDIATE'))
    from app.models import Student
    student = db.get(Student, student_id)
    document = service.get_document(db, student, document_id)
    service.purge(db, document, 'deleted'); db.commit()
    return {'deleted': True, 'message': 'Review data purged. Approved profile facts and minimal audit records remain.'}


@router.patch('/documents/{document_id}/type', response_model=s.DocumentOut)
def correct_type(document_id: int, body: s.DocumentTypeIn, db: Session = Depends(get_db), student=Depends(owner), principal: Principal = Depends(current_principal)):
    service.configured()
    # Use the same serialization boundary as approval to prevent correction/approval races.
    student_id = student.id; db.rollback(); db.execute(text('BEGIN IMMEDIATE'))
    from app.models import Student
    student = db.get(Student, student_id)
    document = service.get_document(db, student, document_id); service.active(db, document)
    proposal = db.scalar(select(m.Proposal).where(m.Proposal.document_id == document_id).order_by(m.Proposal.id.desc()))
    if not proposal or proposal.version != body.version: service.fail('PROPOSAL_STALE')
    all_proposals = db.scalars(select(m.Proposal.id).where(m.Proposal.document_id == document_id)).all()
    if db.scalar(select(m.ProposalItem.id).where(m.ProposalItem.proposal_id.in_(all_proposals), m.ProposalItem.decision == 'applied')):
        service.fail('DOCUMENT_ALREADY_APPLIED')
    document.document_type = body.document_type; document.classification_status = 'student_corrected'
    from uuid import uuid4
    if not principal.account_id: service.fail('FORBIDDEN', 403)
    opaque = str(uuid4())
    db.add(m.Audit(student_pk=student.id, proposal_item_id=None, actor_account_id=principal.account_id,
        action='type_corrected', provenance_id=opaque, idempotency_key=str(uuid4()),
        before_commitment=service.commitment(student.id, proposal.id),
        after_commitment=service.commitment(student.id, body.document_type),
        evidence_commitment=service.commitment(student.id, opaque), request_commitment=service.commitment(student.id, opaque)))
    service.build(db, student, document, service.deterministic(document.text, body.document_type))
    db.commit()
    return service.document_out(db, document)


@router.get('/profile-update-proposals/{proposal_id}', response_model=s.DocumentProposalOut)
def proposal(proposal_id: int, db: Session = Depends(get_db), student=Depends(owner)):
    service.configured(); service.purge_expired(db)
    return service.proposal_out(db, service.get_proposal(db, student, proposal_id))


@router.post('/profile-update-proposals/{proposal_id}/refresh', response_model=s.DocumentOut)
def refresh(proposal_id: int, db: Session = Depends(get_db), student=Depends(owner)):
    service.configured()
    student_id = student.id; db.rollback(); db.execute(text('BEGIN IMMEDIATE'))
    from app.models import Student
    student = db.get(Student, student_id)
    proposal = service.get_proposal(db, student, proposal_id)
    document = service.get_document(db, student, proposal.document_id); service.active(db, document)
    # Recompare pending facts only. Never resurrect a previously applied/rejected fact.
    pending = [s.DocumentFact(id=f'fact-{i.id}', field=i.field_path, value=i.proposed_value_json,
        evidence=i.evidence_json) for i in service.items(db, proposal) if i.decision == 'pending']
    if proposal.status != 'ready_for_review': service.fail('PROPOSAL_STALE')
    result = service.deterministic(document.text, document.document_type); result.facts = pending
    service.build(db, student, document, result); db.commit()
    return service.document_out(db, document)


@router.patch('/profile-update-proposals/{proposal_id}/items/{item_id}', response_model=s.DocumentDecisionOut)
def decide(proposal_id: int, item_id: int, body: s.DocumentDecisionIn, db: Session = Depends(get_db),
           student=Depends(owner), principal: Principal = Depends(current_principal)):
    return service.decide(db, student.id, principal.account_id, proposal_id, item_id, body)


@router.post('/documents/{document_id}/extract', response_model=s.DocumentOut)
def extract(document_id: int, body: s.DocumentAiIn, db: Session = Depends(get_db), student=Depends(owner)):
    cfg = service.configured()
    if not body.ai_consent: service.fail('AI_CONSENT_REQUIRED', 422)
    document = service.get_document(db, student, document_id); service.active(db, document)
    proposal = db.scalar(select(m.Proposal).where(m.Proposal.document_id == document_id).order_by(m.Proposal.id.desc()))
    if proposal.version != body.version or proposal.status != 'ready_for_review': service.fail('PROPOSAL_STALE')
    # Do not re-extract after any decision; this prevents resurrection of rejected/applied facts.
    if any(i.decision != 'pending' for i in service.items(db, proposal)): service.fail('PROPOSAL_STALE')
    source, kind, student_id, proposal_id = document.text, document.document_type, student.id, proposal.id
    consent_at = service.now()
    db.rollback()  # Never hold a database transaction during a provider call.
    from app.services.gemini_document_extraction import extract as extract_facts
    status, result = extract_facts(db.bind, student_id, source, kind, body.ai_consent, cfg)
    db.execute(text('BEGIN IMMEDIATE'))
    from app.models import Student
    student = db.get(Student, student_id)
    document = service.get_document(db, student, document_id); service.active(db, document)
    proposal = service.get_proposal(db, student, proposal_id)
    if proposal.version != body.version or proposal.status != 'ready_for_review' or document.document_type != kind: service.fail('PROPOSAL_STALE')
    if result is not None:
        # Merge safe deterministic facts and locally verified Gemini candidates; never replace known facts.
        combined = service.deterministic(source, kind)
        combined.facts = (combined.facts + result.facts)[:100]
        combined.suggestions = result.suggestions
        service.build(db, student, document, combined, 'gemini', status, consent_at)
    else:
        db.add(m.Extraction(document_id=document.id, engine='gemini', model=cfg.gemini_model,
            status=status, result_json=None, ai_consent_at=consent_at, expires_at=document.expires_at))
    db.commit()
    out = service.document_out(db, document); out.extraction_status = status
    return out
