from collections.abc import Iterator

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


def make_engine(url: str | None = None) -> Engine:
    url = url or get_settings().database_url
    kwargs = {"connect_args": {"check_same_thread": False}} if url.startswith("sqlite") else {}
    engine = create_engine(url, hide_parameters=True, **kwargs)
    if url.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def _fk_on(dbapi_conn, _):  # enforce foreign keys in SQLite
            dbapi_conn.execute("PRAGMA foreign_keys=ON")

    return engine


engine = make_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def init_db(target: Engine | None = None) -> None:
    """Preserve legacy bootstrap; private AI/review tables require explicit Alembic upgrade."""
    from app import models  # noqa: F401  (register tables)

    bound = target or engine
    from app.document_models import Document, Extraction, Proposal, ProposalItem, Audit, AiWindow, AiCache, AiDiagnostic
    private = {model.__table__.name for model in (Document, Extraction, Proposal, ProposalItem, Audit, AiWindow, AiCache, AiDiagnostic)}
    Base.metadata.create_all(bound, tables=[t for t in Base.metadata.sorted_tables if t.name not in private])
    from app.services.accounts import backfill_accounts
    with Session(bound) as db:
        backfill_accounts(db)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
