"""Bounded retention for staged import records and row-level issues."""
from datetime import UTC, datetime, timedelta
from sqlalchemy import delete, select
from sqlalchemy.orm import Session
from app.models import ImportJob, ImportRowIssue, ImportStagedRow


def purge_expired_imports(db: Session, retention_hours: int) -> int:
    if not 1 <= retention_hours <= 168:
        raise ValueError('Import retention must be between 1 and 168 hours')
    cutoff = datetime.now(UTC) - timedelta(hours=retention_hours)
    # SQLite may return naive datetimes; compare using naive UTC consistently.
    expired = db.scalars(select(ImportJob.id).where(ImportJob.created_at < cutoff.replace(tzinfo=None))).all()
    if expired:
        db.execute(delete(ImportRowIssue).where(ImportRowIssue.import_job_id.in_(expired)))
        db.execute(delete(ImportStagedRow).where(ImportStagedRow.import_job_id.in_(expired)))
        db.execute(delete(ImportJob).where(ImportJob.id.in_(expired)))
        db.commit()
    return len(expired)
