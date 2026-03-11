"""
SQLAlchemy database engine and session management.

Demo uses SQLite with WAL mode for better concurrent read performance.
The session factory provides dependency-injected sessions for FastAPI routes.
"""

from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from src.backend.config import config


# SQLite-specific: enable WAL mode and foreign keys
def _set_sqlite_pragma(dbapi_connection, _connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


engine = create_engine(
    config.DATABASE_URL,
    echo=config.DEBUG_MODE,
    connect_args={"check_same_thread": False},  # SQLite threading
)

if config.DATABASE_URL.startswith("sqlite"):
    event.listen(engine, "connect", _set_sqlite_pragma)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables() -> None:
    """Create all tables defined in models. Safe to call multiple times."""
    Base.metadata.create_all(bind=engine)
