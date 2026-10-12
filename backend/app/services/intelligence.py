"""Deterministic role alignment v1. Unknown proficiency is not zero."""
import re
import json
from pathlib import Path
from dataclasses import dataclass
from app.enums import Priority, RequirementType
from app.schemas import Competency, JobOut, ReadinessOut, SkillGapOut, SkillOut

FORMULA_VERSION = 'role-alignment-v1'
_ALIASES = {alias.casefold(): (item['name'], item['category'])
            for item in json.loads(Path(__file__).with_name('skills_taxonomy.json').read_text(encoding='utf-8'))
            for alias in [item['name'], *item['aliases']]}

def normalize_skill(value: str) -> tuple[str, str | None]:
    key = re.sub(r'\s+', ' ', value.strip()).casefold()
    if not key:
        raise ValueError('Skill name cannot be empty')
    return _ALIASES.get(key, (value.strip(), None))


def known_skill_terms() -> dict[str, tuple[str, str | None]]:
    """Shared dictionary for conservative listing/resume keyword extraction."""
    return dict(_ALIASES)

@dataclass(frozen=True)
class ScoredRole:
    readiness: ReadinessOut
    strengths: list[Competency]
    gaps: list[SkillGapOut]
    warnings: list[str]


def score_role(job: JobOut, competencies: list[Competency]) -> ScoredRole:
    by_id = {c.skill.id: c for c in competencies}
    earned = 0.0
    total = 0.0
    covered = 0.0
    confidence_total = 0.0
    strengths: list[Competency] = []
    gaps: list[SkillGapOut] = []
    warnings: list[str] = []
    if not job.skills:
        raise ValueError('Role must have at least one skill requirement')
    for req in job.skills:
        weight = req.importance * (1.0 if req.requirement_type == RequirementType.required else 0.5)
        if weight == 0:
            continue
        total += weight
        current = by_id.get(req.skill.id)
        level = current.level if current else None
        evidence = list(current.evidence_ids) if current else []
        expected = req.expected_level
        if level is not None and expected is not None:
            covered += weight if evidence else 0.0
            confidence_total += weight * current.confidence if evidence else 0.0
            earned += weight * (min(level / expected, 1.0) if expected > 0 else 1.0)
            gap = max(0, expected - level)
            if gap == 0:
                strengths.append(current)
                continue
            severity = (gap / expected) if expected else 0
            risk = severity * weight
            priority = Priority.high if risk >= 0.45 else (Priority.medium if risk >= 0.2 else Priority.low)
            rationale = f'{req.requirement_type.value.title()} role skill; current {level}/5 vs expected {expected}/5; importance {req.importance:.2f}.'
        else:
            gap = None
            priority = Priority.high if req.requirement_type == RequirementType.required and req.importance >= 0.7 else Priority.medium
            rationale = 'Insufficient proficiency information; assess this role requirement before calculating its gap.'
            warnings.append(f'{req.skill.canonical_name}: current or required proficiency unknown')
        gaps.append(SkillGapOut(skill=req.skill, current_level=level, required_level=expected,
                                gap=gap, priority=priority, rationale=rationale, evidence_ids=evidence))
    if total == 0:
        raise ValueError('Role requirements must have positive total importance')
    gaps.sort(key=lambda g: ({Priority.high: 0, Priority.medium: 1, Priority.low: 2}[g.priority], -(g.gap or 0), g.skill.canonical_name))
    alignment = round(earned / total, 4)
    coverage = round(covered / total, 4)
    confidence = round(confidence_total / total, 4)
    drivers = [f'{g.skill.canonical_name}: {g.rationale}' for g in gaps[:3]]
    return ScoredRole(ReadinessOut(alignment=alignment, evidence_coverage=coverage,
                                  confidence=confidence, formula_version=FORMULA_VERSION, drivers=drivers,
                                  measurable=any(r.expected_level is not None and r.importance > 0 for r in job.skills),
                                  label=('Readiness indicator (informational)' if any(r.expected_level is not None and r.importance > 0 for r in job.skills)
                                         else 'Alignment unavailable: required proficiency unknown')),
                      strengths, gaps, warnings)
