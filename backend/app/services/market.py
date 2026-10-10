"""Deterministic analytics over collected search snapshots; never calls SerpApi."""
from collections import Counter
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.schemas import (MarketFilter, MarketDemandOut, DemandSkillOut, JobSearchOut,
                         MarketCompareOut, MarketScopeOut, MarketMeOut, StudentDemandSkillOut,
                         ResourceLink, RoadmapItemOut)
from app.services.analysis import get_profile
from app.services.intelligence import normalize_skill
from app.services.job_discovery import utc
from app.services.learning import CURATED, DEFAULT_RESOURCE
from app.services.serpapi import SearchFailure


def canonical_url(value: str) -> str:
    parsed = urlparse(value)
    # Strip tracking only; meaningful vacancy IDs in query parameters are retained.
    params = sorted((k, v) for k, v in parse_qsl(parsed.query)
                    if not k.casefold().startswith('utm_') and k.casefold() not in {'gclid', 'fbclid'})
    return urlunparse((parsed.scheme.lower(), parsed.netloc.lower(), parsed.path.rstrip('/'), '', urlencode(params), ''))


def snapshots(db: Session):
    # Cache retention is bounded by discovery at 200; do not use unrelated seeded jobs.
    return [JobSearchOut.model_validate(row.response) for row in db.scalars(
        select(models.JobSearchCache).order_by(models.JobSearchCache.retrieved_at.desc())).all()]


def scopes(db: Session) -> MarketScopeOut:
    samples = snapshots(db)
    roles, locations = {}, {}
    for sample in samples:
        roles.setdefault(sample.scope.role.strip().casefold(), sample.scope.role.strip())
        if sample.scope.location.strip():
            locations.setdefault(sample.scope.location.strip().casefold(), sample.scope.location.strip())
    return MarketScopeOut(roles=sorted(roles.values(), key=str.casefold),
        locations=sorted(locations.values(), key=str.casefold), collection_count=len(samples))


def roadmap_demand_context(db: Session, job_id: int) -> MarketDemandOut | None:
    metadata = db.get(models.DiscoveredJob, job_id)
    if metadata is None:
        return None
    identity = metadata.listing.get('stable_identity')
    url = metadata.listing.get('source_url')
    for sample in snapshots(db):
        if any(j.id == job_id or (identity and j.stable_identity == identity)
               or (url and j.source_url and canonical_url(url) == canonical_url(str(j.source_url))) for j in sample.jobs):
            return demand(db, MarketFilter(role=sample.scope.role, location=sample.scope.location))
    return None


def demand(db: Session, filters: MarketFilter) -> MarketDemandOut:
    if filters.collected_after and filters.collected_before and utc(filters.collected_after) > utc(filters.collected_before):
        raise SearchFailure('INVALID_DATE_RANGE', 'Collection start must precede collection end', 422)
    selected = [s for s in snapshots(db)
        if (not filters.role.strip() or s.scope.role.strip().casefold() == filters.role.strip().casefold())
        and (not filters.location.strip() or s.scope.location.strip().casefold() == filters.location.strip().casefold())
        and (not filters.collected_after or utc(s.retrieved_at) >= utc(filters.collected_after))
        and (not filters.collected_before or utc(s.retrieved_at) <= utc(filters.collected_before))]
    # Merge identity groups transitively, using latest content only. This handles both
    # changed descriptions and identical canonical URLs across provider identities.
    groups: dict[int, list] = {}
    aliases: dict[tuple, int] = {}
    serial = 0
    for sample in selected:
        for job in sample.jobs:
            keys = [('provider', job.stable_identity)] if job.stable_identity else []
            if job.source_url:
                keys.append(('url', canonical_url(str(job.source_url))))
            if not keys:
                keys = [('fallback', job.title.casefold(), (job.company or '').casefold(), (job.location or '').casefold())]
            matches = {aliases[k] for k in keys if k in aliases}
            if matches:
                group = min(matches)
                for other in matches - {group}:
                    groups[group].extend(groups.pop(other))
                    for key in aliases:
                        if aliases[key] == other:
                            aliases[key] = group
            else:
                serial += 1
                group = serial
                groups[group] = []
            groups[group].append(job)
            for key in keys:
                aliases[key] = group
    jobs = sorted((max(rows, key=lambda j: (utc(j.retrieved_at), j.id)) for rows in groups.values()), key=lambda j: j.id)
    counts, required, preferred, ids = Counter(), Counter(), Counter(), {}
    for job in jobs:
        # Normalize aliases even for snapshots collected before this enhancement.
        observed = {}
        rank = {'required': 0, 'preferred': 1, 'mentioned': 2}
        for skill in job.skills:
            name, _ = normalize_skill(skill.name)
            if name not in observed or rank[skill.requirement_type] < rank[observed[name]]:
                observed[name] = skill.requirement_type
        for name, kind in observed.items():
            counts[name] += 1
            required[name] += kind == 'required'
            preferred[name] += kind == 'preferred'
            ids.setdefault(name, []).append(job.id)
    size = len(jobs)
    warnings = ['Collected search samples are not representative of the whole job market.',
        'Role and location filters select search scopes, not certified job titles or exact workplace locations.',
        'Dates refer to collection time, not posting time. Only retained search snapshots are analyzed.',
        'A finite alias dictionary detects mentions; absence from this sample does not establish no market demand.',
        'Listing availability and employer legitimacy are not independently verified.']
    if size < 5:
        warnings.append('Fewer than five distinct jobs: insufficient sample for a robust comparison.')
    return MarketDemandOut(filters=filters, sample_size=size, collection_count=len(selected),
        first_collected_at=min((s.retrieved_at for s in selected), default=None),
        last_collected_at=max((s.retrieved_at for s in selected), default=None),
        data_status='empty' if not size else ('insufficient' if size < 5 or not counts else 'available'),
        skills=[DemandSkillOut(name=name, distinct_job_count=counts[name],
            demand_percentage=round(counts[name] / size * 100, 2), required_count=required[name],
            preferred_count=preferred[name], job_ids=ids[name]) for name in sorted(counts, key=lambda n: (-counts[n], n))],
        jobs=jobs, warnings=warnings)


def compare(db: Session, roles: list[str], filters: MarketFilter) -> MarketCompareOut:
    role_names = list(dict.fromkeys(r.strip().casefold() for r in roles if r.strip()))
    if not 2 <= len(role_names) <= 3 or any(len(r) > 120 for r in role_names):
        raise SearchFailure('INVALID_ROLES', 'Select two or three distinct collected roles', 422)
    samples = [demand(db, filters.model_copy(update={'role': role})) for role in role_names]
    names = sorted({s.name for sample in samples for s in sample.skills})
    rows = []
    for name in names:
        row = {'name': name, 'percentages': {}}
        for sample in samples:
            row['percentages'][sample.filters.role] = next((s.demand_percentage for s in sample.skills if s.name == name),
                                           0.0 if sample.sample_size else None)
        rows.append(row)
    return MarketCompareOut(roles=samples, rows=rows)


def personal(db: Session, student: models.Student, filters: MarketFilter) -> MarketMeOut:
    sample = demand(db, filters)
    competencies = {normalize_skill(c.skill.canonical_name)[0]: c for c in get_profile(db, student).competencies}
    result = []
    for skill in sample.skills:
        current = competencies.get(skill.name)
        confirmed = current is not None and current.level is not None and bool(current.evidence_ids)
        status = ('present' if current.level > 0 else 'missing') if confirmed else 'unverified'
        level = current.level if confirmed else None
        targets = [r.expected_level for j in sample.jobs for r in j.skills
                   if normalize_skill(r.name)[0] == skill.name and r.requirement_type != 'mentioned' and r.expected_level is not None]
        expected = max(targets, default=None)
        action = 'assess' if status == 'unverified' else ('learn' if status == 'missing' or (expected is not None and level < expected) else 'maintain')
        relevance = 1 + skill.required_count / skill.distinct_job_count * 0.5
        weight = {'learn': 2, 'assess': 1.5, 'maintain': 0.25}[action]
        score = round((skill.demand_percentage or 0) / 100 * relevance * weight, 4)
        text = f'{skill.distinct_job_count} of {sample.sample_size} distinct jobs mention {skill.name} ({skill.demand_percentage}%). '
        text += {'assess': 'Your proficiency or supporting evidence is unverified; assess it before assuming a gap.',
                 'learn': 'Recorded proficiency is zero or below an explicit observed target; practice and record evidence.',
                 'maintain': 'Your profile records evidence; keep it current. Demand frequency is not required proficiency.'}[action]
        roadmap = db.scalars(select(models.RoadmapItem).join(models.Skill).where(
            models.RoadmapItem.student_pk == student.id, models.Skill.canonical_name == skill.name)
            .order_by(models.RoadmapItem.id.desc()).limit(3)).all()
        if roadmap:
            text += f' Existing roadmap tasks: {sum(t.status == "done" for t in roadmap)} of {len(roadmap)} done; progress is preserved.'
        title, url = CURATED.get(skill.name, DEFAULT_RESOURCE)
        result.append(StudentDemandSkillOut(**skill.model_dump(), status=status, current_level=level,
            competency_percentage=level / 5 * 100 if level is not None else None,
            expected_level=expected, evidence_ids=current.evidence_ids if current else [], action=action,
            priority_score=score, explanation=text, resources=[ResourceLink(title=title, url=url, provenance='curated_fallback')],
            roadmap_items=[RoadmapItemOut.model_validate(t) for t in roadmap]))
    result.sort(key=lambda s: (-s.priority_score, s.name))
    evidenced = sum(s.status == 'present' for s in result)
    return MarketMeOut(student_id=student.id, market=sample, skills=result, evidenced_skill_count=evidenced,
        observed_skill_count=len(result), coverage_percentage=round(evidenced / len(result) * 100, 2) if result else None)
