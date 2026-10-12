from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime, UTC, timedelta
import hashlib
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app import models, schemas as s
from app.auth import current_principal, account_principal, issue_token, hash_password, check_password, Principal
from app.db import get_db
from app.config import get_settings
from app.services.accounts import demo_account
from app.services.demo_seed import seed_demo

router = APIRouter(prefix='/api/auth', tags=['accounts'])


def limit_attempts(request, db):
    # Trust the direct peer address, not a client-supplied forwarding header.
    key = hashlib.sha256((request.client.host if request.client else 'unknown').encode()).hexdigest()
    now = datetime.now(UTC)
    db.query(models.AuthRateLimit).filter(models.AuthRateLimit.window_start < now-timedelta(minutes=15)).delete(synchronize_session=False)
    item = db.get(models.AuthRateLimit, key)
    if not item:
        item = models.AuthRateLimit(key=key, window_start=now, attempts=0)
        db.add(item)
    if item.attempts >= 30:
        raise HTTPException(429, detail={'code': 'AUTH_RATE_LIMIT', 'message': 'Too many sign-in attempts. Try again after 15 minutes.'}, headers={'Retry-After': '900'})
    item.attempts += 1
    db.commit()


def session_out(principal):
    return s.AuthSessionOut(access_token=issue_token(principal), role=principal.role, student_id=principal.student_id)


@router.post('/login', response_model=s.AuthSessionOut)
def login(body: s.LoginIn, request: Request, db: Session = Depends(get_db)):
    limit_attempts(request, db)
    cfg = get_settings()
    account = db.scalar(select(models.Account).where(models.Account.username == body.username.strip().casefold()))
    if body.username == 'demo' and cfg.app_env == 'development' and cfg.demo_password:
        # Legacy demo password creates a normal database student account only.
        import hmac
        if hmac.compare_digest(body.password, cfg.demo_password.get_secret_value()):
            student, _ = seed_demo(db)
            return session_out(demo_account(db, student, body.password))
    if not check_password(body.password, account.password_hash if account else None) or not account or not account.active:
        raise HTTPException(401, detail={'code': 'INVALID_CREDENTIALS', 'message': 'Invalid credentials'})
    return session_out(account_principal(db, account))


@router.post('/signup', response_model=s.AuthSessionOut, status_code=201)
def signup(body: s.SignupIn, request: Request, db: Session = Depends(get_db)):
    limit_attempts(request, db)
    username = body.username.strip().casefold()
    if not username or username in {'admin', 'demo'} or username.startswith('student-'):
        raise HTTPException(422, detail={'code': 'INVALID_USERNAME', 'message': 'Choose another username'})
    # Check signing configuration before committing an account.
    cfg = get_settings()
    if not cfg.auth_signing_key or len(cfg.auth_signing_key.get_secret_value()) < 32:
        raise HTTPException(503, detail={'code': 'AUTH_NOT_CONFIGURED', 'message': 'Server authentication is not configured'})
    try:
        student = models.Student(student_id=body.student_id.strip(), name=body.name.strip(),
                                 email=str(body.email).casefold(), department=body.department.strip())
        if not student.student_id or not student.name or not student.department:
            raise HTTPException(422, detail='Student details cannot be blank')
        db.add(student); db.flush()
        account = models.Account(username=username, password_hash=hash_password(body.password), role='student', student_pk=student.id)
        db.add(account); db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, detail={'code': 'ACCOUNT_EXISTS', 'message': 'Account or student identity already exists. Contact faculty for an imported account.'}) from None
    return session_out(account_principal(db, account))


@router.get('/me', response_model=s.AccountOut)
def me(principal: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    account = db.get(models.Account, principal.account_id)
    return s.AccountOut(account_id=account.id, username=account.username, role=account.role, student_id=account.student_pk)


@router.post('/logout')
def logout(principal: Principal = Depends(current_principal), db: Session = Depends(get_db)):
    account = db.get(models.Account, principal.account_id)
    account.session_version += 1
    db.commit()
    return {'signed_out': True}
