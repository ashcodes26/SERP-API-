"""Conservative, source-preserving extraction from existing saved profile text.

Derived on demand: editing source text corrects it, without another database or
silently rewriting a user's approved revision. Contact details are not duplicated.
"""
import re
from datetime import datetime
from urllib.parse import urlsplit

from app.schemas import CandidateExtractionOut, ExtractedFieldOut, ExtractedSkillOut
from app.services.intelligence import normalize_skill
from app.services.resume_enhancer import sections, claims

SECTION_FIELDS = {
    'summary': ('summary', 'professional summary', 'about'),
    'experience': ('experience', 'work experience', 'professional experience'),
    'internships': ('internships',), 'projects': ('projects',),
    'education': ('education',), 'certifications': ('certifications',),
    'achievements': ('achievements',),
}
FIELD_NAMES = ['full_name', *SECTION_FIELDS, 'dates', 'github_urls', 'linkedin_urls', 'portfolio_urls']


def extract_profile(sources: list[tuple[str, str, bool]], analyzed_at: datetime | None = None) -> CandidateExtractionOut:
    fields = {name: [] for name in FIELD_NAMES}
    skills = {}

    def add(field, value, source, excerpt, status='explicit', confidence=.95):
        if not any(x.value.casefold() == value.casefold() and x.source == source for x in fields[field]):
            fields[field].append(ExtractedFieldOut(value=value, source=source, excerpt=excerpt[:600],
                                                   status=status, confidence=confidence))

    for text, source, confirmed in sources:
        if source.startswith('linkedin_public_search'):
            text = '\n'.join(line for line in text.splitlines() if not re.match(r'^(?:Source:|Profile URL:|Retrieved:)', line, re.I))
        parsed = sections(text)
        for field, headings in SECTION_FIELDS.items():
            for heading in headings:
                for line in parsed.get(heading, []):
                    add(field, line, source, line)
        first = next((line.strip() for line in text.splitlines() if line.strip()), '')
        if re.fullmatch(r'(?:full name|name):\s*[^\d\n]{2,100}', first, re.I):
            add('full_name', first.partition(':')[2].strip(), source, first)
        elif re.fullmatch(r'[^\W\d_]+(?:[ .’\'-]+[^\W\d_]+){1,4}', first, re.UNICODE) and first.casefold() not in {
            'technical skills', 'professional summary', 'work experience', 'professional experience', 'soft skills'}:
            add('full_name', first, source, first, 'uncertain', .5)
        for line in text.splitlines():
            # Preserve stated dates. Never infer employers, degree titles or duration.
            for date in re.findall(r'\b(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+)?(?:19|20)\d{2}(?:[-/]\d{2})?\b', line, re.I):
                add('dates', date, source, line)
            for url in re.findall(r'https://[^\s<>]+', line):
                url = url.rstrip('.,;)')
                try:
                    parsed_url = urlsplit(url)
                    if not parsed_url.hostname or parsed_url.username or parsed_url.password:
                        continue
                    host = parsed_url.hostname.casefold()
                    if host == 'github.com':
                        field = 'github_urls'
                    elif host in {'linkedin.com', 'www.linkedin.com'}:
                        field = 'linkedin_urls'
                    elif re.search(r'\b(portfolio|website)\b', line, re.I):
                        field = 'portfolio_urls'
                    else:
                        continue
                    add(field, url, source, line)
                except ValueError:
                    continue
        for name, claim in claims(text, source, confirmed).items():
            canonical, category = normalize_skill(name)
            if canonical not in skills:
                skills[canonical] = ExtractedSkillOut(name=canonical, category=category, sources=[])
            skills[canonical].sources.append(claim)
    names = {x.value.casefold() for x in fields['full_name']}
    conflicts = ['full_name'] if len(names) > 1 else []
    for name, skill in skills.items():
        levels = {c.claimed_level for c in skill.sources if c.claimed_level is not None}
        if len(levels) > 1:
            conflicts.append('skill:' + name)
    return CandidateExtractionOut(fields=fields, skills=sorted(skills.values(), key=lambda x: x.name),
        conflicts=conflicts, missing_fields=[key for key, values in fields.items() if not values],
        analyzed_at=analyzed_at, warnings=[
            'Section entries are supplied text, not independently verified credentials or employment.',
            'A first-line name is uncertain unless explicitly labelled. Confidence describes extraction, not truth.',
            'Experience duration and contact details are not inferred. Unknown proficiency remains null.',
            'Conflicts retain both sources. Correct the saved resume revision or imported profile to resolve them.'])
