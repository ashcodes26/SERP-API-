"""Additive upgrade: existing student identities get disabled student-only logins."""
from sqlalchemy import select
from sqlalchemy.orm import Session
from app import models
from app.auth import hash_password, account_principal


def backfill_accounts(db: Session):
    linked = set(db.scalars(select(models.Account.student_pk)))
    names = set(db.scalars(select(models.Account.username)))
    for student in db.scalars(select(models.Student)):
        if student.id in linked:
            continue
        # Reserved namespace avoids conflicts with faculty/user-selected usernames.
        username = f'student-{student.id}'
        while username in names:
            username += '-legacy'
        db.add(models.Account(username=username, role='student', student_pk=student.id, password_hash=None))
        names.add(username)
    db.commit()


def demo_account(db, student, password=None):
    account = db.scalar(select(models.Account).where(models.Account.student_pk == student.id))
    if account is None:
        account = models.Account(username=f'student-{student.id}', role='student', student_pk=student.id)
        db.add(account)
    if password and not account.password_hash:
        account.password_hash = hash_password(password)
    db.commit()
    return account_principal(db, account)
