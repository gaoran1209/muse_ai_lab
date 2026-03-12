"""
Tests for SQLAlchemy ORM models.

Verifies all 8 models can be created, relationships work correctly,
and the database schema matches tech_requirement.md.
"""

import json
import uuid

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from src.backend.database import Base
from src.backend.models import (
    Asset,
    Content,
    Interaction,
    Look,
    LookItem,
    Project,
    Shot,
    TryOnTask,
)


@pytest.fixture(scope="module")
def engine():
    """Create an in-memory SQLite engine for testing."""
    eng = create_engine("sqlite:///:memory:")

    def _set_sqlite_pragma(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    event.listen(eng, "connect", _set_sqlite_pragma)
    Base.metadata.create_all(bind=eng)
    return eng


@pytest.fixture
def db(engine):
    """Provide a transactional database session for each test."""
    SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


# ---------------------------------------------------------------------------
# Table existence
# ---------------------------------------------------------------------------

class TestTableCreation:
    """Verify all 8 tables are created."""

    def test_all_tables_exist(self, engine):
        expected_tables = {
            "projects", "assets", "looks", "look_items",
            "shots", "contents", "interactions", "tryon_tasks",
        }
        actual_tables = set(Base.metadata.tables.keys())
        assert expected_tables.issubset(actual_tables), (
            f"Missing tables: {expected_tables - actual_tables}"
        )


# ---------------------------------------------------------------------------
# Project
# ---------------------------------------------------------------------------

class TestProject:

    def test_create_project(self, db: Session):
        project = Project(name="Test Project")
        db.add(project)
        db.flush()
        assert project.id is not None
        assert project.name == "Test Project"
        assert project.cover_url is None
        assert project.canvas_state is None
        assert project.created_at is not None

    def test_project_default_name(self, db: Session):
        project = Project()
        db.add(project)
        db.flush()
        assert project.name == "Untitled Project"


# ---------------------------------------------------------------------------
# Asset
# ---------------------------------------------------------------------------

class TestAsset:

    def test_create_asset(self, db: Session):
        project = Project(name="P")
        db.add(project)
        db.flush()

        asset = Asset(
            project_id=project.id,
            url="https://example.com/img.jpg",
            category="product",
        )
        db.add(asset)
        db.flush()
        assert asset.id is not None
        assert asset.project_id == project.id

    def test_asset_tags_json(self, db: Session):
        project = Project(name="P")
        db.add(project)
        db.flush()

        tags = {"category": "product", "color": "red", "style": "casual"}
        asset = Asset(
            project_id=project.id,
            url="https://example.com/img.jpg",
            tags=json.dumps(tags),
        )
        db.add(asset)
        db.flush()

        parsed = json.loads(asset.tags)
        assert parsed["color"] == "red"


# ---------------------------------------------------------------------------
# Look + LookItem
# ---------------------------------------------------------------------------

class TestLook:

    def test_create_look_with_items(self, db: Session):
        project = Project(name="P")
        db.add(project)
        db.flush()

        look = Look(
            project_id=project.id,
            name="Casual Look",
            description="A casual outfit",
            style_tags=json.dumps(["casual", "urban"]),
        )
        db.add(look)
        db.flush()

        item = LookItem(
            look_id=look.id,
            category="top",
            placeholder_desc="White cotton t-shirt",
            sort_order=0,
        )
        db.add(item)
        db.flush()

        assert len(look.items) == 1
        assert look.items[0].category == "top"


# ---------------------------------------------------------------------------
# Shot
# ---------------------------------------------------------------------------

class TestShot:

    def test_create_shot(self, db: Session):
        project = Project(name="P")
        db.add(project)
        db.flush()

        look = Look(project_id=project.id, name="L")
        db.add(look)
        db.flush()

        shot = Shot(
            look_id=look.id,
            type="image",
            status="queued",
        )
        db.add(shot)
        db.flush()
        assert shot.id is not None
        assert shot.adopted is False
        assert shot.content_id is None

    def test_shot_status_progression(self, db: Session):
        project = Project(name="P")
        db.add(project)
        db.flush()

        look = Look(project_id=project.id, name="L")
        db.add(look)
        db.flush()

        shot = Shot(look_id=look.id, type="image")
        db.add(shot)
        db.flush()
        assert shot.status == "queued"

        shot.status = "processing"
        db.flush()
        assert shot.status == "processing"

        shot.status = "completed"
        shot.url = "https://example.com/result.jpg"
        db.flush()
        assert shot.status == "completed"


# ---------------------------------------------------------------------------
# Content + Shot.content_id relationship
# ---------------------------------------------------------------------------

class TestContent:

    def test_create_content(self, db: Session):
        project = Project(name="P")
        db.add(project)
        db.flush()

        look = Look(project_id=project.id, name="L")
        db.add(look)
        db.flush()

        content = Content(
            look_id=look.id,
            title="Spring Collection",
            description="Casual urban style",
            tags=json.dumps(["casual"]),
            shot_ids=json.dumps(["shot1", "shot2"]),
        )
        db.add(content)
        db.flush()
        assert content.id is not None
        assert content.like_count == 0

    def test_shot_content_relationship(self, db: Session):
        """Test Shot.content_id FK links back to Content."""
        project = Project(name="P")
        db.add(project)
        db.flush()

        look = Look(project_id=project.id, name="L")
        db.add(look)
        db.flush()

        content = Content(look_id=look.id, title="T")
        db.add(content)
        db.flush()

        shot = Shot(look_id=look.id, type="image", content_id=content.id)
        db.add(shot)
        db.flush()

        assert shot.content_id == content.id
        assert shot.content is not None
        assert shot.content.title == "T"

        # Reverse: content.shots
        db.refresh(content)
        assert any(s.id == shot.id for s in content.shots)


# ---------------------------------------------------------------------------
# Interaction
# ---------------------------------------------------------------------------

class TestInteraction:

    def test_create_interaction(self, db: Session):
        project = Project(name="P")
        db.add(project)
        db.flush()

        look = Look(project_id=project.id, name="L")
        db.add(look)
        db.flush()

        content = Content(look_id=look.id, title="T")
        db.add(content)
        db.flush()

        like = Interaction(
            content_id=content.id,
            type="like",
            user_identifier="user_001",
        )
        comment = Interaction(
            content_id=content.id,
            type="comment",
            user_identifier="user_002",
            comment_text="Great look!",
        )
        db.add_all([like, comment])
        db.flush()

        assert len(content.interactions) == 2


# ---------------------------------------------------------------------------
# TryOnTask
# ---------------------------------------------------------------------------

class TestTryOnTask:

    def test_create_tryon_task(self, db: Session):
        project = Project(name="P")
        db.add(project)
        db.flush()

        look = Look(project_id=project.id, name="L")
        db.add(look)
        db.flush()

        content = Content(look_id=look.id, title="T")
        db.add(content)
        db.flush()

        task = TryOnTask(
            content_id=content.id,
            user_photo_url="https://example.com/photo.jpg",
        )
        db.add(task)
        db.flush()
        assert task.status == "queued"
        assert task.result_url is None
        assert task.completed_at is None
