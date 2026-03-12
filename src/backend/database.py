"""
SQLAlchemy database engine and session management.

Demo uses SQLite with WAL mode for better concurrent read performance.
The session factory provides dependency-injected sessions for FastAPI routes.
"""

from collections.abc import Generator

from sqlalchemy import create_engine, event, inspect, text
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
    _ensure_schema_columns()


def _ensure_schema_columns() -> None:
    """Apply additive schema fixes for existing SQLite demo databases."""
    inspector = inspect(engine)
    if "projects" not in inspector.get_table_names():
        return

    project_columns = {column["name"] for column in inspector.get_columns("projects")}
    statements: list[str] = []
    if "canvas_state" not in project_columns:
        statements.append("ALTER TABLE projects ADD COLUMN canvas_state TEXT")

    if not statements:
        return

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
