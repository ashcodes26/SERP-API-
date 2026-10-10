from app.auth import Principal, current_principal
from app.main import app
from app.services.linkedin_insights import analyze_profile
from test_workspace import workspace, create  # noqa: F401

PROFILE = 'Headline: Student developer\nAbout: I enjoy solving data problems.\nSkills: SQL, Python, Excel, React\nProjects\nWorked on a Python tool to clean 100 records.\nBuilt SQL reports for 200 users.\nExperience: Intern, 2023-2024\nEducation: BSc Computer Science'


def test_contextual_evidence_role_priorities_and_grounded_wording():
    result = analyze_profile(PROFILE, 'pasted_summary', True, 'Data Analyst')
    assert result == analyze_profile(PROFILE, 'pasted_summary', True, 'Data Analyst')
    assert result['profile_quality_score'] == 100
    evidence = {skill['name']: skill for skill in result['skills']}
    assert evidence['SQL']['evidence_strength'] == 'quantified_example'
    assert evidence['React']['evidence_strength'] == 'mention_only'
    assert all(skill['level'] is None for skill in result['skills'])
    assert result['action_statement_count'] == result['quantified_statement_count'] == 2
    assert result['target']['keyword_coverage'] == 60
    assert result['target']['evidence_backed_skills'] == ['SQL', 'Python']
    assert result['target']['not_detected_skills'] == ['Data Visualization', 'Statistics']
    assert result['improvements'][0]['priority'] == 'high'
    assert result['wording_suggestions'][0]['suggested'] == 'Contributed to a Python tool to clean 100 records.'
    assert 'developer' not in result['headline_suggestion'].lower()  # No invented professional title.


def test_partial_search_metadata_duplicates_dates_and_negation():
    text = 'Source: https://linkedin.com/in/python-docker\nProfile URL: https://linkedin.com/in/react\nRetrieved: 2026-10-10\nSkills: Want to learn AWS\nProjects\nBuilt a SQL tool in 2024.\nBuilt a SQL tool in 2024.\nAbout: No experience with Python.'
    result = analyze_profile(text, 'public_search_reviewed', True)
    assert result['profile_quality_score'] is None
    assert result['data_scope'] == 'partial_public_search'
    assert [skill['name'] for skill in result['skills']] == ['SQL']
    assert result['action_statement_count'] == 1
    assert result['quantified_statement_count'] == 0
    assert len(result['skills'][0]['excerpts']) == 1
    assert result['skills'][0]['level'] is None


def test_sparse_and_specific_description_change_the_target():
    assert analyze_profile('Ashwin Ganesh', 'pasted_summary')['profile_quality_score'] is None
    assert not analyze_profile('Ashwin Ganesh', 'pasted_summary')['role_matches']
    web = analyze_profile(PROFILE, target_role='Full Stack Developer')
    assert web['target']['keyword_coverage'] == 40
    specific = analyze_profile(PROFILE, target_role='Backend Developer', job_description='Python and FastAPI are required.\nSQL and Docker are preferred.')
    assert specific['target']['source'] == 'user_provided_job_description'
    assert specific['target']['keyword_coverage'] == 50
    assert specific['target']['not_detected_skills'] == ['Docker', 'FastAPI']
    no_terms = analyze_profile(PROFILE, target_role='Data Analyst', job_description='Looking for a friendly and motivated intern.')
    assert no_terms['target']['keyword_coverage'] is None


def test_numbered_and_markdown_export_headings_preserve_evidence():
    text = '1. Headline\nStudent\n2. About\nI work on software projects.\n3. Experience\nImplemented Python endpoints.\n4. Education\nBSc\n5. Featured Projects\nBuilt SQL reports for 100 users.\n## 6. Skills\nPython and SQL\n1. Ordinary numbered detail'
    # Common numbered exports and Markdown both need their section context.
    result = analyze_profile(text, 'pasted_summary')
    assert result['present_sections'] == ['Headline', 'About', 'Experience', 'Projects', 'Skills', 'Education']
    assert result['profile_quality_score'] == 100
    assert result['action_statement_count'] == 2
    assert result['quantified_statement_count'] == 1
    assert not result['missing_sections']


def test_project_stack_context_is_distinct_from_action_or_assessment():
    result = analyze_profile('Skills: React\nProjects\nCollege Dashboard | Python, Pandas\nModeled SQL reports.\nBuilt a dashboard interface.')
    evidence = {item['name']: item for item in result['skills']}
    assert evidence['Python']['evidence_strength'] == 'project_context'
    assert evidence['SQL']['evidence_strength'] == 'applied_example'
    assert evidence['React']['evidence_strength'] == 'mention_only'
    assert result['action_statement_count'] == 2
    assert result['quantified_statement_count'] == 0
    assert all(item['level'] is None for item in evidence.values())


def test_analyze_route_ownership_validation_and_no_mutation(workspace):
    client, _, ids = workspace
    assert client.post('/api/profile/linkedin/analyze', json={}).status_code == 422
    resume = create(client)
    saved = client.put('/api/profile/linkedin', json={'profile_text': PROFILE, 'consent': True, 'confirmed': True}).json()
    assert saved['analysis']['skills']
    before = client.get(f'/api/resumes/{resume["id"]}').json()
    response = client.post('/api/profile/linkedin/analyze', json={'target_role': 'Backend Developer', 'job_description': 'Python and FastAPI are required for this backend role.'})
    assert response.status_code == 200
    assert response.headers['cache-control'] == 'no-store'
    assert response.json()['target']['not_detected_skills'] == ['FastAPI']
    assert client.get('/api/profile/linkedin').json() == saved
    assert client.get(f'/api/resumes/{resume["id"]}').json() == before
    assert client.post('/api/profile/linkedin/analyze', json={'target_role': 'made-up'}).status_code == 422
    assert client.post('/api/profile/linkedin/analyze', json={'job_description': 'too short'}).status_code == 422
    app.dependency_overrides[current_principal] = lambda: Principal('student', ids[1])
    assert client.post('/api/profile/linkedin/analyze', json={}).status_code == 422
    app.dependency_overrides[current_principal] = lambda: Principal('admin', None)
    assert client.post('/api/profile/linkedin/analyze', json={}).status_code == 403
