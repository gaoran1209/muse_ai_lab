#!/usr/bin/env python3
"""
Database initialization script.

Usage:
    python scripts/init_db.py           # Create tables
    python scripts/init_db.py --seed    # Create tables + insert seed data
    python scripts/init_db.py --reset   # Drop all tables and recreate
"""

import argparse
import json
import sys
from pathlib import Path

# Ensure project root is on sys.path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

from src.backend.database import Base, SessionLocal, create_tables as ensure_tables, engine
from src.backend.models import (
    Asset,
    Content,
    Interaction,
    Look,
    LookItem,
    Project,
    ProjectAsset,
    Shot,
    TryOnTask,
)
from src.backend.schemas import AssetTags
from src.backend.services._helpers import dumps_json


SEED_PROJECT_ID = "seed_project_001"
SEED_PROJECT_NAME = "Spring Capsule Demo"
SEED_ASSET_FILE = project_root / "data" / "seed" / "assets_seed_v0.1.json"


def _seed_asset_tags(record: dict) -> str | None:
    category = record.get("category") or "product"
    tag_value = record.get("tags")
    subcategory = None
    if category == "product":
        mapping = {
            "dress": "dress",
            "skirt": "bottom",
            "top": "top",
            "shirt": "top",
            "tee": "top",
        }
        normalized = str(tag_value or "").strip().lower()
        subcategory = mapping.get(normalized)

    payload = AssetTags(
        category=category,
        subcategory=subcategory,
        style=record.get("style"),
        season=record.get("season"),
        occasion=record.get("occasion"),
    )
    return dumps_json(payload.model_dump())


def seed_assets_for_project(db, project_id: str) -> int:
    if not SEED_ASSET_FILE.exists():
        print(f"Seed asset file not found: {SEED_ASSET_FILE}")
        return 0

    with SEED_ASSET_FILE.open(encoding="utf-8") as handle:
        records = json.load(handle)

    existing_by_url = {
        asset.url: asset
        for asset in db.query(Asset).filter(Asset.library_scope == "public").all()
    }

    created = 0
    for record in records:
        url = record.get("url")
        if not url:
            continue

        asset = existing_by_url.get(url)
        if asset is None:
            asset = Asset(
                project_id=project_id,
                url=url,
                thumbnail_url=url,
                category=record.get("category") or "product",
                tags=_seed_asset_tags(record),
                original_filename=record.get("display_name"),
                library_scope="public",
                owner_user_id=None,
                source_type="seed",
                storage_provider="oss" if str(url).startswith("http") else "local",
                storage_key=None,
                status="active",
            )
            db.add(asset)
            db.flush()
            existing_by_url[url] = asset
            created += 1

        linked = (
            db.query(ProjectAsset)
            .filter(ProjectAsset.project_id == project_id, ProjectAsset.asset_id == asset.id)
            .first()
        )
        if linked is None:
            db.add(ProjectAsset(project_id=project_id, asset_id=asset.id))

    return created


def create_tables():
    print("Creating tables...")
    ensure_tables()
    print("Tables created:")
    for table_name in Base.metadata.tables:
        print(f"  - {table_name}")


def drop_tables():
    print("Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("All tables dropped.")


def insert_seed_data():
    """Insert minimal seed data for demo/testing."""
    print("Inserting seed data...")
    db = SessionLocal()
    try:
        project = db.query(Project).filter_by(id=SEED_PROJECT_ID).first()
        if project is None:
            project = Project(
                id=SEED_PROJECT_ID,
                name=SEED_PROJECT_NAME,
                cover_url=None,
            )
            db.add(project)

        empty_project = db.query(Project).filter_by(id="seed_project_002").first()
        if empty_project is None:
            empty_project = Project(
                id="seed_project_002",
                name="New Drop Sandbox",
                cover_url=None,
            )
            db.add(empty_project)

        db.flush()
        created_assets = seed_assets_for_project(db, project.id)
        db.commit()
        print(
            f"Seed ready: {project.name} (+{created_assets} assets), {empty_project.name}"
        )
    except Exception as e:
        db.rollback()
        print(f"Error inserting seed data: {e}")
        raise
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Initialize MUSE AI Lab database")
    parser.add_argument("--seed", action="store_true", help="Insert seed data after creating tables")
    parser.add_argument("--reset", action="store_true", help="Drop all tables before creating")
    args = parser.parse_args()

    if args.reset:
        drop_tables()

    create_tables()

    if args.seed:
        insert_seed_data()

    print("Done.")


if __name__ == "__main__":
    main()
