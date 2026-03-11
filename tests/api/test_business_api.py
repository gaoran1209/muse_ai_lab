from fastapi.testclient import TestClient

from src.backend.database import Base, engine
from src.backend.main import app
from src.backend.services.provider_service import ImageService, LLMService, VideoService


client = TestClient(app)
ORIGINAL_LLM_GENERATE = LLMService.generate
ORIGINAL_IMAGE_GENERATE = ImageService.generate
ORIGINAL_VIDEO_GENERATE = VideoService.generate


def _fake_llm_generate(vendor: str, prompt: str, **kwargs):
    if "tagging a fashion production asset" in prompt:
        if "Filename: studio_background.png" in prompt:
            return {
                "success": True,
                "content": '{"category":"background","subcategory":null,"color":"beige","style":"minimal","season":"spring","occasion":"work"}',
                "vendor": vendor,
            }
        return {
            "success": True,
            "content": '{"category":"product","subcategory":"dress","color":"black","style":"minimal","season":"spring","occasion":"weekend"}',
            "vendor": vendor,
        }
    if "assembling a complete look" in prompt or "grouping selected fashion assets" in prompt:
        return {
            "success": True,
            "content": '{"name":"都市极简造型","description":"以简洁线条完成一组可发布的穿搭内容。","style_tags":["minimal","urban"]}',
            "vendor": vendor,
        }
    if "writing a short fashion content title" in prompt:
        return {"success": True, "content": "都市极简穿搭", "vendor": vendor}
    if "writing a short fashion content caption" in prompt:
        return {"success": True, "content": "一组可直接发布的都市极简内容。", "vendor": vendor}
    return {"success": True, "content": "ok", "vendor": vendor}


def _fake_image_generate(vendor: str, prompt: str, return_format: str = "base64", **kwargs):
    return {
        "success": True,
        "content": "ZmFrZS1pbWFnZQ==",
        "format": return_format,
        "vendor": vendor,
        "model": "mock-image",
    }


def _fake_video_generate(vendor: str, prompt: str, return_format: str = "base64", **kwargs):
    return {
        "success": True,
        "content": "ZmFrZS12aWRlbw==",
        "format": return_format,
        "vendor": vendor,
        "model": "mock-video",
    }


def setup_function():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    LLMService.generate = staticmethod(_fake_llm_generate)
    ImageService.generate = staticmethod(_fake_image_generate)
    VideoService.generate = staticmethod(_fake_video_generate)


def teardown_function():
    LLMService.generate = ORIGINAL_LLM_GENERATE
    ImageService.generate = ORIGINAL_IMAGE_GENERATE
    VideoService.generate = ORIGINAL_VIDEO_GENERATE


def test_full_business_flow():
    project_resp = client.post("/api/v1/projects", json={"name": "Demo Project"})
    assert project_resp.status_code == 201
    project = project_resp.json()

    rename_project_resp = client.patch(
        f"/api/v1/projects/{project['id']}",
        json={"name": "Renamed Demo Project"},
    )
    assert rename_project_resp.status_code == 200
    project = rename_project_resp.json()
    assert project["name"] == "Renamed Demo Project"

    upload_resp = client.post(
        f"/api/v1/projects/{project['id']}/assets",
        files=[
            ("files", ("black_dress.png", b"img-a", "image/png")),
            ("files", ("studio_background.png", b"img-b", "image/png")),
        ],
    )
    assert upload_resp.status_code == 201
    assets = upload_resp.json()
    assert len(assets) == 2

    list_assets_resp = client.get(f"/api/v1/projects/{project['id']}/assets")
    assert list_assets_resp.status_code == 200
    assert len(list_assets_resp.json()) == 2

    filtered_assets_resp = client.get(f"/api/v1/projects/{project['id']}/assets", params={"category": "product"})
    assert filtered_assets_resp.status_code == 200
    assert len(filtered_assets_resp.json()) == 1

    asset_update_resp = client.patch(
        f"/api/v1/assets/{assets[0]['id']}",
        json={
            "category": "product",
            "tags": {
                "category": "product",
                "subcategory": "dress",
                "color": "black",
                "style": "minimal",
                "season": "spring",
                "occasion": "weekend",
            },
        },
    )
    assert asset_update_resp.status_code == 200
    assert asset_update_resp.json()["tags"]["subcategory"] == "dress"

    looks_resp = client.post(
        f"/api/v1/projects/{project['id']}/looks/generate",
        json={"asset_ids": [assets[0]["id"]], "mode": "complete", "count": 2},
    )
    assert looks_resp.status_code == 201
    looks = looks_resp.json()["looks"]
    assert len(looks) == 2
    look_id = looks[0]["id"]

    list_looks_resp = client.get(f"/api/v1/projects/{project['id']}/looks")
    assert list_looks_resp.status_code == 200
    assert len(list_looks_resp.json()) == 2

    update_look_resp = client.patch(
        f"/api/v1/looks/{look_id}",
        json={
            "name": "改名后的 Look",
            "board_position": {"x": 10, "y": 20, "width": 300, "height": 400},
            "items": looks[0]["items"],
        },
    )
    assert update_look_resp.status_code == 200
    assert update_look_resp.json()["name"] == "改名后的 Look"

    image_shot_resp = client.post(
        f"/api/v1/looks/{look_id}/generate",
        json={"type": "image", "action": "custom", "custom_prompt": "editorial street"},
    )
    assert image_shot_resp.status_code == 200
    shot_id = image_shot_resp.json()["shot_id"]

    tryon_shot_resp = client.post(
        f"/api/v1/looks/{look_id}/generate",
        json={
            "type": "image",
            "action": "tryon",
            "reference_image_url": "https://example.com/person.jpg",
            "custom_prompt": "fit check",
        },
    )
    assert tryon_shot_resp.status_code == 200

    video_shot_resp = client.post(
        f"/api/v1/looks/{look_id}/generate",
        json={"type": "video", "action": "change_background", "preset_id": "scene_01"},
    )
    assert video_shot_resp.status_code == 200

    shot_detail_resp = client.get(f"/api/v1/shots/{shot_id}")
    assert shot_detail_resp.status_code == 200
    shot = shot_detail_resp.json()
    assert shot["status"] in {"completed", "queued", "processing"}
    assert shot["content_id"] is None

    project_shots_resp = client.get(f"/api/v1/projects/{project['id']}/shots")
    assert project_shots_resp.status_code == 200
    assert {item["id"] for item in project_shots_resp.json()} >= {shot_id}

    adopt_resp = client.patch(f"/api/v1/shots/{shot_id}/adopt", json={"adopted": True})
    assert adopt_resp.status_code == 200
    assert adopt_resp.json()["adopted"] is True

    duplicate_project_resp = client.post(f"/api/v1/projects/{project['id']}/duplicate")
    assert duplicate_project_resp.status_code == 201
    duplicate_project = duplicate_project_resp.json()
    assert duplicate_project["name"].endswith("Copy")
    assert duplicate_project["asset_count"] == len(assets)
    assert duplicate_project["look_count"] == len(looks)

    duplicate_assets_resp = client.get(f"/api/v1/projects/{duplicate_project['id']}/assets")
    assert duplicate_assets_resp.status_code == 200
    assert len(duplicate_assets_resp.json()) == 2

    duplicate_looks_resp = client.get(f"/api/v1/projects/{duplicate_project['id']}/looks")
    assert duplicate_looks_resp.status_code == 200
    duplicate_looks = duplicate_looks_resp.json()
    assert len(duplicate_looks) == 2
    assert len(duplicate_looks[0]["items"]) == len(looks[0]["items"])

    duplicate_shots_resp = client.get(f"/api/v1/projects/{duplicate_project['id']}/shots")
    assert duplicate_shots_resp.status_code == 200
    assert len(duplicate_shots_resp.json()) == 3

    content_resp = client.post(
        "/api/v1/contents",
        json={
            "look_id": look_id,
            "shot_ids": [shot_id],
            "title": "",
            "description": "",
            "tags": ["minimal", "urban"],
        },
    )
    assert content_resp.status_code == 201
    content = content_resp.json()

    spark_content_resp = client.get(f"/api/v1/contents/{content['id']}")
    assert spark_content_resp.status_code == 200
    assert spark_content_resp.json()["shots"][0]["id"] == shot_id

    refreshed_project_shots_resp = client.get(f"/api/v1/projects/{project['id']}/shots")
    assert refreshed_project_shots_resp.status_code == 200
    refreshed_shot = next(item for item in refreshed_project_shots_resp.json() if item["id"] == shot_id)
    assert refreshed_shot["content_id"] == content["id"]

    feed_resp = client.get("/api/v1/land/feed", params={"tag": "minimal", "page": 1, "limit": 10})
    assert feed_resp.status_code == 200
    assert feed_resp.json()["total"] == 1

    detail_resp = client.get(f"/api/v1/land/contents/{content['id']}", params={"user_identifier": "u-1"})
    assert detail_resp.status_code == 200
    assert detail_resp.json()["user_liked"] is False

    like_resp = client.post(f"/api/v1/land/contents/{content['id']}/like", json={"user_identifier": "u-1"})
    assert like_resp.status_code == 200
    assert like_resp.json()["active"] is True

    unlike_resp = client.post(f"/api/v1/land/contents/{content['id']}/like", json={"user_identifier": "u-1"})
    assert unlike_resp.status_code == 200
    assert unlike_resp.json()["active"] is False

    favorite_resp = client.post(
        f"/api/v1/land/contents/{content['id']}/favorite",
        json={"user_identifier": "u-1"},
    )
    assert favorite_resp.status_code == 200
    assert favorite_resp.json()["active"] is True

    comment_resp = client.post(
        f"/api/v1/land/contents/{content['id']}/comment",
        json={"text": "很适合通勤", "user_identifier": "u-1"},
    )
    assert comment_resp.status_code == 201
    assert comment_resp.json()["comment_text"] == "很适合通勤"

    tryon_resp = client.post(
        f"/api/v1/land/contents/{content['id']}/tryon",
        json={"user_photo_url": "https://example.com/me.jpg"},
    )
    assert tryon_resp.status_code == 202
    tryon_task = tryon_resp.json()

    tryon_detail_resp = client.get(f"/api/v1/land/tryon/{tryon_task['id']}")
    assert tryon_detail_resp.status_code == 200
    assert tryon_detail_resp.json()["status"] in {"completed", "queued", "processing"}

    promote_resp = client.get(f"/api/v1/land/contents/{content['id']}/promote")
    assert promote_resp.status_code == 200
    assert content["id"] in promote_resp.json()["promote_url"]

    delete_asset_resp = client.delete(f"/api/v1/assets/{assets[1]['id']}")
    assert delete_asset_resp.status_code == 204

    delete_look_resp = client.delete(f"/api/v1/looks/{looks[1]['id']}")
    assert delete_look_resp.status_code == 204

    delete_project_resp = client.delete(f"/api/v1/projects/{project['id']}")
    assert delete_project_resp.status_code == 204
