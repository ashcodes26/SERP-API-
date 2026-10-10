"""Source-grounded career coaching from profile text, without invented credentials."""
import re
from collections import defaultdict

from app.services.intelligence import known_skill_terms
from app.services.resume_statistics import ACTION, MEASURE

SECTIONS = {'about': 'About', 'about me': 'About', 'summary': 'About', 'professional summary': 'About', 'headline': 'Headline', 'skills': 'Skills',
            'technical skills': 'Skills', 'experience': 'Experience', 'work experience': 'Experience',
            'professional experience': 'Experience', 'projects': 'Projects', 'featured projects': 'Projects', 'selected projects': 'Projects', 'education': 'Education',
            'certifications': 'Certifications', 'licenses & certifications': 'Certifications',
            'volunteering': 'Volunteering'}
EXTRA_TERMS = {
    'excel': 'Excel', 'power bi': 'Power BI', 'tableau': 'Tableau', 'statistics': 'Statistics',
    'numpy': 'NumPy', 'scikit-learn': 'Scikit-learn', 'sklearn': 'Scikit-learn',
    'tensorflow': 'TensorFlow', 'pytorch': 'PyTorch', 'deep learning': 'Deep Learning',
    'nlp': 'NLP', 'natural language processing': 'NLP', 'data visualization': 'Data Visualization',
    'react': 'React', 'react.js': 'React', 'reactjs': 'React', 'typescript': 'TypeScript',
    'node.js': 'Node.js', 'nodejs': 'Node.js', 'html': 'HTML', 'css': 'CSS',
    'fastapi': 'FastAPI', 'django': 'Django', 'rest api': 'REST APIs', 'rest apis': 'REST APIs',
    'mongodb': 'MongoDB', 'java': 'Java', 'kubernetes': 'Kubernetes', 'terraform': 'Terraform',
    'linux': 'Linux', 'ci/cd': 'CI/CD', 'azure': 'Azure', 'gcp': 'GCP',
}
# Curated coaching templates, not live labour-market measurements.
ROLES = {
    'Data Analyst': ['SQL', 'Excel', 'Python', 'Data Visualization', 'Statistics'],
    'Machine Learning Engineer': ['Python', 'Machine Learning', 'Scikit-learn', 'Statistics', 'Docker'],
    'Full Stack Developer': ['JavaScript', 'TypeScript', 'React', 'Node.js', 'SQL'],
    'Backend Developer': ['Python', 'SQL', 'REST APIs', 'Git', 'Docker'],
    'Cloud / DevOps Engineer': ['Linux', 'AWS', 'Docker', 'Kubernetes', 'CI/CD'],
}
NEGATED = re.compile(r'\b(?:no experience|not proficient|do not know|don.t know|want to learn|need to learn|learning goal|plan to|did not|never)\b', re.I)
LINK = re.compile(r'https?://[^\s<>]+', re.I)
CONTRIBUTION = re.compile(ACTION.pattern + r'|\b(wrote|modeled|modelled|trained|tested|evaluated|deployed|integrated)\b', re.I)


def parse_profile(text):
    grouped = defaultdict(list)
    current = 'Uncategorized'
    for raw in text.splitlines():
        line = raw.strip()
        if not line or re.match(r'^(?:Source:|Profile URL:|Retrieved:)', line, re.I):
            continue
        # Accept exported/Markdown headings, preserving ordinary numbered content.
        candidate = line.strip('*_').strip()
        candidate = re.sub(r'^\s*(?:(?:#{1,6}|\d+[.)]|[-\u2022])\s+)+', '', candidate).strip().strip('*_').strip()
        prefix, separator, rest = candidate.partition(':')
        key = candidate.rstrip(':').strip().casefold()
        if key in SECTIONS:
            current = SECTIONS[key]
        elif separator and prefix.casefold() in SECTIONS:
            current = SECTIONS[prefix.casefold()]
            if rest.strip(): grouped[current].append(rest.strip())
        else:
            grouped[current].append(line)
    return dict(grouped)


def skills_in(line):
    # A negative/hypothetical sentence cannot establish possession of any skill.
    if NEGATED.search(line): return []
    clean = LINK.sub('', line)  # URLs and source metadata are not skill evidence.
    terms = {key: value[0] for key, value in known_skill_terms().items()} | EXTRA_TERMS
    return sorted({name for term, name in terms.items() if re.search(r'(?<!\w)' + re.escape(term) + r'(?!\w)', clean, re.I)})


def analyze_profile(text, method=None, confirmed=False, target_role=None, job_description=''):
    grouped = parse_profile(text)
    lines = [(section, line) for section, values in grouped.items() for line in values]
    partial = method == 'public_search_reviewed'
    by_skill = defaultdict(list)
    actions, outcomes = set(), set()
    for section, line in lines:
        context = section in {'Projects', 'Experience', 'Volunteering'}
        applied = context and bool(CONTRIBUTION.search(line)) and not NEGATED.search(line)
        measured = applied and bool(MEASURE.search(line))
        if applied: actions.add(line.casefold())
        if measured: outcomes.add(line.casefold())
        for skill in skills_in(line):
            item = {'section': section, 'excerpt': line[:600], 'kind': 'quantified_example' if measured else 'applied_example' if applied else 'project_context' if context else 'mention'}
            if not any(x['excerpt'] == item['excerpt'] for x in by_skill[skill]): by_skill[skill].append(item)
    evidence = [{'name': name, 'level': None, 'evidence_strength': 'quantified_example' if any(x['kind'] == 'quantified_example' for x in items) else 'applied_example' if any(x['kind'] == 'applied_example' for x in items) else 'project_context' if any(x['kind'] == 'project_context' for x in items) else 'mention_only', 'excerpts': items[:3]} for name, items in sorted(by_skill.items())]
    present = [name for name in ('Headline', 'About', 'Experience', 'Projects', 'Skills', 'Education') if grouped.get(name)]
    missing = [name for name in ('Headline', 'About', 'Experience', 'Projects', 'Skills', 'Education') if name not in present]
    applied_names = [x['name'] for x in evidence if x['evidence_strength'] != 'mention_only']
    mentions = [x['name'] for x in evidence if x['evidence_strength'] == 'mention_only']
    enough = len(' '.join(line for _, line in lines)) >= 30
    quality = None if not enough or partial else round(len(present) / 6 * 60 + bool(actions) * 20 + bool(outcomes) * 20)

    def role_result(title, expected, source):
        matched = [s for s in expected if s in by_skill]
        supported = [s for s in matched if s in applied_names]
        return {'title': title, 'source': source, 'keyword_coverage': round(len(matched) / len(expected) * 100, 1) if expected and enough else None,
                'expected_skills': expected, 'matched_skills': matched, 'evidence_backed_skills': supported,
                'not_detected_skills': [s for s in expected if s not in matched]}

    roles = sorted([role_result(title, expected, 'curated_role_template') for title, expected in ROLES.items()], key=lambda x: (-(x['keyword_coverage'] or 0), -len(x['evidence_backed_skills']), x['title']))
    target_skills = sorted({skill for line in job_description.splitlines() for skill in skills_in(line)})
    target = role_result(target_role or 'Your target role', target_skills, 'user_provided_job_description') if job_description.strip() else role_result(target_role, ROLES[target_role], 'curated_role_template') if target_role in ROLES else None
    improvements = []

    def improve(priority, title, reason, action, excerpt=None):
        improvements.append({'priority': priority, 'title': title, 'reason': reason, 'action': action, 'excerpt': excerpt})

    if not enough:
        improve('high', 'Provide career details', 'A URL or member name is not enough to assess career evidence.', 'Paste your About, Skills, Projects and Experience sections or upload your own export, then save.')
    if target:
        if target['not_detected_skills']:
            names = ', '.join(target['not_detected_skills'])
            improve('high', 'Close target-role evidence gaps', f'{names} are not detected in the supplied text.', f'If you have used {names}, add an accurate project example. Otherwise choose one relevant learning project; do not add unsupported skills.')
        if not target['expected_skills']:
            improve('high', 'Use a more specific target description', 'No supported skill requirements were recognized.', 'Include concrete tools and skills in the job description to enable comparison.')
    for name in missing:
        improve('medium', f'Clarify your {name} section', f'{name} is not detected in this {"partial search preview" if partial else "saved text"}.', f'Add a clearly labeled {name} section if applicable. Its absence here does not prove it is missing on LinkedIn.')
    for name in mentions[:4]:
        improve('high' if target and name in target['matched_skills'] else 'medium', f'Show how you used {name}', 'A keyword mention has no recognized action example.', f'For {name}, describe the task, your contribution, the deliverable and a real outcome.', by_skill[name][0]['excerpt'])
    if actions and not outcomes:
        improve('medium', 'Make your impact concrete', f'{len(actions)} action statements were recognized without measurable outcomes.', 'Where accurate, add scale or a before/after result to an existing example. Keep figures you can substantiate.', next(line for section, line in lines if section in {'Projects', 'Experience', 'Volunteering'} and CONTRIBUTION.search(line) and not NEGATED.search(line))[:600])
    suggestions = []
    for section, line in lines:
        if section not in {'Projects', 'Experience'} or NEGATED.search(line): continue
        revised = re.sub(r'^(\s*[-*\u2022]?\s*)Worked on\b', r'\1Contributed to', line, flags=re.I)
        if revised != line:
            suggestions.append({'original': line[:1000], 'suggested': revised[:1000], 'reason': 'Clarifies the contribution without introducing new responsibilities, metrics or skills.'})
        if len(suggestions) >= 3: break
    summary = 'Insufficient career text to draw useful conclusions.' if not enough else f'The supplied text mentions {len(evidence)} supported skills. {len(applied_names)} have project or contribution context, and {len(outcomes)} distinct statements describe measurable impact.'
    if target and target['keyword_coverage'] is not None:
        summary += f' For {target["title"]}, {len(target["matched_skills"])}/{len(target["expected_skills"])} template or description skills appear; {len(target["evidence_backed_skills"])} have project or contribution context.'
    headline = ' | '.join(applied_names[:3] or list(by_skill)[:3]) or None
    return {'engine': 'evidence-coach-v1', 'source': method or 'no_profile_text', 'confirmed': confirmed,
            'data_scope': 'partial_public_search' if partial else 'supplied_profile_text', 'summary': summary,
            'profile_quality_score': quality, 'quality_rubric': '60 points for nonempty Headline, About, Experience, Projects, Skills and Education sections (10 each), 20 for a recognized contribution example, 20 for measurable impact. Score withheld for partial search snippets or insufficient text. This measures supplied text, not the live LinkedIn profile.',
            'present_sections': present, 'missing_sections': missing, 'action_statement_count': len(actions), 'quantified_statement_count': len(outcomes),
            'skills': evidence, 'role_matches': roles if enough and by_skill else [], 'target': target,
            'improvements': sorted(improvements, key=lambda x: {'high': 0, 'medium': 1, 'low': 2}[x['priority']])[:12],
            'headline_suggestion': headline, 'wording_suggestions': suggestions,
            'limitations': ['Rule-based contextual analysis; no language model is called. Skill evidence is self-reported or reviewed, not assessed proficiency.', 'Role matches use curated coaching templates or your pasted description; coverage is not a hiring probability.', 'Search excerpts may omit career history. Only supplied text is analyzed; missing mentions do not establish missing skills.']}
