"""
SQLAlchemy ORM models for the MUSE AI Lab domain.

Entity relationships:
    Project N--N Asset (via ProjectAsset)
    Project 1--N Look 1--N LookItem
    Look    1--N Shot
    Shot    N--1 Content 1--N Interaction
    Content 1--N TryOnTask
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.backend.database import Base


def _uuid() -> str:
    return uuid.uuid4().hex


def _utcnow() -> datetime:
    return datetime.now(UTC)


# ---------------------------------------------------------------------------
# Project
# ---------------------------------------------------------------------------

class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(200), nullable=False, default="Untitled Project")
    cover_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    canvas_state: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)

    assets: Mapped[list["Asset"]] = relationship(
        secondary="project_assets",
        back_populates="projects",
        overlaps="asset_links,project_links,project,asset",
    )
    asset_links: Mapped[list["ProjectAsset"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
        overlaps="assets,projects",
    )
    looks: Mapped[list["Look"]] = relationship(back_populates="project", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# Asset
# ---------------------------------------------------------------------------

class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(String(32), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    thumbnail_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(20), nullable=False, default="product")
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
    original_filename: Mapped[str | None] = mapped_column(String(200), nullable=True)
    library_scope: Mapped[str] = mapped_column(String(20), nullable=False, default="user")
    owner_user_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    source_type: Mapped[str] = mapped_column(String(20), nullable=False, default="upload")
    storage_provider: Mapped[str] = mapped_column(String(20), nullable=False, default="local")
    storage_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    project: Mapped["Project"] = relationship()
    projects: Mapped[list["Project"]] = relationship(
        secondary="project_assets",
        back_populates="assets",
        overlaps="asset_links,project_links,project,asset",
    )
    project_links: Mapped[list["ProjectAsset"]] = relationship(
        back_populates="asset",
        cascade="all, delete-orphan",
        passive_deletes=True,
        overlaps="assets,projects",
    )
    look_items: Mapped[list["LookItem"]] = relationship(back_populates="asset")


class ProjectAsset(Base):
    __tablename__ = "project_assets"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(String(32), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    asset_id: Mapped[str] = mapped_column(String(32), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    project: Mapped["Project"] = relationship(back_populates="asset_links", overlaps="assets,projects")
    asset: Mapped["Asset"] = relationship(back_populates="project_links", overlaps="assets,projects")


# ---------------------------------------------------------------------------
# Look
# ---------------------------------------------------------------------------

class Look(Base):
    __tablename__ = "looks"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(String(32), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False, default="Untitled Look")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    style_tags: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string: ["urban", "casual"]
    board_position: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string: {x, y, width, height}
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    project: Mapped["Project"] = relationship(back_populates="looks")
    items: Mapped[list["LookItem"]] = relationship(back_populates="look", cascade="all, delete-orphan")
    shots: Mapped[list["Shot"]] = relationship(back_populates="look", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# LookItem
# ---------------------------------------------------------------------------

class LookItem(Base):
    __tablename__ = "look_items"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    look_id: Mapped[str] = mapped_column(String(32), ForeignKey("looks.id", ondelete="CASCADE"), nullable=False)
    asset_id: Mapped[str | None] = mapped_column(String(32), ForeignKey("assets.id", ondelete="SET NULL"), nullable=True)
    category: Mapped[str] = mapped_column(String(20), nullable=False, default="top")
    placeholder_desc: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    look: Mapped["Look"] = relationship(back_populates="items")
    asset: Mapped["Asset | None"] = relationship(back_populates="look_items")


# ---------------------------------------------------------------------------
# Shot
# ---------------------------------------------------------------------------

class Shot(Base):
    __tablename__ = "shots"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    look_id: Mapped[str] = mapped_column(String(32), ForeignKey("looks.id", ondelete="CASCADE"), nullable=False)
    content_id: Mapped[str | None] = mapped_column(String(32), ForeignKey("contents.id", ondelete="SET NULL"), nullable=True)
    type: Mapped[str] = mapped_column(String(10), nullable=False, default="image")  # image / video
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    parameters: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
    vendor: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="queued")
    adopted: Mapped[bool] = mapped_column(Boolean, default=False)
    canvas_position: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string: {x, y}
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    look: Mapped["Look"] = relationship(back_populates="shots")
    content: Mapped["Content | None"] = relationship(back_populates="shots")


# ---------------------------------------------------------------------------
# Content
# ---------------------------------------------------------------------------

class Content(Base):
    __tablename__ = "contents"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    look_id: Mapped[str] = mapped_column(String(32), ForeignKey("looks.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string: ["urban", "casual"]
    cover_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    shot_ids: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string: ["id1", "id2"]
    like_count: Mapped[int] = mapped_column(Integer, default=0)
    favorite_count: Mapped[int] = mapped_column(Integer, default=0)
    comment_count: Mapped[int] = mapped_column(Integer, default=0)
    published_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    look: Mapped["Look"] = relationship()
    shots: Mapped[list["Shot"]] = relationship(back_populates="content", foreign_keys="[Shot.content_id]")
    interactions: Mapped[list["Interaction"]] = relationship(back_populates="content", cascade="all, delete-orphan")
    tryon_tasks: Mapped[list["TryOnTask"]] = relationship(back_populates="content", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# Interaction
# ---------------------------------------------------------------------------

class Interaction(Base):
    __tablename__ = "interactions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    content_id: Mapped[str] = mapped_column(String(32), ForeignKey("contents.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # like / favorite / comment
    user_identifier: Mapped[str] = mapped_column(String(100), nullable=False, default="anonymous")
    comment_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    content: Mapped["Content"] = relationship(back_populates="interactions")


# ---------------------------------------------------------------------------
# TryOnTask
# ---------------------------------------------------------------------------

class TryOnTask(Base):
    __tablename__ = "tryon_tasks"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_uuid)
    content_id: Mapped[str] = mapped_column(String(32), ForeignKey("contents.id", ondelete="CASCADE"), nullable=False)
    user_photo_url: Mapped[str] = mapped_column(Text, nullable=False)
    result_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="queued")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    content: Mapped["Content"] = relationship(back_populates="tryon_tasks")
