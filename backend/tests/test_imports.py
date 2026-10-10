from io import BytesIO
import pytest
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session
from app.db import Base
from app import models
from app.services import imports

@pytest.fixture
def db(tmp_path):
    engine = create_engine(f'sqlite:///{tmp_path}/import.db')
    @event.listens_for(engine, 'connect')
    def foreign_keys(conn, _):
        conn.execute('PRAGMA foreign_keys=ON')
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()

def data():
    return (b'Reg No,Student Name,Email ID,Course,CGPA\n'
            b'SYN100,Amy Test,amy@example.test,BTech,8.8\n'
            b'SYN101,Bad Test,bad-email,BTech,7.5\n'
            b'SYN100,Same Test,same@example.test,BTech,8.0\n'
            b'SYN102,Chris Test,chris@example.test,BTech,12\n')

def test_csv_mapping_partial_import_and_retry(db):
    job, headers = imports.upload(db, 'synthetic.csv', data())
    assert job.total_rows == 4
    assert job.field_mapping == {'Reg No':'student_id','Student Name':'name','Email ID':'email','Course':'program','CGPA':'cgpa'}
    report = imports.preview(db, job, job.field_mapping)
    assert (report['job']['valid_rows'], report['job']['duplicate_rows'], report['job']['error_rows']) == (1,1,2)
    assert len(report['issues']) == 3
    result = imports.confirm(db, job)
    assert result['job']['imported_rows'] == 1
    assert db.scalar(select(models.Student).where(models.Student.student_id == 'SYN100')).is_synthetic
    assert len(db.scalars(select(models.Student)).all()) == 1
    retry_report = imports.retry(db, job)
    assert retry_report['job']['valid_rows'] == 0
    assert imports.confirm(db, job)['job']['imported_rows'] == 1

def test_excel_and_invalid_mapping(db):
    import pandas as pd
    buffer = BytesIO()
    pd.DataFrame([{'Student ID':'SYN200','Student Name':'Demo Student','Email ID':'demo@example.test','Course':'BTech'}]).to_excel(buffer, index=False)
    job, _ = imports.upload(db, 'synthetic.xlsx', buffer.getvalue())
    with pytest.raises(ValueError):
        imports.preview(db, job, {'missing':'student_id'})
    assert imports.preview(db, job, job.field_mapping)['job']['valid_rows'] == 1
    assert imports.confirm(db, job)['job']['status'] == 'completed'

def test_update_synthetic_only_and_repeat_upload(db):
    existing = models.Student(student_id='SYN300', name='Original', email='orig@example.test', is_synthetic=True)
    db.add(existing)
    db.commit()
    file = b'Student ID,Student Name,Email ID,Course\nSYN300,Updated,orig@example.test,BTech\n'
    job, _ = imports.upload(db, 'test.csv', file)
    assert imports.preview(db, job, job.field_mapping)['job']['duplicate_rows'] == 1
    assert imports.confirm(db, job, True)['job']['imported_rows'] == 1
    assert db.get(models.Student, existing.id).name == 'Updated'
    other = models.Student(student_id='REAL', name='Do Not Modify', email='real@example.test', is_synthetic=False)
    db.add(other);db.commit()
    job2, _ = imports.upload(db,'test.csv', b'Student ID,Student Name,Email ID,Course\nREAL,Changed,real@example.test,BTech\n')
    imports.preview(db,job2,job2.field_mapping)
    assert imports.confirm(db,job2,True)['job']['imported_rows'] == 0
    assert db.get(models.Student, other.id).name == 'Do Not Modify'

def test_reject_bad_uploads(db):
    for name, contents in [('evil.txt',data()),('blank.csv',b'')]:
        with pytest.raises(ValueError):
            imports.upload(db,name,contents)
