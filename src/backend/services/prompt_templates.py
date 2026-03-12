"""
Prompt templates and small render helpers for MUSE AI Lab business flows.
"""

from __future__ import annotations

from typing import Any

from src.backend.schemas import AssetTags

ASSET_TAGGING_PROMPT = """
You are tagging a fashion production asset for MUSE AI Lab.
Return strict JSON with keys:
category, subcategory, color, style, season, occasion.

Allowed category values: product, model, background, pose.
Allowed product subcategory values: top, bottom, dress, shoes, bag, accessory.

Infer the most likely values from filename and context. Use null when unknown.
""".strip()

OUTFIT_COMPLETE_PROMPT = """
You are a fashion stylist assembling a complete look from selected assets.
Return strict JSON with:
name, description, style_tags, items.
Each item must contain: category, match_reason, preferred_asset_hint, placeholder_desc.
Keep the output practical for a fashion content demo.
""".strip()

OUTFIT_GROUP_PROMPT = """
You are grouping selected fashion assets into multiple coordinated looks.
Return strict JSON with a looks array.
Each look must contain: name, description, style_tags, items.
""".strip()

SHOOTING_PROMPT = """
You are creating a concise image generation prompt for a fashion editorial shot.
Respect the requested action, preserve the look identity, and produce commercially usable content.
""".strip()

CONTENT_TITLE_PROMPT = """
You are writing a short fashion content title for Muse Land.
Return one title under 24 Chinese characters or 60 English characters.
""".strip()

CONTENT_DESC_PROMPT = """
You are writing a short fashion content caption for Muse Land.
Keep it social-friendly, concrete, and style-led. Return plain text only.
""".strip()

LAND_TRYON_PROMPT = """
You are generating a fashion try-on result for Muse Land.
Blend the user's reference photo with the published outfit and keep the scene commercially credible.
""".strip()

BACKGROUND_BLEND_EXTRACT_PROMPT = """
##角色与任务
你是一个专业的AI图像场景提取器。请分析背景参考，忽略任何前景主体，仅根据画面背景生成一句用于AI生图的纯场景中文提示词。

##核心规则
1. 严禁描述人物、动物或核心物件，只描述场景本身。
2. 输出必须同时覆盖环境描述、空间关系、光影氛围三类信息。
3. 仅输出一句中文长句，不要解释，不要 Markdown。
""".strip()


def _safe_text(value: str | None, fallback: str) -> str:
    stripped = (value or "").strip()
    return stripped or fallback


def _render_background_prompt(
    *,
    look_name: str,
    look_description: str | None,
    preset_description: str | None,
    custom_prompt: str | None,
    mode: str,
) -> str:
    target_background = _safe_text(preset_description, "基于选中背景预设生成的新场景")
    look_summary = _safe_text(look_description, "保留当前 Look 的人物主体、服装与整体构图")

    if mode == "replace":
        lines = [
            SHOOTING_PROMPT,
            "快捷操作: 换背景 / 精准替换",
            f"Look 名称: {look_name}",
            f"Look 描述: {look_summary}",
            "{",
            '  "task_description": "使用目标背景环境全面替换参考图背景。",',
            '  "generation_parameters": {',
            '    "core_action": "识别并移除参考图中的所有背景元素，仅保留主体人物，再将目标背景完整植入主体身后。",',
            f'    "target_background_scene": "{target_background}",',
            '    "hard_constraints": [',
            '      "严格保持人物的面部五官、发型、发色、身材体型和神态不变。",',
            '      "严格保持人物的服装、鞋子、材质和所有配饰细节不变。"',
            "    ],",
            '    "dynamic_constraints": {',
            '      "primary_goal": "默认尽可能保持原始姿势。",',
            '      "adaptation_condition": "若原姿势与新背景的空间透视或物理结构冲突，优先保证空间合理性。",',
            '      "allowed_adjustments": "允许对肢体动作和朝向做轻微调整，确保人物自然落地，避免贴纸感。"',
            "    },",
            '    "technical_blending": [',
            '      "根据目标背景的光源方向、强弱与色温对主体重新打光。",',
            '      "在人物与地面或物体接触处生成真实接触阴影。"',
            "    ]",
            "  }",
            "}",
        ]
    else:
        lines = [
            SHOOTING_PROMPT,
            "快捷操作: 换背景 / 氛围融合",
            f"Look 名称: {look_name}",
            f"Look 描述: {look_summary}",
            "请先执行以下静默背景反推规则，再按结果完成生成：",
            BACKGROUND_BLEND_EXTRACT_PROMPT,
            "{",
            '  "task": "移除原图背景，并根据反推得到的文字描述生成新环境。",',
            f'  "target_background": "{target_background}",',
            '  "directives": {',
            '    "action": "保留原图人物主体，将其置入新生成的背景场景中。",',
            '    "strict_keep": [',
            '      "人物的五官、发型和体型必须保持不变。",',
            '      "人物的服装、鞋子和配饰必须保持不变。"',
            "    ],",
            '    "adaptive_pose": "优先保持原姿势；若与新背景空间冲突，允许微调肢体动作和朝向，确保站姿或接触关系自然。",',
            '    "blending": "根据新背景的光源对人物重新打光，并生成真实接触阴影。"',
            "  }",
            "}",
        ]

    if custom_prompt:
        lines.append(f"补充创意要求: {custom_prompt.strip()}")
    return "\n".join(lines)


def _render_change_model_prompt(
    *,
    look_name: str,
    look_description: str | None,
    preset_description: str | None,
    custom_prompt: str | None,
    mode: str,
) -> str:
    target_model = _safe_text(preset_description, "目标模特特征以所选模特预设为准")
    look_summary = _safe_text(look_description, "保留当前 Look 的服装、构图与风格")

    if mode == "swap_face":
        lines = [
            SHOOTING_PROMPT,
            "快捷操作: 换模特 / 原图换脸",
            f"Look 名称: {look_name}",
            f"Look 描述: {look_summary}",
            "{",
            '  "task": "将参考图中人物的人脸替换为目标模特人脸。",',
            '  "target_face": {',
            f'    "description": "{target_model}"',
            "  },",
            '  "directives": {',
            '    "step_1_clear": "彻底移除原人物的面部五官、皮肤纹理和表情细节，仅保留头型与轮廓边界。",',
            '    "step_2_transfer": "以目标模特的人脸特征、神态和身份感为基准，在保留轮廓内重新生成完整脸部。",',
            '    "strict_keep_context": [',
            '      "必须保持原人物的发型、发色和头发边缘。",',
            '      "必须保持原人物的身体姿势、身材、服装和所有配饰。",',
            '      "必须保持原始背景环境。"',
            "    ],",
            '    "blending": "新脸部必须匹配原场景的环境光照、阴影与肤质过渡，确保接口自然。"',
            "  }",
            "}",
        ]
    else:
        lines = [
            SHOOTING_PROMPT,
            "快捷操作: 换模特 / 真人复刻",
            f"Look 名称: {look_name}",
            f"Look 描述: {look_summary}",
            "请先从参考图反推原图的构图、服装、姿势、环境，再结合目标模特特征执行高保真重绘。",
            "{",
            '  "SCENE_CONFIG": {',
            '    "composition": "反推参考图的景别、镜头距离与相机角度。",',
            '    "visual_style": "反推图像风格、色调、滤镜与整体氛围。",',
            '    "pose": "反推身体姿势、动作与画面氛围。",',
            '    "environment": "反推环境描述、空间关系与光影氛围。"',
            "  },",
            '  "FASHION_MANIFEST": {',
            '    "outfit": "按颜色、核心设计、款型、材质、品类结构描述原穿搭。",',
            '    "style_isolation": "仅将艺术风格与美学氛围应用于背景和服装，严禁改变面部或皮肤。",',
            '    "camera_device": "固定为 iPhone 手机拍摄，可补充抓拍、随手拍等真实感叙事。"',
            "  },",
            '  "IDENTITY_LOCK": {',
            '    "status": "MANDATORY",',
            '    "directive": "LITERAL 1:1 PIXEL-LEVEL IDENTITY TRANSFER",',
            f'    "target_model": "{target_model}",',
            '    "instruction": "锁定目标模特面部身份，不允许随意改脸或扭曲表情。",',
            '    "anchors": {',
            '      "expression": "允许凝视和微表情适应姿势，但身份感必须稳定。",',
            '      "hair": "发型发色与目标模特设定保持一致。",',
            '      "bone_structure_policy": "保留清晰骨相与面部阴影层次，避免文字驱动的人脸漂移。"',
            "    }",
            "  }",
            "}",
        ]

    if custom_prompt:
        lines.append(f"补充创意要求: {custom_prompt.strip()}")
    return "\n".join(lines)


def _render_tryon_prompt(
    *,
    look_name: str,
    look_description: str | None,
    custom_prompt: str | None,
    garment_sources: list[str],
    reference_image_url: str | None,
) -> str:
    source_inputs = "，".join(garment_sources) if garment_sources else "图2起为搭配组单品"
    lines = [
        SHOOTING_PROMPT,
        "快捷操作: TryOn",
        f"Look 名称: {look_name}",
        f"Look 描述: {_safe_text(look_description, '将搭配组服装高保真穿到参考人物身上')}",
        f"参考图: {_safe_text(reference_image_url, '图1 为用户选择的参考人物图')}",
        "{",
        '  "instruction": "High-Fidelity Garment Transfer with Environment Preservation",',
        '  "base_config": {',
        '    "anchor": "图1",',
        '    "target_elements": ["face", "hair", "background", "lighting_direction"],',
        '    "operation_mode": "pixel_level_consistency"',
        "  },",
        '  "garment_transfer_logic": {',
        f'    "source_inputs": "{source_inputs}，穿到图1的人物身上",',
        '    "color_policy": {',
        '      "mode": "STRICT_ALBEDO_LOCK",',
        '      "rule": "禁止根据环境光改变服装明度或色彩，强制保留来源图固有色。"',
        "    },",
        '    "geometric_policy": {',
        '      "mode": "1:1_silhouette_mapping",',
        '      "constraints": ["保持袖口或裤脚原始长度", "严禁改变廓形", "禁止自动缩短"]',
        "    },",
        '    "detail_fidelity": {',
        '      "level": "macro_recovery",',
        '      "required_elements": ["stitching_lines", "button_textures", "fabric_grain", "wash_details"]',
        "    }",
        "  },",
        '  "rendering_specs": {',
        '    "resolution": "2K",',
        '    "environmental_blend": "light_overlayer_only",',
        '    "zero_tolerance": ["hallucination", "color_drift", "facial_reshaping"]',
        "  }",
        "}",
    ]
    if custom_prompt:
        lines.append(f"补充创意要求: {custom_prompt.strip()}")
    return "\n".join(lines)


def render_asset_tagging_prompt(filename: str, category_hint: str | None = None) -> str:
    return (
        f"{ASSET_TAGGING_PROMPT}\n"
        f"Filename: {filename}\n"
        f"Category hint: {category_hint or 'unknown'}\n"
        "Return JSON only."
    )


def render_outfit_prompt(mode: str, summary: str) -> str:
    template = OUTFIT_GROUP_PROMPT if mode == "group" else OUTFIT_COMPLETE_PROMPT
    return f"{template}\nAsset summary:\n{summary}\nReturn JSON only."


def render_shooting_prompt(
    *,
    action: str,
    look_name: str,
    look_description: str | None,
    preset_description: str | None,
    custom_prompt: str | None,
    reference_image_url: str | None,
    parameters: dict[str, Any] | None = None,
    garment_sources: list[str] | None = None,
) -> str:
    params = parameters or {}
    mode = str(params.get("mode") or "").strip().lower()

    if action == "change_background":
        return _render_background_prompt(
            look_name=look_name,
            look_description=look_description,
            preset_description=preset_description,
            custom_prompt=custom_prompt,
            mode=mode,
        )

    if action == "change_model":
        return _render_change_model_prompt(
            look_name=look_name,
            look_description=look_description,
            preset_description=preset_description,
            custom_prompt=custom_prompt,
            mode=mode,
        )

    if action == "tryon":
        return _render_tryon_prompt(
            look_name=look_name,
            look_description=look_description,
            custom_prompt=custom_prompt,
            garment_sources=garment_sources or [],
            reference_image_url=reference_image_url,
        )

    lines = [
        SHOOTING_PROMPT,
        f"Action: {action}",
        f"Look name: {look_name}",
        f"Look description: {look_description or 'N/A'}",
    ]
    if preset_description:
        lines.append(f"Preset: {preset_description}")
    if custom_prompt:
        lines.append(f"Creative direction: {custom_prompt}")
    if reference_image_url:
        lines.append(f"Reference image URL: {reference_image_url}")
    return "\n".join(lines)


def render_content_title_prompt(look_name: str, style_tags: list[str]) -> str:
    return (
        f"{CONTENT_TITLE_PROMPT}\n"
        f"Look name: {look_name}\n"
        f"Style tags: {', '.join(style_tags) or 'fashion'}"
    )


def render_content_desc_prompt(look_name: str, description: str | None, style_tags: list[str]) -> str:
    return (
        f"{CONTENT_DESC_PROMPT}\n"
        f"Look name: {look_name}\n"
        f"Look description: {description or 'N/A'}\n"
        f"Style tags: {', '.join(style_tags) or 'fashion'}"
    )


def render_land_tryon_prompt(title: str, description: str | None, style_tags: list[str]) -> str:
    return (
        f"{LAND_TRYON_PROMPT}\n"
        f"Content title: {title}\n"
        f"Content description: {description or 'N/A'}\n"
        f"Style tags: {', '.join(style_tags) or 'fashion'}"
    )


def summarize_asset_tags(name: str, tags: AssetTags | None) -> str:
    if tags is None:
        return f"- {name}: no structured tags"
    fields = [
        f"category={tags.category}",
        f"subcategory={tags.subcategory or 'unknown'}",
        f"color={tags.color or 'unknown'}",
        f"style={tags.style or 'unknown'}",
        f"season={tags.season or 'unknown'}",
        f"occasion={tags.occasion or 'unknown'}",
    ]
    return f"- {name}: " + ", ".join(fields)
