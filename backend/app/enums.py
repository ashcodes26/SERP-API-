from enum import Enum


class SourceType(str, Enum):
    institutional_record = "institutional_record"
    resume = "resume"
    project = "project"
    certification = "certification"
    self_report = "self_report"
    github = "github"
    linkedin = "linkedin"
    assessment = "assessment"
    demo = "demo"


class RequirementType(str, Enum):
    required = "required"
    preferred = "preferred"


class Priority(str, Enum):
    high = "high"
    medium = "medium"
    low = "low"


class ResourceProvenance(str, Enum):
    """Where a learning resource came from. Fixtures must never pose as live results."""

    serpapi_live = "serpapi_live"
    curated_fallback = "curated_fallback"
    demo_fixture = "demo_fixture"


class RoadmapStatus(str, Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    done = "done"


class SwotCategory(str, Enum):
    strength = "strength"
    weakness = "weakness"
    opportunity = "opportunity"
    threat = "threat"


class ImportStatus(str, Enum):
    uploaded = "uploaded"
    previewed = "previewed"
    validated = "validated"
    completed = "completed"
    completed_with_errors = "completed_with_errors"
    failed = "failed"
