from app import models
from test_workspace import workspace, create, TEXT  # noqa: F401

def test_legacy_analysis_hidden_but_saved_text_recoverable(workspace):
    client, factory, _ = workspace
    item = create(client)
    with factory() as db:
        row = db.get(models.ResumeWorkspace, item['id'])
        row.analysis = {'score': 99, 'suggestions': [{'source': 'rule_based'}]}
        row.revised_text = TEXT + '\nMy manual revision.'
        db.commit()
    saved = client.get(f'/api/resumes/{item["id"]}').json()
    assert saved['analysis'] is None and saved['original_text'] == TEXT
    assert saved['revised_text'].endswith('My manual revision.')
    assert client.post(f'/api/resumes/{item["id"]}/apply', json={'version': saved['version']}).status_code == 422
    restored = client.post(f'/api/resumes/{item["id"]}/restore', json={'version': saved['version']}).json()
    assert restored['revised_text'] == TEXT
