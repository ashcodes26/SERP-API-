"""Maintenance entry point: python -m app.services.document_retention.

Run at least every minute when review is enabled; every read/approval also enforces expiry.
Never uses a provider or reads a binary file. Configure the scheduler before release.
"""
from app.db import SessionLocal
from app.services.document_intelligence import configured, purge_expired


def main():
    configured()
    with SessionLocal() as db:
        purge_expired(db)


if __name__ == '__main__':
    main()
