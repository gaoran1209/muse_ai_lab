from src.backend.database import Base, SessionLocal, engine
from src.backend.models import Asset, Look, LookItem, Project
from src.backend.schemas import ShotGenerateRequest
from src.backend.services.generation_service import GenerationService
from src.backend.services.prompt_templates import render_shooting_prompt
from src.backend.services._helpers import dumps_json


def setup_function():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def test_render_shooting_prompt_uses_mode_specific_templates():
    background_prompt = render_shooting_prompt(
        action="change_background",
        look_name="City Look",
        look_description="都市通勤搭配",
        preset_description="城市街拍，自然光",
        custom_prompt="加一点电影感",
        reference_image_url=None,
        parameters={"mode": "blend"},
    )
    assert "快捷操作: 换背景 / 氛围融合" in background_prompt
    assert '"target_background": "城市街拍，自然光"' in background_prompt
    assert "补充创意要求: 加一点电影感" in background_prompt

    model_prompt = render_shooting_prompt(
        action="change_model",
        look_name="City Look",
        look_description="都市通勤搭配",
        preset_description="中性模特，极简高级感",
        custom_prompt=None,
        reference_image_url=None,
        parameters={"mode": "swap_face"},
    )
    assert "快捷操作: 换模特 / 原图换脸" in model_prompt
    assert '"description": "中性模特，极简高级感"' in model_prompt

    tryon_prompt = render_shooting_prompt(
        action="tryon",
        look_name="City Look",
        look_description="都市通勤搭配",
        preset_description=None,
        custom_prompt=None,
        reference_image_url="https://example.com/person.jpg",
        garment_sources=["图2的上衣", "图3的裤子"],
    )
    assert "快捷操作: TryOn" in tryon_prompt
    assert '"source_inputs": "图2的上衣，图3的裤子，穿到图1的人物身上"' in tryon_prompt


def test_create_shot_tryon_persists_reference_and_garment_inputs():
    db = SessionLocal()
    try:
        project = Project(name="P")
        db.add(project)
        db.flush()

        top_asset = Asset(
            project_id=project.id,
            url="https://example.com/top.jpg",
            thumbnail_url="https://example.com/top-thumb.jpg",
            category="product",
            tags=dumps_json({"category": "product", "subcategory": "top"}),
            original_filename="top.jpg",
        )
        bottom_asset = Asset(
            project_id=project.id,
            url="https://example.com/bottom.jpg",
            thumbnail_url="https://example.com/bottom-thumb.jpg",
            category="product",
            tags=dumps_json({"category": "product", "subcategory": "bottom"}),
            original_filename="bottom.jpg",
        )
        db.add_all([top_asset, bottom_asset])
        db.flush()

        look = Look(
            project_id=project.id,
            name="Look",
            description="适合都市内容分发的通勤搭配",
            style_tags=dumps_json(["urban"]),
        )
        db.add(look)
        db.flush()

        db.add_all(
            [
                LookItem(look_id=look.id, asset_id=top_asset.id, category="top", sort_order=0),
                LookItem(look_id=look.id, asset_id=bottom_asset.id, category="bottom", sort_order=1),
            ]
        )
        db.commit()

        response = GenerationService.create_shot(
            db,
            look.id,
            ShotGenerateRequest(
                action="tryon",
                reference_image_url="https://example.com/person.jpg",
                parameters={},
            ),
        )

        shot = GenerationService.get_shot(db, response.shot_id)
        assert shot.parameters is not None
        assert shot.parameters["input_images"] == [
            "https://example.com/person.jpg",
            "https://example.com/top.jpg",
            "https://example.com/bottom.jpg",
        ]
        assert "图2的上衣，图3的裤子，穿到图1的人物身上" in (shot.prompt or "")
    finally:
        db.close()
