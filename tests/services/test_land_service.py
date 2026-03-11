from src.backend.database import Base, SessionLocal, engine
from src.backend.models import Content, Interaction, Look, Project, Shot
from src.backend.schemas import CommentCreate, InteractionToggleRequest
from src.backend.services.land_service import LandService
from src.backend.services._helpers import dumps_json


def setup_function():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def test_toggle_like_and_comment_updates_counts():
    db = SessionLocal()
    try:
        project = Project(name="P")
        db.add(project)
        db.flush()

        look = Look(project_id=project.id, name="Look", style_tags=dumps_json(["minimal"]))
        db.add(look)
        db.flush()

        shot = Shot(look_id=look.id, type="image", status="completed", url="data:image/png;base64,abc")
        db.add(shot)
        db.flush()

        content = Content(
            look_id=look.id,
            title="T",
            tags=dumps_json(["minimal"]),
            shot_ids=dumps_json([shot.id]),
            cover_url=shot.url,
        )
        db.add(content)
        db.flush()
        shot.content_id = content.id
        db.commit()

        liked = LandService.toggle_interaction(
            db,
            content.id,
            "like",
            InteractionToggleRequest(user_identifier="user-1"),
        )
        assert liked.active is True
        assert liked.count == 1

        unliked = LandService.toggle_interaction(
            db,
            content.id,
            "like",
            InteractionToggleRequest(user_identifier="user-1"),
        )
        assert unliked.active is False
        assert unliked.count == 0

        comment = LandService.add_comment(
            db,
            content.id,
            CommentCreate(text="很好看", user_identifier="user-2"),
        )
        assert comment.comment_text == "很好看"

        refreshed = LandService.get_content_detail(db, content.id, "user-2")
        assert refreshed.comment_count == 1
        assert len(refreshed.comments) == 1
    finally:
        db.close()
