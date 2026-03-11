#!/usr/bin/env python3
"""
Database initialization script.

Usage:
    python scripts/init_db.py           # Create tables
    python scripts/init_db.py --seed    # Create tables + insert seed data
    python scripts/init_db.py --reset   # Drop all tables and recreate
"""

import argparse
import sys
from pathlib import Path

# Ensure project root is on sys.path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

from src.backend.database import Base, SessionLocal, engine
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


def create_tables():
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
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
        # Check if seed project already exists
        existing = db.query(Project).filter_by(name="Spring Capsule Demo").first()
        if existing:
            print("Seed data already exists, skipping.")
            return

        project = Project(
            id="seed_project_001",
            name="Spring Capsule Demo",
            cover_url=None,
        )
        db.add(project)

        empty_project = Project(
            id="seed_project_002",
            name="New Drop Sandbox",
            cover_url=None,
        )
        db.add(empty_project)

        db.commit()
        print(f"Seed projects created: {project.name}, {empty_project.name}")
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
