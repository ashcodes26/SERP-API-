"""Additive private review persistence. Content expires; audit contains commitments only."""
from datetime import datetime

from sqlalchemy import JSON, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models import _now


class Document(Base):
    __tablename__ = 'document_intelligence_documents'
    id: Mapped[int] = mapped_column(primary_key=True)
    student_pk: Mapped[int] = mapped_column(ForeignKey('students.id', ondelete='CASCADE'), index=True)
    duplicate_fingerprint: Mapped[str | None] = mapped_column(String(64), index=True)
    filename: Mapped[str | None] = mapped_column(String(200))
    mime_type: Mapped[str | None] = mapped_column(String(150))
    byte_size: Mapped[int]
    document_type: Mapped[str] = mapped_column(String(32))
    classification_status: Mapped[str] = mapped_column(String(24))
    text: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(24), default='active')
    storage_consent_at: Mapped[datetime] = mapped_column(default=_now)
    expires_at: Mapped[datetime] = mapped_column(index=True)
    created_at: Mapped[datetime] = mapped_column(default=_now)


class Extraction(Base):
    __tablename__ = 'document_extractions'
    id: Mapped[int] = mapped_column(primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey('document_intelligence_documents.id', ondelete='CASCADE'), index=True)
    engine: Mapped[str] = mapped_column(String(24))
    model: Mapped[str | None] = mapped_column(String(120))
    schema_version: Mapped[str] = mapped_column(String(40), default='document-extraction-v1')
    status: Mapped[str] = mapped_column(String(24))
    result_json: Mapped[dict | None] = mapped_column(JSON)
    ai_consent_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(default=_now)
    expires_at: Mapped[datetime]


class Proposal(Base):
    __tablename__ = 'profile_update_proposals'
    id: Mapped[int] = mapped_column(primary_key=True)
    student_pk: Mapped[int] = mapped_column(ForeignKey('students.id', ondelete='CASCADE'), index=True)
    document_id: Mapped[int] = mapped_column(ForeignKey('document_intelligence_documents.id', ondelete='CASCADE'), index=True)
    extraction_id: Mapped[int] = mapped_column(ForeignKey('document_extractions.id'))
    status: Mapped[str] = mapped_column(String(24), default='ready_for_review')
    profile_fingerprint: Mapped[str | None] = mapped_column(String(64))
    version: Mapped[int] = mapped_column(default=1)
    created_at: Mapped[datetime] = mapped_column(default=_now)


class ProposalItem(Base):
    __tablename__ = 'profile_update_proposal_items'
    id: Mapped[int] = mapped_column(primary_key=True)
    proposal_id: Mapped[int] = mapped_column(ForeignKey('profile_update_proposals.id', ondelete='CASCADE'), index=True)
    field_path: Mapped[str] = mapped_column(String(80))
    operation: Mapped[str] = mapped_column(String(24))
    current_value_json: Mapped[dict | None] = mapped_column(JSON)
    proposed_value_json: Mapped[dict | None] = mapped_column(JSON)
    evidence_json: Mapped[list | None] = mapped_column(JSON)
    fact_kind: Mapped[str] = mapped_column(String(24), default='explicit')
    comparison_status: Mapped[str] = mapped_column(String(24))
    decision: Mapped[str] = mapped_column(String(24), default='pending')
    applied_at: Mapped[datetime | None]
    applied_value_json: Mapped[dict | None] = mapped_column(JSON)
    version: Mapped[int] = mapped_column(default=1)


class Audit(Base):
    __tablename__ = 'profile_update_audit'
    __table_args__ = (UniqueConstraint('actor_account_id', 'idempotency_key'),)
    id: Mapped[int] = mapped_column(primary_key=True)
    student_pk: Mapped[int] = mapped_column(ForeignKey('students.id', ondelete='CASCADE'), index=True)
    proposal_item_id: Mapped[int | None] = mapped_column(ForeignKey('profile_update_proposal_items.id'))
    actor_account_id: Mapped[int] = mapped_column(ForeignKey('accounts.id'))
    action: Mapped[str] = mapped_column(String(24))
    provenance_id: Mapped[str] = mapped_column(String(36))
    before_commitment: Mapped[str] = mapped_column(String(64))
    after_commitment: Mapped[str] = mapped_column(String(64))
    evidence_commitment: Mapped[str] = mapped_column(String(64))
    request_commitment: Mapped[str] = mapped_column(String(64))
    schema_version: Mapped[str] = mapped_column(String(40), default='document-policy-v1')
    idempotency_key: Mapped[str] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(default=_now)


class AiWindow(Base):
    __tablename__ = 'ai_request_windows'
    key: Mapped[str] = mapped_column(String(120), primary_key=True)
    attempts: Mapped[int] = mapped_column(default=0)
    expires_at: Mapped[datetime] = mapped_column(index=True)


class AiCache(Base):
    __tablename__ = 'ai_safe_cache'
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    student_pk: Mapped[int] = mapped_column(ForeignKey('students.id', ondelete='CASCADE'), index=True)
    task_id: Mapped[str] = mapped_column(String(60))
    # Only validated IDs and server-owned action enums; never arbitrary provider prose.
    result_json: Mapped[dict] = mapped_column(JSON)
    expires_at: Mapped[datetime] = mapped_column(index=True)


class AiDiagnostic(Base):
    __tablename__ = 'ai_diagnostics'
    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[str] = mapped_column(String(60))
    status: Mapped[str] = mapped_column(String(24))
    created_at: Mapped[datetime] = mapped_column(default=_now, index=True)
