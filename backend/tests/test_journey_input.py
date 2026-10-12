from io import BytesIO

from openpyxl import Workbook
from app import models
from app.auth import Principal, current_principal
from app.main import app
from app.services.journey_input import parse
from test_workspace import workspace  # noqa: F401

CSV = b'name,program,semester,cgpa,skills,summary,email,student_id\nAlex Synthetic,BSc,4,8.5,Python;JavaScript,Example supplied career summary,changed@example.org,foreign-id\n'


def upload(client, content=CSV, filename='profile.csv'):
    return client.post('/api/journey/input/preview', files={'file': (filename, content)})


def test_csv_preview_save_is_owned_reviewed_and_preserves_assessments(workspace):
    client, factory, ids = workspace
    before = client.get(f'/api/profile/{ids[0]}').json()
    response = upload(client)
    assert response.status_code == 200
    assert response.headers['cache-control'] == 'no-store'
    preview = response.json()
    assert preview['ignored_columns'] == ['email', 'student_id']
    assert client.get(f'/api/profile/{ids[0]}').json() == before
    body = {**{key: preview[key] for key in ('details', 'profile_digest')}, 'confirmed': False}
    assert client.post('/api/journey/input/save', json=body).status_code == 422
    body['confirmed'] = True
    result = client.post('/api/journey/input/save', json=body)
    assert result.status_code == 200
    saved = result.json()
    assert saved['student']['name'] == 'Alex Synthetic'
    assert saved['student']['email'] == before['student']['email']
    assert saved['student']['student_id'] == before['student']['student_id']
    python_before = next(x for x in before['competencies'] if x['skill']['canonical_name'] == 'Python')
    python_after = next(x for x in saved['competencies'] if x['skill']['canonical_name'] == 'Python')
    assert python_after['level'] == python_before['level']
    assert set(python_before['evidence_ids']) <= set(python_after['evidence_ids'])
    javascript = next(x for x in saved['competencies'] if x['skill']['canonical_name'] == 'JavaScript')
    assert javascript['level'] is None and javascript['confidence'] == 0
    with factory() as db:
        assert db.get(models.Student, ids[1]).name == 'Other synthetic student'
    assert client.post('/api/journey/input/save', json=body).status_code == 409
    # Repeating the same reviewed file does not duplicate evidence.
    again = upload(client).json()
    result = client.post('/api/journey/input/save', json={'details': again['details'], 'profile_digest': again['profile_digest'], 'confirmed': True})
    assert len(result.json()['evidence']) == len(saved['evidence'])


def test_excel_and_aliases_are_real_parsed_input():
    workbook = Workbook()
    workbook.active.append(['Full Name', 'Degree', 'Skills', 'CGPA'])
    workbook.active.append(['Taylor Synthetic', 'BSc', 'JS|SQL', 7.5])
    content = BytesIO(); workbook.save(content)
    details, ignored = parse('profile.xlsx', content.getvalue())
    assert details.name == 'Taylor Synthetic' and details.cgpa == 7.5
    assert details.skills == ['JS', 'SQL'] and ignored == []


def test_invalid_files_and_ranges_are_rejected_without_profile_changes(workspace):
    client, _, ids = workspace
    before = client.get(f'/api/profile/{ids[0]}').json()
    for data, filename in [(CSV, 'profile.xls'), (b'invalid', 'profile.xlsx'), (b'name,cgpa\nAlex,12\n', 'profile.csv'), (b'name\nAlex\nTaylor\n', 'profile.csv'), (b'unknown\nvalue\n', 'profile.csv'), (b'name,full name\nAlex,Taylor\n', 'profile.csv')]:
        assert upload(client, data, filename).status_code == 422
    assert upload(client, b'a' * (1024 * 1024 + 1)).status_code == 413
    assert client.get(f'/api/profile/{ids[0]}').json() == before


def test_admin_cannot_write_a_student_journey(workspace):
    client, _, _ = workspace
    app.dependency_overrides[current_principal] = lambda: Principal('admin')
    assert upload(client).status_code == 403
