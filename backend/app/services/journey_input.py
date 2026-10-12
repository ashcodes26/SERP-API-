"""Single-owner spreadsheet input: preview first, unknown skill levels remain unknown."""
import hashlib
import re
import zipfile
from io import BytesIO

from pydantic import ValidationError
from sqlalchemy import select
from app import models, schemas
from app.services.analysis import get_profile
from app.services.imports import parse_upload, detect_mapping
from app.services.intelligence import normalize_skill

DETAIL_FIELDS = {'name', 'department', 'program', 'specialization', 'semester', 'cgpa', 'graduation_year'}


def digest(db, student):
    return hashlib.sha256(get_profile(db, student).model_dump_json().encode()).hexdigest()


def parse(filename, content):
    if filename.lower().endswith('.xlsx'):
        try:
            with zipfile.ZipFile(BytesIO(content)) as archive:
                if len(archive.infolist()) > 200 or sum(item.file_size for item in archive.infolist()) > 20 * 1024 * 1024:
                    raise ValueError('Excel workbook is too large when expanded')
        except zipfile.BadZipFile:
            raise ValueError('Cannot parse file as XLSX') from None
    headers, rows = parse_upload(filename, content)
    if len(rows) != 1:
        raise ValueError('Use exactly one student row; Excel reads the first worksheet')
    mapping = {header: detect_mapping([header]).get(header) for header in headers}
    data, ignored, used = {}, [], set()
    for header in headers:
        key = re.sub(r'[\s_-]+', ' ', header.strip().lower())
        target = {'skill': 'skills', 'skills': 'skills', 'summary': 'summary', 'profile summary': 'summary'}.get(key, mapping.get(header))
        if target not in DETAIL_FIELDS | {'skills', 'summary'}:
            ignored.append(header)
            continue
        if target in used:
            raise ValueError('Multiple columns map to the same profile field')
        used.add(target)
        value = rows[0][header]
        if value:
            data[target] = [s.strip() for s in re.split(r'[,;|]', value) if s.strip()] if target == 'skills' else value
    if not data:
        raise ValueError('No profile details found; use the provided template columns')
    try:
        result = schemas.JourneyDetails.model_validate(data)
    except ValidationError as exc:
        first = exc.errors()[0]
        raise ValueError(f"{first['loc'][0]}: {first['msg']}") from None
    return result, ignored


def save(db, student, details):
    for field in DETAIL_FIELDS:
        value = getattr(details, field)
        if value is not None:
            setattr(student, field, value)
    if details.skills or details.summary:
        normalized = list(dict.fromkeys(normalize_skill(name)[0] for name in details.skills))
        summary = ('Skills: ' + ', '.join(normalized) + '\n' if normalized else '') + details.summary
        ref = 'journey-spreadsheet:' + hashlib.sha256(summary.encode()).hexdigest()
        evidence = db.scalar(select(models.Evidence).where(models.Evidence.student_pk == student.id, models.Evidence.source_ref == ref))
        if evidence is None:
            evidence = models.Evidence(student_pk=student.id, source_type='self_report', source_ref=ref, extracted_summary=summary, extraction_confidence=None)
            db.add(evidence); db.flush()
        for name in normalized:
            skill = db.scalar(select(models.Skill).where(models.Skill.canonical_name == name))
            if skill is None:
                skill = models.Skill(canonical_name=name, category=normalize_skill(name)[1]); db.add(skill); db.flush()
            competency = db.scalar(select(models.StudentSkill).where(models.StudentSkill.student_pk == student.id, models.StudentSkill.skill_id == skill.id))
            if competency is None:
                db.add(models.StudentSkill(student_pk=student.id, skill_id=skill.id, level=None, confidence=0, evidence_ids=[evidence.id]))
            elif evidence.id not in (competency.evidence_ids or []):
                competency.evidence_ids = [*(competency.evidence_ids or []), evidence.id]
    db.commit()
    return get_profile(db, student)
