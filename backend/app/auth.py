"""Minimal signed bearer authentication for the prototype; no client-side secrets."""
import base64
import hashlib
import hmac
import json
import time
import secrets
from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import Student, Account, FacultyScope
from sqlalchemy import select


@dataclass(frozen=True)
class Principal:
    role: str
    student_id: int | None = None
    account_id: int | None = None
    session_version: int = 1
    assigned_ids: tuple[int, ...] = ()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 600_000)
    return f'pbkdf2_sha256$600000${salt.hex()}${digest.hex()}'


def check_password(password: str, stored: str | None) -> bool:
    if not stored:
        # Perform the same expensive work for unavailable accounts.
        hash_password(password)
        return False
    try:
        _, rounds, salt, expected = stored.split('$')
        actual = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), int(rounds)).hex()
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def account_principal(db: Session, account: Account) -> Principal:
    ids = tuple(db.scalars(select(FacultyScope.student_pk).where(FacultyScope.admin_id == account.id))) if account.role == 'admin' else ()
    return Principal(account.role, account.student_pk, account.id, account.session_version, ids)


def _encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')


def _decode(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + '=' * (-len(data) % 4))


def issue_token(principal: Principal) -> str:
    secret = get_settings().auth_signing_key
    if not secret or len(secret.get_secret_value()) < 32:
        raise HTTPException(503, detail={"code": "AUTH_NOT_CONFIGURED", "message": "Server authentication is not configured"})
    payload = _encode(json.dumps({"account_id": principal.account_id, "session_version": principal.session_version,
                                  "exp": int(time.time()) + 3600}, separators=(',', ':')).encode())
    signature = _encode(hmac.new(secret.get_secret_value().encode(), payload.encode(), hashlib.sha256).digest())
    return payload + '.' + signature


def verify_token(token: str) -> Principal:
    secret = get_settings().auth_signing_key
    if not secret or len(secret.get_secret_value()) < 32:
        raise HTTPException(503, detail={"code": "AUTH_NOT_CONFIGURED", "message": "Server authentication is not configured"})
    try:
        payload, signature = token.split('.')
        expected = _encode(hmac.new(secret.get_secret_value().encode(), payload.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(signature, expected):
            raise ValueError('signature')
        data = json.loads(_decode(payload))
        if data['exp'] <= int(time.time()) or type(data.get('account_id')) is not int or data['account_id'] <= 0:
            raise ValueError('expired or account')
        return Principal('', account_id=data['account_id'], session_version=data['session_version'])
    except (ValueError, KeyError, TypeError, UnicodeError, json.JSONDecodeError) as exc:
        raise HTTPException(401, detail={"code": "INVALID_TOKEN", "message": "Session expired or invalid"}) from exc


def current_principal(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> Principal:
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(401, detail={"code": "AUTH_REQUIRED", "message": "Sign in to continue"})
    principal = verify_token(authorization[7:])
    account = db.get(Account, principal.account_id)
    if not account or not account.active or account.session_version != principal.session_version or account.role not in {'student', 'admin'}:
        raise HTTPException(401, detail={"code": "ACCOUNT_DISABLED", "message": "Session is no longer available"})
    if account.role == 'student' and (not account.student_pk or not db.get(Student, account.student_pk)):
        raise HTTPException(401, detail={"code": "ACCOUNT_DISABLED", "message": "Student account is unavailable"})
    return account_principal(db, account)


def require_admin(principal: Principal = Depends(current_principal)) -> Principal:
    if principal.role != 'admin':
        raise HTTPException(403, detail={"code": "ADMIN_REQUIRED", "message": "Administrator access required"})
    return principal


def allow_student(principal: Principal, student_id: int) -> None:
    if (principal.role == 'admin' and student_id not in principal.assigned_ids) or (principal.role != 'admin' and principal.student_id != student_id):
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "You can only access your own student record"})
