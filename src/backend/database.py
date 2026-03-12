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
    table_names = set(inspector.get_table_names())
    if "projects" not in table_names:
        return

    statements: list[str] = []
    project_columns = {column["name"] for column in inspector.get_columns("projects")}
    if "canvas_state" not in project_columns:
        statements.append("ALTER TABLE projects ADD COLUMN canvas_state TEXT")

    if "assets" in table_names:
        asset_columns = {column["name"] for column in inspector.get_columns("assets")}
        asset_additions = {
            "library_scope": "ALTER TABLE assets ADD COLUMN library_scope TEXT DEFAULT 'user'",
            "owner_user_id": "ALTER TABLE assets ADD COLUMN owner_user_id TEXT",
            "source_type": "ALTER TABLE assets ADD COLUMN source_type TEXT DEFAULT 'upload'",
            "storage_provider": "ALTER TABLE assets ADD COLUMN storage_provider TEXT DEFAULT 'local'",
            "storage_key": "ALTER TABLE assets ADD COLUMN storage_key TEXT",
            "status": "ALTER TABLE assets ADD COLUMN status TEXT DEFAULT 'active'",
            "last_used_at": "ALTER TABLE assets ADD COLUMN last_used_at DATETIME",
        }
        for column_name, statement in asset_additions.items():
            if column_name not in asset_columns:
                statements.append(statement)

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))

        if "assets" in table_names:
            connection.execute(
                text(
                    """
                    UPDATE assets
                    SET library_scope = COALESCE(library_scope, 'user'),
                        source_type = COALESCE(source_type, 'upload'),
                        storage_provider = COALESCE(storage_provider, 'local'),
                        status = COALESCE(status, 'active')
                    """
                )
            )

            if "project_assets" in table_names:
                connection.execute(
                    text(
                        """
                        INSERT INTO project_assets (id, project_id, asset_id, created_at)
                        SELECT lower(hex(randomblob(16))), assets.project_id, assets.id, assets.created_at
                        FROM assets
                        WHERE assets.project_id IS NOT NULL
                          AND NOT EXISTS (
                            SELECT 1
                            FROM project_assets
                            WHERE project_assets.project_id = assets.project_id
                              AND project_assets.asset_id = assets.id
                          )
                        """
                    )
                )
