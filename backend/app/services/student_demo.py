"""Read-only student fixtures, separate from saved profiles and provider results."""
from collections import Counter

from app.schemas import StudentDemoOut, StudentDemoSection


def load_demo(section: StudentDemoSection) -> StudentDemoOut:
    skills = {'Python': 4, 'SQL': 3, 'Machine Learning': 2, 'Docker': None}
    jobs = [
        {'title': 'Demo Data Analyst', 'company': 'Example Analytics',
         'location': 'Bengaluru', 'skills': ['Python', 'SQL']},
        {'title': 'Demo ML Intern', 'company': 'Example Research',
         'location': 'Remote', 'skills': ['Python', 'Machine Learning']},
        {'title': 'Demo Backend Developer', 'company': 'Example Software',
         'location': 'Hyderabad', 'skills': ['Python', 'SQL', 'Docker']},
    ]
    if section == 'journey':
        title = 'Career plan demo'
        metrics = [('Skills', len(skills)), ('Known proficiency', sum(v is not None for v in skills.values())),
                   ('Unknown proficiency', sum(v is None for v in skills.values()))]
        records = [('Alex Morgan · fictional student', {'Program': 'B.Tech / Computer Science',
                    'Target role': 'Data Analyst', 'Project evidence': 'Synthetic sales-data analysis using Python and SQL'})]
        records += [(name, {'Recorded level': 'Unknown' if level is None else f'{level}/5'})
                    for name, level in skills.items()]
    elif section == 'resume':
        original = ('Alex Morgan — fictional student\nB.Tech, Computer Science\n'
                    'Skills: Python, SQL\nProject: Used Python and SQL to clean a synthetic sales dataset '
                    'and summarize monthly revenue trends.\nEducation: Example Institute, 2027.')
        target = 'Data Analyst: clean datasets, query SQL tables, and explain findings with Python.'
        title = 'Resume demo'
        metrics = [('Sample resumes', 1), ('Skills mentioned', 2), ('Original characters', len(original))]
        records = [('demo_fixture_resume.txt', {'Original resume': original}),
                   ('Target role', {'Title': 'Data Analyst', 'Requirements': target}),
                   ('Revision example', {'Before': 'Worked on sales data.',
                    'After': 'Used Python and SQL to clean a synthetic sales dataset and summarize monthly revenue trends.',
                    'Source': 'Curated demo wording; Gemini has not been called.'})]
    elif section == 'linkedin':
        sections = {'Headline': 'Computer Science student | Python & SQL | Data analysis projects',
                    'About': 'I build college data projects using Python and SQL and document what I learn.',
                    'Projects': 'Analyzed a synthetic sales dataset and presented monthly revenue trends.',
                    'Education': 'Example Institute · B.Tech Computer Science · 2027'}
        title = 'LinkedIn profile demo'
        metrics = [('Profile sections', len(sections)), ('Skills mentioned', 2), ('Project examples', 1)]
        records = [(name, {'Sample content': text}) for name, text in sections.items()]
    elif section == 'jobs':
        title = 'Opportunity demo'
        metrics = [('Fictional openings', len(jobs)), ('Companies', len({job['company'] for job in jobs})),
                   ('Skills mentioned', len({skill for job in jobs for skill in job['skills']}))]
        records = [(job['title'], {'Company': job['company'], 'Location': job['location'],
                    'Requirements': ', '.join(job['skills']), 'Status': 'Fictional opening · not available for application'}) for job in jobs]
    elif section == 'market':
        counts = Counter(skill for job in jobs for skill in job['skills'])
        title = 'Skill-demand demo'
        metrics = [('Sample openings', len(jobs)), ('Observed skills', len(counts)),
                   ('Skill mentions', sum(counts.values()))]
        records = [(skill, {'Openings mentioning skill': f'{count}/{len(jobs)}',
                    'Share of demo sample': f'{round(count / len(jobs) * 100)}%'})
                   for skill, count in counts.most_common()]
    else:
        applications = [('Demo Analytics Drive', 'Applied'), ('Demo Software Drive', 'Interview scheduled')]
        training = [('SQL joins practice', 'Completed'), ('Python data-cleaning project', 'In progress')]
        title = 'Placement hub demo'
        metrics = [('Applications', len(applications)), ('Interviews', sum(status == 'Interview scheduled' for _, status in applications)),
                   ('Training completed', f'{sum(status == "Completed" for _, status in training)}/{len(training)}')]
        records = [(name, {'Application status': status}) for name, status in applications]
        records += [(name, {'Training status': status}) for name, status in training]
        records += [('Resume review', {'Status': 'Changes requested',
                    'Sample faculty feedback': 'Clarify the dataset and your contribution to the project.'})]
    return StudentDemoOut(section=section, title=title,
        metrics=[{'label': label, 'value': value} for label, value in metrics],
        records=[{'title': title, 'fields': fields} for title, fields in records])
