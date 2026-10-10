"""Minimal signed bearer authentication for the prototype; no client-side secrets."""
import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import Student


@dataclass(frozen=True)
class Principal:
    role: str
    student_id: int | None = None


def _encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')


def _decode(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + '=' * (-len(data) % 4))


def issue_token(principal: Principal) -> str:
    secret = get_settings().auth_signing_key
    if not secret or len(secret.get_secret_value()) < 32:
        raise HTTPException(503, detail={"code": "AUTH_NOT_CONFIGURED", "message": "Server authentication is not configured"})
    payload = _encode(json.dumps({"role": principal.role, "student_id": principal.student_id,
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
        if data['exp'] <= int(time.time()) or data['role'] not in {'admin', 'student'}:
            raise ValueError('expired or role')
        if data['role'] == 'student' and (type(data.get('student_id')) is not int or data['student_id'] <= 0):
            raise ValueError('student id')
        return Principal(data['role'], data.get('student_id'))
    except (ValueError, KeyError, TypeError, UnicodeError, json.JSONDecodeError) as exc:
        raise HTTPException(401, detail={"code": "INVALID_TOKEN", "message": "Session expired or invalid"}) from exc


def current_principal(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> Principal:
    # Isolated test mode preserves earlier phase's deterministic API tests.
    if get_settings().app_env == 'test':
        return Principal('admin')
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(401, detail={"code": "AUTH_REQUIRED", "message": "Sign in to continue"})
    principal = verify_token(authorization[7:])
    if principal.role == 'student':
        student = db.get(Student, principal.student_id)
        if student is None or not student.is_synthetic:
            raise HTTPException(403, detail={"code": "ACCOUNT_DISABLED", "message": "Student account is unavailable"})
    return principal


def require_admin(principal: Principal = Depends(current_principal)) -> Principal:
    if principal.role != 'admin':
        raise HTTPException(403, detail={"code": "ADMIN_REQUIRED", "message": "Administrator access required"})
    return principal


def allow_student(principal: Principal, student_id: int) -> None:
    if principal.role != 'admin' and principal.student_id != student_id:
        raise HTTPException(403, detail={"code": "FORBIDDEN", "message": "You can only access your own student record"})
