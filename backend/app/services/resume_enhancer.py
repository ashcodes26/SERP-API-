"""Factual text analysis, source-aware suggestions and genuine document export."""
from collections import defaultdict
from io import BytesIO
import re
import zipfile
from xml.sax.saxutils import escape

from app import models
from app.schemas import SourceClaimOut
from app.services.job_discovery import extract_requirements
from app.services.serpapi import SearchFailure

HEADINGS = {'education', 'experience', 'internships', 'projects', 'certifications', 'achievements', 'skills', 'soft skills', 'summary', 'professional summary', 'about', 'contact', 'work experience', 'professional experience', 'technical skills'}
SECTION_ALIASES = {'about me': 'about', 'licenses & certifications': 'certifications',
                   'licenses and certifications': 'certifications', 'selected projects': 'projects',
                   'featured projects': 'projects', 'employment history': 'experience',
                   'professional skills': 'skills', 'awards': 'achievements', 'honors': 'achievements'}


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
        candidate = re.sub(r'^#{1,6}\s+', '', line).strip('*_').strip()
        heading = candidate.rstrip(':').casefold()
        heading = SECTION_ALIASES.get(heading, heading)
        # Also support compact headings such as "Projects: Built a Python tool".
        prefix, separator, rest = candidate.partition(':')
        prefix = SECTION_ALIASES.get(prefix.casefold(), prefix.casefold())
        if heading in HEADINGS:
            current = heading
        elif separator and prefix in HEADINGS:
            current = prefix
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
            # URLs, filenames and provenance metadata are not possession evidence.
            clean_line = re.sub(r'https?://[^\s<>]+', '', line)
            for skill in extract_requirements(clean_line, allow_ambiguous_aliases=section in {'skills', 'technical skills', 'soft skills'}):
                # Negated and hypothetical mentions do not establish possession.
                if re.search(r'\b(no experience|not proficient|do not know|don.t know|want to learn|need to learn|learning goal|plan to|never|did not)\b', line, re.I):
                    continue
                kind = 'project_or_experience' if section in {'projects', 'experience', 'internships', 'work experience', 'professional experience'} else 'self_report'
                item = SourceClaimOut(source=source, kind=kind, excerpt=line[:600], confirmed=confirmed, claimed_level=skill.expected_level)
                if skill.name not in observed or kind == 'project_or_experience':
                    observed[skill.name] = item
    return observed


def approved_revision(workspace: models.ResumeWorkspace) -> str:
    if not workspace.analysis or workspace.analysis.get('engine') != 'gemini':
        raise SearchFailure('ANALYSIS_REQUIRED', 'Analyze a target job before applying suggestions', 422)
    result = workspace.original_text
    replacements = []
    for item in workspace.analysis['suggestions']:
        decision = workspace.decisions.get(item['id'], {})
        if decision.get('decision') != 'accepted':
            continue
        if item.get('source') != 'gemini' or item['kind'] != 'replace':
            raise SearchFailure('INVALID_EDIT', 'Only validated Gemini rewrites can be applied. Reanalyze this resume.', 422)
        if item['kind'] == 'replace':
            start = workspace.original_text.find(item['original'])
            end = start + len(item['original'])
            if not item['original'] or start < 0 or any(start < b and end > a for a, b, _ in replacements):
                raise SearchFailure('INVALID_EDIT', 'Accepted edits overlap or no longer match the original. Reanalyze and review.', 422)
            if item.get('source') == 'gemini':
                from app.services.gemini_resume import validated_rewrite
                if not validated_rewrite(item, workspace.original_text):
                    raise SearchFailure('INVALID_EDIT', 'AI edit failed factual validation. Reanalyze and review.', 422)
            replacements.append((start, end, item['proposed']))
    for start, end, proposed in sorted(replacements, reverse=True):
        result = result[:start] + proposed + result[end:]
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
