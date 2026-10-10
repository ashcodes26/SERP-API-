from app.services.resume_statistics import text_statistics
from test_workspace import workspace, create, TEXT  # noqa: F401


def test_sections_require_content_and_counts_are_explainable():
    empty = text_statistics('Education\nSkills\nExperience\nProjects')
    assert empty['strength_score'] == 0
    assert empty['section_coverage'] == 0
    text = 'Alex Student\nEducation: BSc\nSkills: Python, SQL\nExperience: Intern, 2023-2024\nProjects\n- Built a Python tool for 100 users.\n- Reduced runtime by 20%.\n'
    result = text_statistics(text)
    assert result == text_statistics(text)
    assert result['strength_score'] == 100
    assert result['section_coverage'] == 100
    assert result['action_statement_count'] == 2
    assert result['quantified_statement_count'] == 2
    assert result['bullet_count'] == 2
    assert result['detected_skills'] == ['Python', 'SQL']
    assert result['character_count'] == len(text)


def test_contact_dates_and_hypothetical_claims_are_not_outcomes():
    result = text_statistics('Contact: built@example.com +123456789\nProjects\nBuilt a SQL tool in 2024.\nPlan to improve reports for 100 users.\nExperience\nIntern 2022-2023')
    assert result['action_statement_count'] == 1
    assert result['quantified_statement_count'] == 0
    assert result['detected_skills'] == ['SQL']


def test_statistics_follow_saved_revision_restore_and_ignore_profile(workspace):
    client, _, _ = workspace
    item = create(client)
    original = item['original_statistics']
    assert original == item['revised_statistics']
    assert original['strength_score'] == 85
    revised = TEXT + '\nEXPERIENCE\nBuilt SQL reports for 200 users.'
    response = client.put(f'/api/resumes/{item["id"]}/revision', json={'version': item['version'], 'text': revised, 'factual_confirmation': True})
    assert response.status_code == 200
    item = response.json()
    assert item['original_statistics'] == original
    assert item['revised_statistics']['strength_score'] == 100
    assert item['revised_statistics']['detected_skills'] == ['Python', 'SQL']
    saved = client.put('/api/profile/linkedin', json={'profile_text': 'Skills: Docker\nProjects: Built a Docker application for 100 users.', 'consent': True, 'confirmed': True})
    assert saved.status_code == 200
    assert saved.json()['detected_skills'] == ['Docker']
    assert saved.json()['sections']['skills'] == ['Docker']
    fresh = client.get(f'/api/resumes/{item["id"]}').json()
    assert fresh['original_statistics'] == original
    assert fresh['revised_statistics'] == item['revised_statistics']
    restored = client.post(f'/api/resumes/{item["id"]}/restore', json={'version': fresh['version']}).json()
    assert restored['original_statistics'] == restored['revised_statistics'] == original
