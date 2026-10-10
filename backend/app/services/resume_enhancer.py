"""Factual text analysis, source-aware suggestions and genuine document export."""
from collections import defaultdict
from io import BytesIO
import re
import zipfile
from xml.sax.saxutils import escape

from app import models
from app.schemas import (ResumeAnalysisOut, ResumeSuggestionOut, SourceClaimOut, UnifiedSkillOut)
from app.services.analysis import get_profile
from app.services.job_discovery import extract_requirements, digest
from app.services.intelligence import normalize_skill
from app.services.serpapi import SearchFailure

HEADINGS = {'education', 'experience', 'projects', 'certifications', 'skills', 'summary', 'contact', 'work experience', 'professional experience', 'technical skills'}


def validate_text(text: str) -> str:
    try:
        text.encode('utf-8')
    except UnicodeError:
        raise SearchFailure('INVALID_RESUME_TEXT', 'Use valid Unicode text', 422) from None
    if not 30 <= len(text.strip()) <= 20000 or any((ord(c) < 32 and c not in '\n\r\t') or ord(c) in {0xfffe, 0xffff} for c in text):
        raise SearchFailure('INVALID_RESUME_TEXT', 'Use 30–20,000 readable text characters', 422)
    return text.strip()


def sections(text: str) -> dict[str, list[str]]:
    result = defaultdict(list)
    current = 'contact'
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        heading = line.rstrip(':').casefold()
        # Also support compact headings such as "Projects: Built a Python tool".
        prefix, separator, rest = line.partition(':')
        if heading in HEADINGS:
            current = heading
        elif separator and prefix.casefold() in HEADINGS:
            current = prefix.casefold()
            if rest.strip():
                result[current].append(rest.strip())
        else:
            result[current].append(line)
        result.setdefault(current, [])
    return dict(result)


def claims(text: str, source: str, confirmed: bool = False) -> dict[str, SourceClaimOut]:
    observed = {}
    grouped = sections(text)
    for section, lines in grouped.items():
        for line in lines:
            if source == 'linkedin_public_search_reviewed' and re.match(r'^(?:Source:|Profile URL:|Retrieved:)', line):
                continue  # Provenance metadata is not a skill claim.
            for skill in extract_requirements(line):
                # Negated and hypothetical mentions do not establish possession.
                if re.search(r'\b(no experience|not proficient|do not know|don.t know|want to learn|need to learn|learning goal)\b', line, re.I):
                    continue
                kind = 'project_or_experience' if section in {'projects', 'experience', 'work experience', 'professional experience'} else 'self_report'
                item = SourceClaimOut(source=source, kind=kind, excerpt=line[:600], confirmed=confirmed, claimed_level=skill.expected_level)
                if skill.name not in observed or kind == 'project_or_experience':
                    observed[skill.name] = item
    return observed


def analyze_resume(db, student: models.Student, original: str, title: str, description: str,
                   source: str, url: str | None = None) -> ResumeAnalysisOut:
    profile = get_profile(db, student)
    linked = db.get(models.LinkedInProfile, student.id)
    resume = claims(original, 'resume')
    linked_source = 'linkedin_public_search_reviewed' if linked and linked.import_method == 'public_search_reviewed' else 'linkedin_self_provided'
    linkedin = claims(linked.profile_text, linked_source, linked.confirmed) if linked else {}
    competencies = {normalize_skill(c.skill.canonical_name)[0]: c for c in profile.competencies}
    evidence = {e.id: e for e in profile.evidence}
    names = sorted(set(resume) | set(linkedin) | set(competencies))
    unified = []
    for name in names:
        inputs = [data[name] for data in (resume, linkedin) if name in data]
        current = competencies.get(name)
        assessed = False
        level = None
        if current:
            level = current.level if current.evidence_ids else None
            for eid in current.evidence_ids:
                if eid in evidence:
                    ev = evidence[eid]
                    assessed |= ev.source_type.value == 'assessment'
                    inputs.append(SourceClaimOut(source='skillup_profile', kind='assessed_profile' if ev.source_type.value == 'assessment' else 'profile_evidence',
                        excerpt=ev.extracted_summary[:600], confirmed=True, claimed_level=current.level))
        # Identical excerpts per source count once, and repeated project content is
        # not presented as independent corroboration merely because it was copied.
        unique = {(c.source, c.excerpt.casefold()): c for c in inputs}
        supplied_levels = {c.claimed_level for c in unique.values() if c.claimed_level is not None}
        conflict = len(supplied_levels) > 1 or (level == 0 and (name in resume or name in linkedin))
        unified.append(UnifiedSkillOut(name=name, sources=list(unique.values()), profile_level=level,
            proficiency_assessed=assessed, conflict=conflict,
            requires_confirmation=conflict or not any(c.confirmed for c in unique.values())))
    requirements = extract_requirements(description)
    relevant = [r for r in requirements if r.requirement_type != 'mentioned']
    required = [r.name for r in relevant if r.requirement_type == 'required']
    keywords = {r.name for r in relevant}
    matched = sorted(keywords & resume.keys())
    undetected = sorted(keywords - resume.keys())
    stronger = sorted(name for name in matched if resume[name].kind == 'self_report')
    parsed = sections(original)
    context = {name for name in keywords & resume.keys() if resume[name].kind == 'project_or_experience'}
    required_coverage = sum(name in resume for name in required) / len(required) * 100 if required else None
    keyword_coverage = len(matched) / len(keywords) * 100 if keywords else None
    context_coverage = len(context) / len(keywords) * 100 if keywords else None
    recognized = sum(any(key in parsed for key in alternatives) for alternatives in
        [('education',), ('skills', 'technical skills'), ('experience', 'work experience', 'professional experience'), ('projects',)]) / 4 * 100
    score = round(required_coverage * .5 + keyword_coverage * .2 + context_coverage * .2 + recognized * .1, 2) if required_coverage is not None else None
    feedback = []
    for section in ('education', 'skills', 'projects'):
        if section not in parsed and not (section == 'skills' and 'technical skills' in parsed):
            feedback.append(f'No clear {section} heading was detected. Review whether it belongs in your actual resume.')
    if any(len(line) > 240 for line in original.splitlines()):
        feedback.append('Some lines exceed 240 characters; consider shorter bullets that preserve the facts.')
    if re.search(r'\b(hard.?working|team player|results.?driven)\b', original, re.I):
        feedback.append('Generic descriptions need a concrete example you can substantiate.')
    if not re.search(r'\b\d+(?:\.\d+)?\s*(%|users|hours|records|seconds)\b', original, re.I):
        feedback.append('No recognized measured outcome was detected. Supply an actual metric if you have one; do not invent it.')
    date_styles = set()
    if re.search(r'\b\d{4}-\d{2}\b', original):
        date_styles.add('year-month')
    if re.search(r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\b', original, re.I):
        date_styles.add('month-year')
    if len(date_styles) > 1:
        feedback.append('Mixed date styles detected; check dates and use a consistent style without changing the facts.')
    suggestions = []
    def suggest(kind, before, after, reason, skill=None, confirmation=False):
        suggestions.append(ResumeSuggestionOut(id=digest((kind, before, after, skill))[:20], kind=kind,
            original=before, proposed=after, reason=reason, skill=skill, requires_confirmation=confirmation))
    for line in original.splitlines():
        if re.search(r'\bWorked on\b', line):
            revised = re.sub(r'\bWorked on\b', 'Contributed to', line, count=1)
            suggest('replace', line, revised, 'Make the existing contribution clearer while retaining the supplied facts.')
        if line.strip().rstrip(':').casefold() in HEADINGS and line.strip().isupper():
            suggest('replace', line, line.strip().title(), 'Use consistent readable section headings.')
    for name in undetected:
        supported = next((s for s in unified if s.name == name), None)
        if supported:
            suggest('append', '', name, f'{name} is relevant to the job and appears in another source. Confirm an actual example before adding it.', name, True)
        else:
            suggest('review', '', '', f'{name} was not detected. Assess or build evidence; do not add it merely for a keyword score.', name)
    for name in stronger:
        suggest('review', '', '', f'{name} is mentioned without a recognized project/experience context. Explain an actual use and outcome.', name)
    for item in unified:
        if item.conflict:
            suggest('review', '', '', f'{item.name} has conflicting claims or proficiency across sources. Review and correct your supplied data.', item.name)
    warnings = ['This is an explicit text-check estimate, not an official ATS score or a hiring probability.',
        'Not detected does not mean you lack a skill. Keyword mentions and endorsements do not prove proficiency.',
        'The parser reads text only; columns, visual layout, ATS-specific rules, and employment authenticity are not verified.',
        'Experience durations are not inferred from incomplete dates. All resume/profile facts remain self-supplied unless assessed.',
        'No LLM is used; suggestions are deterministic and retain factual boundaries.']
    if linked and linked.import_method == 'public_search_reviewed':
        warnings.append('LinkedIn public search excerpts are partial and may be outdated. Student review does not establish externally verified proficiency.')
    if score is None:
        warnings.append('Insufficient explicit required-skill information: numerical resume alignment is unavailable.')
    career = []
    by_name = {s.name: s for s in unified}
    for r in relevant:
        skill = by_name.get(r.name)
        demonstrated = skill and any(c.kind in {'project_or_experience', 'profile_evidence', 'assessed_profile'} for c in skill.sources)
        if skill and skill.conflict:
            career.append(f'{r.name}: resolve source conflicts before changing your proficiency or roadmap.')
        elif demonstrated and not (r.expected_level is not None and (skill.profile_level is None or skill.profile_level < r.expected_level)):
            career.append(f'{r.name}: highlight existing evidence; an introductory course is not automatically recommended.')
        else:
            career.append(f'{r.name}: assess proficiency and build a small practical project that demonstrates this role requirement. Record the result before claiming mastery.')
    return ResumeAnalysisOut(target_title=title, target_source=source, source_url=url, requirements=requirements,
        resume_skills=sorted(resume), matching_skills=matched, not_detected_skills=undetected,
        stronger_evidence_skills=stronger, unified_skills=unified, sections=parsed,
        profile_sections=sections(linked.profile_text) if linked and linked.profile_text else {},
        relevant_excerpts=list(dict.fromkeys(resume[name].excerpt for name in sorted(context))), structure_feedback=feedback,
        score=score, score_components={'required_keyword_coverage':required_coverage, 'requirement_keyword_coverage':keyword_coverage,
            'project_experience_context_coverage':context_coverage, 'recognized_section_coverage':recognized},
        suggestions=suggestions[:30], career_recommendations=career, warnings=warnings)


def approved_revision(workspace: models.ResumeWorkspace) -> str:
    if not workspace.analysis:
        raise SearchFailure('ANALYSIS_REQUIRED', 'Analyze a target job before applying suggestions', 422)
    result = workspace.original_text
    appended = []
    for item in workspace.analysis['suggestions']:
        decision = workspace.decisions.get(item['id'], {})
        if decision.get('decision') != 'accepted':
            continue
        if item['kind'] == 'replace':
            result = result.replace(item['original'], item['proposed'], 1)
        elif item['kind'] == 'append':
            appended.append(decision['confirmation'].strip())
    if appended:
        result += '\n\nAdditional relevant evidence\n' + '\n'.join(dict.fromkeys(appended))
    return validate_text(result)


def export_document(text: str, format: str) -> bytes:
    text = validate_text(text)
    if format == 'txt':
        return text.encode('utf-8')
    # Minimal standards-based DOCX, with readable headings, literal supplied bullets,
    # escaped XML text, no templates/macros/external relationships, and no metadata.
    paragraphs = []
    for line in text.splitlines():
        heading = line.strip().rstrip(':').casefold() in HEADINGS or line.strip() == 'Additional relevant evidence'
        props = '<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>' if heading else '<w:pPr><w:spacing w:after="100"/></w:pPr>'
        paragraphs.append(f'<w:p>{props}<w:r><w:t xml:space="preserve">{escape(line)}</w:t></w:r></w:p>')
    document = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + ''.join(paragraphs) + '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/></w:sectPr></w:body></w:document>'
    content = BytesIO()
    with zipfile.ZipFile(content, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>')
        archive.writestr('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
        archive.writestr('word/_rels/document.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>')
        archive.writestr('word/styles.xml','<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="180" w:after="100"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style></w:styles>')
        archive.writestr('word/document.xml', document)
    return content.getvalue()
