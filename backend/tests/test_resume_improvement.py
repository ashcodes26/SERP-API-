from test_workspace import workspace, create, JD  # noqa: F401

def test_retired_engines_and_google_consent(workspace):
    client, _, _ = workspace
    item = create(client)
    for route in ['semantic-review', 'improvement-preview']:
        assert client.post(f'/api/resumes/{item["id"]}/{route}', json={'version': item['version'], 'description': JD}).status_code == 404
    assert client.post('/api/profile/linkedin/semantic-review', json={'description': JD}).status_code == 404
    assert client.post(f'/api/resumes/{item["id"]}/analyze', json={'version': item['version'], 'title': 'Analyst', 'description': JD}).status_code == 422
    fresh = client.get(f'/api/resumes/{item["id"]}').json()
    assert fresh['analysis'] is None and fresh['version'] == item['version']
    assert 'original_statistics' not in fresh and 'revised_statistics' not in fresh
