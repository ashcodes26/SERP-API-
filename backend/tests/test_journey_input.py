from io import BytesIO
import zipfile

from app import models
from app.auth import Principal, current_principal
from app.main import app
from app.services.journey_input import parse
from test_workspace import workspace  # noqa: F401


def docx(text: str) -> bytes:
    document = ('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
                '<w:body>' + ''.join(f'<w:p><w:r><w:t>{line}</w:t></w:r></w:p>' for line in text.splitlines()) +
                '</w:body></w:document>')
    content = BytesIO()
    with zipfile.ZipFile(content, 'w') as archive:
        archive.writestr('word/document.xml', document)
    return content.getvalue()


DOCX = docx('Name: Alex Synthetic\nSkills\nPython, JavaScript\nBuilt a career project with Python.')


def upload(client, content=DOCX, filename='profile.docx'):
    return client.post('/api/journey/input/preview', files={'file': (filename, content)})


def test_docx_preview_save_is_owned_reviewed_and_preserves_assessments(workspace):
    client, factory, ids = workspace
    before = client.get(f'/api/profile/{ids[0]}').json()
    response = upload(client)
    assert response.status_code == 200
    assert response.headers['cache-control'] == 'no-store'
    preview = response.json()
    assert preview['ignored_columns'] == []
    assert preview['details']['name'] == 'Alex Synthetic'
    assert 'Python' in preview['details']['skills']
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
    again = upload(client).json()
    result = client.post('/api/journey/input/save', json={'details': again['details'], 'profile_digest': again['profile_digest'], 'confirmed': True})
    assert len(result.json()['evidence']) == len(saved['evidence'])


def test_docx_input_extracts_name_and_skills():
    details, ignored = parse('profile.docx', docx('Name: Taylor Synthetic\nSkills\nJavaScript, SQL'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    assert details.name == 'Taylor Synthetic'
    assert set(details.skills) >= {'JavaScript', 'SQL'} and ignored == []


def test_docx_uses_validated_filename_when_picker_reports_legacy_mime():
    details, _ = parse('profile.docx', DOCX, 'application/msword')
    assert details.name == 'Alex Synthetic'


def test_invalid_documents_are_rejected_without_profile_changes(workspace):
    client, _, ids = workspace
    before = client.get(f'/api/profile/{ids[0]}').json()
    for data, filename in [(DOCX, 'profile.doc'), (b'invalid', 'profile.docx'), (b'name,cgpa\nAlex,12\n', 'profile.csv'), (DOCX, 'profile.pdf')]:
        response = upload(client, data, filename)
        assert response.status_code == 422
        assert response.json()['detail']['code'] in {'INVALID_DOCUMENT', 'RESUME_PARSE_FAILED'}
    assert upload(client, b'a' * (1024 * 1024 + 1)).status_code == 413
    assert client.get(f'/api/profile/{ids[0]}').json() == before


def test_admin_cannot_write_a_student_journey(workspace):
    client, _, _ = workspace
    app.dependency_overrides[current_principal] = lambda: Principal('admin')
    assert upload(client).status_code == 403
