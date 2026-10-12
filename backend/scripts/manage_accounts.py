"""Run from backend: python -m scripts.manage_accounts --help. Passwords use getpass."""
import argparse
from getpass import getpass
from sqlalchemy import select
from app import models
from app.db import init_db, SessionLocal
from app.auth import hash_password


def main():
    parser = argparse.ArgumentParser(description='Create accounts and explicitly grant faculty access locally')
    sub = parser.add_subparsers(dest='command', required=True)
    create = sub.add_parser('create-admin')
    create.add_argument('--username', required=True)
    reset = sub.add_parser('set-password')
    reset.add_argument('--username', required=True)
    grant = sub.add_parser('grant')
    grant.add_argument('--username', required=True)
    grant.add_argument('--student-id', action='append', required=True, help='Institutional student ID (repeatable)')
    grant.add_argument('--cohort', required=True)
    grant.add_argument('--department', required=True)
    grant.add_argument('--batch', required=True)
    grant.add_argument('--section', required=True)
    revoke = sub.add_parser('revoke')
    revoke.add_argument('--username', required=True)
    revoke.add_argument('--student-id', required=True)
    args = parser.parse_args()
    init_db()
    with SessionLocal() as db:
        username = args.username.strip().casefold()
        account = db.scalar(select(models.Account).where(models.Account.username == username))
        if args.command in {'create-admin', 'set-password'}:
            if args.command == 'create-admin' and account:
                parser.error('Username already exists; accounts are never promoted automatically')
            if args.command == 'set-password' and not account:
                parser.error('Account not found; imported student logins use student-<database id>')
            if not username or username == 'demo' or (args.command == 'create-admin' and username.startswith('student-')):
                parser.error('Choose a non-reserved username')
            password = getpass('Password (minimum 12 characters): ')
            if len(password) < 12 or len(password) > 256 or getpass('Confirm password: ') != password:
                parser.error('Password length or confirmation is invalid')
            if account is None:
                account = models.Account(username=username, role='admin')
                db.add(account)
            account.password_hash = hash_password(password)
            account.session_version = (account.session_version or 0) + 1
            db.commit()
            print('Account saved. Faculty access remains limited to explicit grants.')
            return
        if not account or account.role != 'admin':
            parser.error('Faculty account not found')
        ids = args.student_id if isinstance(args.student_id, list) else [args.student_id]
        students = list(db.scalars(select(models.Student).where(models.Student.student_id.in_(ids))))
        if len(students) != len(set(ids)):
            parser.error('One or more student IDs do not exist; no grants were changed')
        if args.command == 'revoke':
            student = students[0]
            scope = db.get(models.FacultyScope, (account.id, student.id))
            if scope:
                db.delete(scope)
            db.add(models.AdminAudit(actor_id=account.id, action='scope_revoked', object_type='student', object_id=student.id))
        else:
            cohort = db.scalar(select(models.Cohort).where(models.Cohort.admin_id == account.id, models.Cohort.name == args.cohort))
            if cohort is None:
                cohort = models.Cohort(admin_id=account.id, name=args.cohort, department=args.department, batch=args.batch, section=args.section)
                db.add(cohort); db.flush()
            if (cohort.department, cohort.batch, cohort.section) != (args.department, args.batch, args.section):
                parser.error('Existing cohort metadata differs')
            for student in students:
                if student.department and student.department != args.department:
                    parser.error('Student department does not match the cohort')
                meta = db.get(models.StudentPlacementMeta, student.id)
                if meta and ((meta.batch and meta.batch != args.batch) or (meta.section and meta.section != args.section)):
                    parser.error('Student batch/section does not match the cohort')
                if not meta:
                    meta = models.StudentPlacementMeta(student_pk=student.id)
                    db.add(meta)
                meta.batch, meta.section = args.batch, args.section
                if not db.get(models.FacultyScope, (account.id, student.id)):
                    db.add(models.FacultyScope(admin_id=account.id, student_pk=student.id))
                if not db.get(models.CohortMember, (cohort.id, student.id)):
                    db.add(models.CohortMember(cohort_id=cohort.id, student_pk=student.id))
                db.add(models.AdminAudit(actor_id=account.id, action='scope_granted', object_type='student', object_id=student.id))
        db.commit()
        print('Explicit student access updated.')


if __name__ == '__main__':
    main()
