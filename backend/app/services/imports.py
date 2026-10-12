"""Bounded, reviewable synthetic CSV/XLSX student imports for hackathon demo only."""
from __future__ import annotations

from datetime import UTC, datetime
from io import BytesIO
import re

import pandas as pd
from sqlalchemy import select, or_
from sqlalchemy.orm import Session

from app.models import Student, ImportJob, ImportRowIssue, ImportStagedRow, FacultyScope, CohortMember, StudentPlacementMeta

FIELDS = {"student_id", "name", "first_name", "last_name", "email", "department", "program", "specialization", "semester", "cgpa", "graduation_year", "batch", "section"}
ALIASES = {
    "reg no": "student_id", "register number": "student_id", "roll number": "student_id", "student id": "student_id",
    "full name": "name", "student name": "name", "first name": "first_name", "last name": "last_name", "surname": "last_name",
    "email id": "email", "mail id": "email", "email address": "email", "branch": "specialization",
    "course": "program", "department": "department", "degree": "program", "graduation year": "graduation_year",
}
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def detect_mapping(headers: list[str]) -> dict[str, str]:
    mapping = {}
    used = set()
    for header in headers:
        normalized = re.sub(r"[\s_\-]+", " ", header.strip().lower())
        target = ALIASES.get(normalized, normalized.replace(" ", "_"))
        if target in FIELDS and target not in used:
            mapping[header] = target
            used.add(target)
    return mapping


def parse_upload(filename: str, content: bytes) -> tuple[list[str], list[dict]]:
    suffix = filename.lower().rsplit(".", 1)[-1]
    if suffix not in {"csv", "xlsx"}:
        raise ValueError("Only .csv and .xlsx files are supported")
    try:
        if suffix == "xlsx":
            frame = pd.read_excel(BytesIO(content), dtype=str, engine="openpyxl", keep_default_na=False)
        else:
            frame = pd.read_csv(BytesIO(content), dtype=str, keep_default_na=False, encoding="utf-8-sig")
    except Exception as exc:
        raise ValueError("Cannot parse file as CSV/XLSX") from exc
    if frame.empty or len(frame) > 5000 or len(frame.columns) > 40:
        raise ValueError("File must have 1–5000 data rows and at most 40 columns")
    headers = [str(column).strip() for column in frame.columns]
    if len(set(headers)) != len(headers):
        raise ValueError("Duplicate column names")
    return headers, [{h: str(value).strip() for h, value in zip(headers, row)} for row in frame.itertuples(index=False, name=None)]


def upload(db: Session, filename: str, content: bytes) -> tuple[ImportJob, list[str]]:
    headers, rows = parse_upload(filename, content)
    job = ImportJob(filename=filename[:300], source_type=filename.rsplit(".", 1)[-1].lower(), total_rows=len(rows), field_mapping=detect_mapping(headers))
    db.add(job)
    db.flush()
    db.add_all(ImportStagedRow(import_job_id=job.id, row_number=i + 2, values=row) for i, row in enumerate(rows))
    db.commit()
    db.refresh(job)
    return job, headers


def _normalize(row: dict, mapping: dict) -> tuple[dict, list[tuple[str, str, str]]]:
    data = {target: str(row.get(source, "")).strip() for source, target in mapping.items() if target in FIELDS}
    issues = []
    if data.get('email'):
        data['email'] = data['email'].casefold()
    if not data.get("name"):
        data["name"] = " ".join(part for part in (data.get("first_name", ""), data.get("last_name", "")) if part)
    for field in ("student_id", "name", "email"):
        if not data.get(field):
            issues.append((field, "REQUIRED", f"{field} is required"))
    if not data.get("department") and not data.get("program"):
        issues.append(("program", "REQUIRED", "Program or department is required"))
    if data.get("email") and not EMAIL_RE.fullmatch(data["email"]):
        issues.append(("email", "INVALID_EMAIL", "Invalid email address"))
    for field, limit in (('student_id', 64), ('name', 200), ('email', 320), ('department', 120), ('program', 120), ('specialization', 120), ('batch', 40), ('section', 40)):
        if len(data.get(field, '')) > limit:
            issues.append((field, 'TOO_LONG', f'{field} exceeds {limit} characters'))
    for field, low, high in (("cgpa", 0, 10), ("semester", 1, 12), ("graduation_year", 2000, 2100)):
        if data.get(field):
            try:
                value = float(data[field]) if field == "cgpa" else int(data[field])
                if not low <= value <= high:
                    raise ValueError()
                data[field] = value
            except (ValueError, TypeError):
                issues.append((field, "INVALID_RANGE", f"{field} must be between {low} and {high}"))
    return data, issues


def preview(db: Session, job: ImportJob, mapping: dict[str, str]) -> dict:
    if job.status in {"completed", "completed_with_errors"}:
        raise ValueError("Completed imports cannot be modified")
    rows = db.scalars(select(ImportStagedRow).where(ImportStagedRow.import_job_id == job.id).order_by(ImportStagedRow.row_number)).all()
    if not rows:
        raise ValueError("Import contains no rows")
    headers = set(rows[0].values)
    if not mapping or any(not isinstance(k, str) or not isinstance(v, str) for k, v in mapping.items()) or len(set(mapping.values())) != len(mapping) or any(k not in headers or v not in FIELDS for k, v in mapping.items()):
        raise ValueError("Field mapping must use existing headers and unique supported fields")
    db.query(ImportRowIssue).filter(ImportRowIssue.import_job_id == job.id).delete(synchronize_session=False)
    existing_ids = {r[0] for r in db.execute(select(Student.student_id))}
    existing_emails = {r[0].lower() for r in db.execute(select(Student.email))}
    seen_ids, seen_emails = set(), set()
    valid = duplicates = errors = 0
    for staged in rows:
        data, problems = _normalize(staged.values, mapping)
        sid = data.get("student_id", "")
        email = data.get("email", "").lower()
        duplicate = bool(sid and (sid in existing_ids or sid in seen_ids) or email and (email in existing_emails or email in seen_emails))
        if duplicate:
            problems.append(("student_id", "DUPLICATE", "Existing or repeated student ID/email"))
        if sid:
            seen_ids.add(sid)
        if email:
            seen_emails.add(email)
        staged.status = "error" if any(p[1] != "DUPLICATE" for p in problems) else "duplicate" if duplicate else "valid"
        valid += staged.status == "valid"
        duplicates += staged.status == "duplicate"
        errors += staged.status == "error"
        for field, code, message in problems:
            db.add(ImportRowIssue(import_job_id=job.id, row_number=staged.row_number, field=field, issue_code=code, severity="error", message=message))
    job.field_mapping = mapping
    job.valid_rows, job.duplicate_rows, job.error_rows = valid, duplicates, errors
    job.status = "validated"
    db.commit()
    return summary(db, job)


def summary(db: Session, job: ImportJob) -> dict:
    return {"job": {"id": job.id, "filename": job.filename, "status": job.status, "source_type": job.source_type,
                    "total_rows": job.total_rows, "valid_rows": job.valid_rows, "duplicate_rows": job.duplicate_rows,
                    "error_rows": job.error_rows, "imported_rows": job.imported_rows, "field_mapping": job.field_mapping},
            "issues": [{"row_number": item.row_number, "field": item.field, "issue_code": item.issue_code,
                        "severity": item.severity, "message": item.message} for item in db.scalars(select(ImportRowIssue).where(ImportRowIssue.import_job_id == job.id).order_by(ImportRowIssue.row_number)).all()]}


def confirm(db: Session, job: ImportJob, update_duplicates: bool = False, *, admin_id=None, cohort=None, allowed_ids=()) -> dict:
    if job.status != "validated":
        raise ValueError("Preview and validate before confirming")
    rows = db.scalars(select(ImportStagedRow).where(ImportStagedRow.import_job_id == job.id).order_by(ImportStagedRow.row_number)).all()
    imported = 0
    for row in rows:
        if row.status == "error" or row.status == "imported":
            continue
        if row.status == "duplicate" and not update_duplicates:
            continue
        data, issues = _normalize(row.values, job.field_mapping)
        if issues:
            continue
        existing = db.scalar(select(Student).where(or_(Student.student_id == data["student_id"], Student.email == data["email"])))
        if existing:
            if not update_duplicates or existing.student_id != data["student_id"] or existing.email.lower() != data["email"].lower() or (existing.id not in allowed_ids if admin_id else not existing.is_synthetic):
                continue
            student = existing
        else:
            student = Student(student_id=data["student_id"], email=data["email"], name=data["name"], is_synthetic=admin_id is None)
            db.add(student)
        for field in ("name", "department", "program", "specialization", "semester", "cgpa", "graduation_year"):
            if field in data and data[field] != "":
                setattr(student, field, data[field])
        if admin_id and cohort:
            if not student.department:
                student.department = cohort.department
            db.flush()
            if not db.get(FacultyScope, (admin_id, student.id)):
                db.add(FacultyScope(admin_id=admin_id, student_pk=student.id))
            if not db.get(CohortMember, (cohort.id, student.id)):
                db.add(CohortMember(cohort_id=cohort.id, student_pk=student.id))
            meta = db.get(StudentPlacementMeta, student.id)
            if not meta:
                meta = StudentPlacementMeta(student_pk=student.id)
                db.add(meta)
            meta.batch, meta.section = cohort.batch, cohort.section
        row.status = "imported"
        imported += 1
    job.imported_rows += imported
    job.status = "completed_with_errors" if job.imported_rows < job.total_rows else "completed"
    job.completed_at = datetime.now(UTC)
    db.commit()
    return summary(db, job)


def retry(db: Session, job: ImportJob) -> dict:
    if job.status not in {"completed", "completed_with_errors"}:
        raise ValueError("Only completed imports can be retried")
    if not db.scalar(select(ImportStagedRow.id).where(ImportStagedRow.import_job_id == job.id, ImportStagedRow.status != "imported")):
        return summary(db, job)
    job.status = "uploaded"
    db.flush()
    return preview(db, job, job.field_mapping)
