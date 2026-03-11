"""
Prompt templates and small render helpers for MUSE AI Lab business flows.
"""

from __future__ import annotations

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
) -> str:
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
