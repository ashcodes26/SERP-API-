"""Retrieved job observations integrated with the existing competency engine."""
import hashlib
import json
import re
from collections import Counter
from datetime import UTC, datetime
from urllib.parse import parse_qs, urlparse

from sqlalchemy import delete, select
from sqlalchemy.orm import Session
from pydantic import HttpUrl, TypeAdapter, ValidationError

from app import models
from app.config import Settings
from app.schemas import (JobListingOut, JobMatchOut, JobSearchIn, JobSearchOut,
                         MarketSkillOut, MarketSkillsOut, ObservedRequirement,
                         ResumeAdviceOut)
from app.services.analysis import analyze, get_profile
from app.services.intelligence import known_skill_terms
from app.services.serpapi import SearchFailure, request_search


def now() -> datetime:
    return datetime.now(UTC)


def utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value


def digest(value: object) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def clean(value: object, limit: int = 20000) -> str:
    if not isinstance(value, str):
        return ""
    value = re.sub(r"<[^>]*>", " ", value)
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", value).strip()[:limit]


def source_url(value: object) -> str | None:
    if not isinstance(value, str) or len(value) > 2000:
        return None
    try:
        parsed = urlparse(value)
        if parsed.scheme not in {"https", "http"} or not parsed.hostname or parsed.username or parsed.password:
            return None
        if parsed.hostname == 'serpapi.com' or any(k.casefold() in {'api_key', 'access_token', 'token'} for k in parse_qs(parsed.query)):
            return None
        return str(TypeAdapter(HttpUrl).validate_python(value))
    except (ValueError, ValidationError):
        return None


def extract_requirements(description: str) -> list[ObservedRequirement]:
    """Dictionary matches only; qualifiers and levels must occur in source text."""
    findings: dict[str, ObservedRequirement] = {}
    section = 'mentioned'
    for line in re.split(r'[\n;]', description):
        line = clean(line, 2000)
        if not line:
            continue
        if re.match(r'^(preferred|nice.to.have|desirable)', line, re.I):
            section = 'preferred'
        elif re.match(r'^(requirements?|qualifications?|required|minimum qualifications)', line, re.I):
            section = 'required'
        elif re.match(r'^(responsibilities|benefits|about|what you.ll do)', line, re.I):
            section = 'mentioned'
        kind = section
        if re.search(r'\b(preferred|nice.to.have|bonus|desirable)\b', line, re.I):
            kind = 'preferred'
        elif re.search(r'\b(required|must|requires)\b', line, re.I):
            kind = 'required'
        if re.search(r'\b(not required|no experience (?:with|in)|we (?:will )?teach)\b', line, re.I):
            kind = 'mentioned'
        for term, (name, _) in known_skill_terms().items():
            if term in {'py', 'js', 'ml'}:  # ambiguous prose abbreviations
                continue
            if not re.search(r'(?<!\w)' + re.escape(term) + r'(?!\w)', line, re.I):
                continue
            level = re.search(re.escape(term) + r'\s*(?:proficiency\s*|level\s*|\()?([0-5])\s*/\s*5', line, re.I)
            item = ObservedRequirement(name=name, requirement_type=kind,
                                       expected_level=int(level[1]) if level else None, excerpt=line[:600])
            previous = findings.get(name)
            rank = {'required': 0, 'preferred': 1, 'mentioned': 2}
            if previous is None or rank[kind] < rank[previous.requirement_type]:
                findings[name] = item
    return sorted(findings.values(), key=lambda s: s.name)


def normalize(raw: object, retrieved: datetime, settings: Settings) -> list[dict]:
    if not isinstance(raw, list):
        raise SearchFailure('UPSTREAM_MALFORMED', 'Search provider returned an invalid jobs list')
    results, seen = [], set()
    for item in raw[:100]:
        if not isinstance(item, dict) or not clean(item.get('title'), 200):
            continue
        description = clean(item.get('description'))
        highlights = item.get('job_highlights')
        if isinstance(highlights, list):
            for block in highlights[:12]:
                if isinstance(block, dict) and isinstance(block.get('items'), list):
                    description += '\n' + clean(block.get('title'), 100) + ':\n' + '\n'.join(clean(v, 2000) for v in block['items'][:30])
        description = description[:20000]
        links = item.get('apply_options', [])
        url = next((source_url(o.get('link')) for o in links[:20] if isinstance(o, dict) and source_url(o.get('link'))), None) if isinstance(links, list) else None
        url = url or source_url(item.get('share_link'))
        title, company = clean(item['title'], 200), clean(item.get('company_name'), 200) or None
        identity = item.get('job_id') if isinstance(item.get('job_id'), str) else (url, title, company, clean(item.get('location'), 200))
        # Content versions preserve earlier analyses if an upstream description changes.
        key = digest((identity, description))
        if key in seen:
            continue
        seen.add(key)
        extension = item.get('detected_extensions')
        extension = extension if isinstance(extension, dict) else {}
        skills = extract_requirements(description)
        listing = dict(stable_identity=digest(identity), title=title, company=company, location=clean(item.get('location'), 200) or None,
                       employment_type=clean(extension.get('schedule_type'), 100) or None,
                       experience_level=None, description=description, source_url=url,
                       source_domain=urlparse(url).hostname if url else None,
                       retrieved_at=retrieved, provenance='serpapi_live', skills=skills,
                       missing_fields=[], warnings=['Opening status has not been verified.'])
        listing['missing_fields'] = [field for field in ('company', 'location', 'employment_type', 'experience_level', 'description', 'source_url') if not listing[field]]
        if not any(s.requirement_type != 'mentioned' for s in skills):
            listing['warnings'].append('No explicit dictionary-supported skill requirements found; matching is unavailable.')
        if any(s.expected_level is None and s.requirement_type != 'mentioned' for s in skills):
            listing['warnings'].append('The listing omits proficiency levels; numerical proficiency alignment may be unavailable.')
        # Provider-controlled strings cannot echo our server credential.
        secret = settings.serpapi_api_key.get_secret_value() if settings.serpapi_configured else ''
        if secret:
            listing = json.loads(json.dumps(listing, default=lambda v: v.model_dump() if hasattr(v, 'model_dump') else v.isoformat()).replace(secret, '[redacted]'))
        results.append({'key': key, 'listing': listing})
        if len(results) >= min(10, settings.serpapi_max_results):
            break
    if raw and not results:
        raise SearchFailure('UPSTREAM_MALFORMED', 'Search provider returned no usable job records')
    return results


def persist(db: Session, records: list[dict]) -> list[JobListingOut]:
    result = []
    for record in records:
        meta = db.scalar(select(models.DiscoveredJob).where(models.DiscoveredJob.provider_key == record['key']))
        listing = record['listing']
        if meta is None:
            job = models.Job(title=listing['title'], company=listing['company'], description=listing['description'])
            db.add(job)
            db.flush()
            # Mention-only terms stay metadata; they do not become invented requirements.
            for observed in listing['skills']:
                observed = ObservedRequirement.model_validate(observed)
                if observed.requirement_type == 'mentioned':
                    continue
                skill = db.scalar(select(models.Skill).where(models.Skill.canonical_name == observed.name))
                if skill is None:
                    category = next((category for name, category in known_skill_terms().values() if name == observed.name), None)
                    skill = models.Skill(canonical_name=observed.name, category=category, aliases=[])
                    db.add(skill)
                    db.flush()
                db.add(models.JobSkill(job_id=job.id, skill_id=skill.id, requirement_type=observed.requirement_type,
                                       importance=0.8 if observed.requirement_type == 'required' else 0.5,
                                       expected_level=observed.expected_level))
            meta = models.DiscoveredJob(job_id=job.id, provider_key=record['key'], listing={})
            db.add(meta)
        out = JobListingOut(id=meta.job_id, **listing)
        meta.listing = out.model_dump(mode='json')
        result.append(out)
    db.flush()
    return result


async def search_jobs(db: Session, request: JobSearchIn, settings: Settings, transport=None) -> JobSearchOut:
    request = request.model_copy(update={key: getattr(request, key).strip() for key in ('role', 'location', 'keywords')})
    if not request.role:
        raise SearchFailure('INVALID_QUERY', 'Enter a target role', 422)
    scope_key = digest({key: getattr(request, key) for key in ('role', 'location', 'keywords', 'level')})
    if request.page == 1 and request.next_page_token:
        raise SearchFailure('INVALID_PAGE', 'A first-page search cannot include a pagination token', 422)
    if request.page > 1:
        prior = db.scalar(select(models.JobSearchCache).where(models.JobSearchCache.scope_key == scope_key,
                          models.JobSearchCache.page == request.page - 1).order_by(models.JobSearchCache.retrieved_at.desc()))
        if not request.next_page_token or not prior or prior.response.get('next_page_token') != request.next_page_token:
            raise SearchFailure('INVALID_PAGE', 'Use the next-page token from this search', 422)
        if (now() - utc(prior.retrieved_at)).total_seconds() > settings.job_cache_stale_seconds:
            raise SearchFailure('INVALID_PAGE', 'Pagination expired; restart the search', 422)
    cache_id = digest(request.model_dump())
    cached = db.get(models.JobSearchCache, cache_id)
    age = (now() - utc(cached.retrieved_at)).total_seconds() if cached else None
    if age is not None and age <= settings.job_cache_ttl_seconds:
        out = JobSearchOut.model_validate(cached.response)
        return out.model_copy(update={'cache_status': 'fresh_cache'})
    suffix = {'any': '', 'entry_level': 'entry level', 'internship': 'internship'}[request.level]
    query = ' '.join(v for v in (request.role, request.keywords, suffix) if v)
    params = {'engine': 'google_jobs', 'q': query, 'hl': 'en'}
    if request.location:
        params['location'] = request.location
    if request.next_page_token:
        params['next_page_token'] = request.next_page_token
    try:
        payload = await request_search(params, settings, transport)
        if 'jobs_results' not in payload:
            raise SearchFailure('UPSTREAM_MALFORMED', 'Search provider omitted its jobs result list')
        timestamp = now()
        jobs = persist(db, normalize(payload['jobs_results'], timestamp, settings))
    except SearchFailure as exc:
        if cached and age is not None and age <= settings.job_cache_stale_seconds:
            out = JobSearchOut.model_validate(cached.response)
            return out.model_copy(update={'cache_status': 'stale_cache', 'warnings': [*out.warnings,
                 'Live search unavailable; showing an older retrieved sample. Retry after the cache expires.']})
        raise exc from None
    pagination = payload.get('serpapi_pagination')
    token = pagination.get('next_page_token') if isinstance(pagination, dict) else None
    if not isinstance(token, str) or len(token) > 2048 or request.page == 3:
        token = None
    if token and settings.serpapi_configured and settings.serpapi_api_key.get_secret_value() in token:
        token = None
    out = JobSearchOut(search_id=cache_id, scope=request, query=query, jobs=jobs, retrieved_at=timestamp,
                       provenance='serpapi_live', cache_status='live', next_page_token=token,
                       warnings=['Retrieved search sample; not verified current openings.'] + ([] if jobs else ['No listings found.']))
    if cached is None:
        cached = models.JobSearchCache(id=cache_id, scope_key=scope_key, page=request.page, response={})
        db.add(cached)
    cached.response, cached.retrieved_at = out.model_dump(mode='json'), timestamp
    db.flush()
    # Bound cache growth without deleting jobs, analyses, or roadmap progress.
    oldest = db.scalars(select(models.JobSearchCache.id).order_by(models.JobSearchCache.retrieved_at.desc()).offset(199)).all()
    if oldest:
        db.execute(delete(models.JobSearchCache).where(models.JobSearchCache.id.in_(oldest)))
    db.commit()
    return out


def get_listing(db: Session, job_id: int) -> JobListingOut | None:
    meta = db.get(models.DiscoveredJob, job_id)
    return JobListingOut.model_validate(meta.listing) if meta else None


def match_job(db: Session, student: models.Student, listing: JobListingOut) -> JobMatchOut:
    profile = get_profile(db, student)
    requirements = [s for s in listing.skills if s.requirement_type != 'mentioned']
    if not requirements:
        raise SearchFailure('INSUFFICIENT_JOB_EVIDENCE', 'This listing has no explicit supported skill requirements. Choose another listing.', 422)
    analysis = analyze(db, student, db.get(models.Job, listing.id))
    evidence = {c.skill.canonical_name: c for c in profile.competencies}
    supported = [s.name for s in requirements if s.name in evidence and evidence[s.name].evidence_ids and evidence[s.name].level is not None]
    unknown = [s.name for s in requirements if s.name not in supported]
    explanations = [f'Evidence recorded for {name}; compare it with the original listing.' for name in supported]
    explanations += [f'{name}: current proficiency or supporting evidence is unknown.' for name in unknown]
    if not analysis.readiness.measurable:
        explanations.append('No required proficiency levels were supplied. The stored zero measurable contribution is not zero ability; numerical alignment is unavailable.')
    return JobMatchOut(listing=listing, analysis=analysis, evidenced_skills=supported, unknown_skills=unknown,
                       explanation=explanations + listing.warnings)


def market_skills(db: Session, search_id: str) -> MarketSkillsOut | None:
    cache = db.get(models.JobSearchCache, search_id)
    if cache is None:
        return None
    sample = JobSearchOut.model_validate(cache.response)
    counts, required, preferred = Counter(), Counter(), Counter()
    for job in sample.jobs:
        for skill in job.skills:  # normalized once per unique listing
            counts[skill.name] += 1
            required[skill.name] += skill.requirement_type == 'required'
            preferred[skill.name] += skill.requirement_type == 'preferred'
    size = len(sample.jobs)
    return MarketSkillsOut(search_id=search_id, scope=sample.scope, sample_size=size, retrieved_at=sample.retrieved_at,
         provenance=sample.provenance, skills=[MarketSkillOut(name=name, count=count,
         required_count=required[name], preferred_count=preferred[name], share=round(count / size, 4))
         for name, count in counts.most_common()], warnings=['This is one retrieved search page, not a market-wide survey.',
         'Keyword extraction uses a limited dictionary; omitted skills are not evidence of no demand.'])


def resume_advice(db: Session, student: models.Student, listing: JobListingOut, text: str) -> ResumeAdviceOut:
    competencies = get_profile(db, student).competencies
    evidenced = {c.skill.canonical_name for c in competencies if c.evidence_ids and c.level is not None and c.level > 0}
    resume_skills = {s.name for s in extract_requirements(text)}
    relevant = {s.name for s in listing.skills if s.requirement_type != 'mentioned'}
    supported = sorted(relevant & evidenced - resume_skills)
    unsupported = sorted(relevant - evidenced)
    suggestions = [f'If accurate, make your documented {skill} experience visible in the resume.' for skill in supported]
    suggestions += [f'{skill} is relevant, but your profile does not substantiate it. Build evidence before adding a claim.' for skill in unsupported]
    for heading in ('education', 'projects', 'experience', 'skills'):
        if not re.search(r'\b' + heading + r'\b', text, re.I):
            suggestions.append(f'Review whether a {heading} section would help explain your actual evidence.')
    if not re.search(r'\b\d+(?:\.\d+)?\s*(?:%|users|hours|records|seconds|projects)\b', text, re.I):
        suggestions.append('Where you have measured outcomes, describe the result and your contribution. Do not invent numbers.')
    suggestions.append('For each relevant project, explain what you built, the tools you used, and a result you can substantiate.')
    return ResumeAdviceOut(supported_keywords=supported, unsubstantiated_keywords=unsupported, suggestions=suggestions,
         limitations=['Text-only feedback; formatting, document parsing, and proprietary ATS compatibility are not evaluated.',
                      'Resume text is processed for this request and is not stored or sent to SerpApi.'])
