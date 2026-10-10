"""Explainable text-only indicators; never a hiring or commercial ATS score."""
import re

CORE_SECTIONS = {
    'Education': ('education',),
    'Skills': ('skills', 'technical skills'),
    'Experience': ('experience', 'work experience', 'professional experience'),
    'Projects': ('projects',),
}
ACTION = re.compile(r'\b(built|created|developed|implemented|analyzed|analysed|designed|led|improved|reduced|automated|delivered|managed|optimized|optimised|contributed|worked)\b', re.I)
MEASURE = re.compile(r'\b\d[\d,]*(?:\.\d+)?\s*(?:%|percent\b|users\b|records\b|customers\b|hours\b|minutes\b|seconds\b|reports\b|projects\b|students\b|requests\b|transactions\b|dollars\b)', re.I)
RUBRIC = '60 points for nonempty Education, Skills, Experience and Projects sections (15 each); 20 for at least one action statement; 20 for at least one action statement with a numeric outcome or scale. A limited text heuristic, not an official ATS score. Layout and factual accuracy are not assessed.'


def text_statistics(text: str) -> dict:
    # Import at call time to keep the shared response schemas independent.
    from app.services.resume_enhancer import sections, claims

    grouped = sections(text)
    present = [name for name, aliases in CORE_SECTIONS.items() if any(grouped.get(key) for key in aliases)]
    evidence_lines = [line for key in ('projects', 'experience', 'work experience', 'professional experience') for line in grouped.get(key, [])]
    actions = [line for line in evidence_lines if ACTION.search(line) and not re.search(r'\b(?:want to|plan to|did not|never|no experience)\b', line, re.I)]
    quantified = sum(bool(MEASURE.search(line)) for line in actions)
    skills = sorted(claims('\n'.join(f'{key}: ' + '\n'.join(lines) for key, lines in grouped.items() if key != 'contact'), 'resume'))
    feedback = [f'Add a clearly labeled {name} section if it applies to your background.' for name in CORE_SECTIONS if name not in present]
    if not actions:
        feedback.append('Describe your actual contributions in Projects or Experience using clear action statements.')
    if not quantified:
        feedback.append('Where accurate, include a measured result or scale in Projects or Experience; never invent numbers.')
    return {
        'strength_score': len(present) * 15 + bool(actions) * 20 + bool(quantified) * 20,
        'section_coverage': len(present) * 25,
        'present_sections': present,
        'missing_sections': [name for name in CORE_SECTIONS if name not in present],
        'word_count': len(re.findall(r'\b[\w]+(?:[\x27-][\w]+)*\b', text)),
        'character_count': len(text),
        'bullet_count': sum(bool(re.match(r'^\s*(?:[-*\u2022\u25cf]|\d+[.)])\s+\S', line)) for line in text.splitlines()),
        'action_statement_count': len(actions),
        'quantified_statement_count': quantified,
        'detected_skills': skills,
        'feedback': feedback,
        'rubric_version': 'resume-text-strength-v1',
        'rubric': RUBRIC,
    }
