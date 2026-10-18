"""Single-owner PDF/DOCX input: preview first, unknown skill levels remain unknown."""
import hashlib
import re

from pydantic import ValidationError
from sqlalchemy import select
from app import models, schemas
from app.services.analysis import get_profile
from app.services.intelligence import normalize_skill
from app.services.resume_enhancer import claims
from app.services.resume_files import DOCX_MIME, parse_resume

DETAIL_FIELDS = {'name', 'department', 'program', 'specialization', 'semester', 'cgpa', 'graduation_year'}


def digest(db, student):
    return hashlib.sha256(get_profile(db, student).model_dump_json().encode()).hexdigest()


def parse(filename, content, content_type=None):
    suffix = filename.lower().rsplit('.', 1)[-1] if '.' in filename else ''
    if suffix not in {'pdf', 'docx'}:
        raise ValueError('Choose a PDF or DOCX file')
    # Browsers and native pickers can assign a generic or legacy MIME label to a
    # correctly named file. The parser still validates the PDF signature or DOCX
    # archive/XML, so use the validated extension to select the expected format.
    text = parse_resume(content, filename, 'application/pdf' if suffix == 'pdf' else DOCX_MIME)
    data = {'skills': list(claims(text, 'journey_document', True)), 'summary': text[:2000]}
    first = next((line.strip() for line in text.splitlines() if line.strip()), '')
    named = re.fullmatch(r'(?:full name|name):\s*([^\d\n]{2,100})', first, re.I)
    if named:
        data['name'] = named.group(1).strip()
    elif re.fullmatch(r'[^\W\d_]+(?:[ .\u2019\'-]+[^\W\d_]+){1,4}', first, re.UNICODE):
        data['name'] = first
    if not data:
        raise ValueError('No profile details found in this document')
    try:
        result = schemas.JourneyDetails.model_validate(data)
    except ValidationError as exc:
        first = exc.errors()[0]
        raise ValueError(f"{first['loc'][0]}: {first['msg']}") from None
    return result, []


def save(db, student, details):
    for field in DETAIL_FIELDS:
        value = getattr(details, field)
        if value is not None:
            setattr(student, field, value)
    if details.skills or details.summary:
        normalized = list(dict.fromkeys(normalize_skill(name)[0] for name in details.skills))
        summary = ('Skills: ' + ', '.join(normalized) + '\n' if normalized else '') + details.summary
        ref = 'journey-document:' + hashlib.sha256(summary.encode()).hexdigest()
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
