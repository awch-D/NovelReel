"""共享的项目工具函数和常量"""
import json
from pathlib import Path

from fastapi import HTTPException

from config import settings
from clients.comfyui import ImageClient


def project_dir(project_id: str) -> Path:
    p = settings.PROJECTS_DIR / project_id
    if not p.exists():
        raise HTTPException(404, "Project not found")
    return p


def get_image_client(project_id: str | None = None) -> ImageClient:
    proj_settings = {}
    if project_id:
        settings_path = settings.PROJECTS_DIR / project_id / "settings.json"
        if settings_path.exists():
            proj_settings = json.loads(settings_path.read_text())

    image_provider = proj_settings.get("image_provider") or settings.IMAGE_PROVIDER
    return ImageClient(
        base_url=proj_settings.get("image_base_url") or settings.IMAGE_BASE_URL,
        api_key=proj_settings.get("image_api_key") or settings.IMAGE_API_KEY,
        model=proj_settings.get("image_model") or settings.IMAGE_MODEL,
        provider=image_provider,
        jimeng_ak=proj_settings.get("jimeng_access_key") or settings.JIMENG_ACCESS_KEY_ID,
        jimeng_sk=proj_settings.get("jimeng_secret_key") or settings.JIMENG_SECRET_ACCESS_KEY,
    )


def scan_candidates(asset_dir: Path, project_id: str, asset_type: str, asset_id: str) -> list[str]:
    if not asset_dir.exists():
        return []
    return [
        f"/api/projects/{project_id}/assets/{asset_type}/{asset_id}/{f.name}"
        for f in sorted(asset_dir.glob("*.png"))
        if f.name != "ref.png"
    ]


def scan_views(asset_dir: Path, project_id: str, asset_type: str, asset_id: str, view_keys: list[str]) -> tuple[dict, str]:
    views_dir = asset_dir / "views"
    views = {}
    if views_dir.exists():
        for key in view_keys:
            vf = views_dir / f"{key}.png"
            if vf.exists():
                views[key] = f"/api/projects/{project_id}/assets/{asset_type}/{asset_id}/views/{key}.png"

    generating_flag = asset_dir / "views" / ".generating"
    if generating_flag.exists():
        status = "generating"
    elif views:
        status = "done"
    else:
        status = "none"
    return views, status


def convert_script_to_frontend(raw: dict, project_id: str) -> dict:
    char_map = {c["id"]: c["name"] for c in raw.get("characters", [])}
    scene_map = {s["id"]: s for s in raw.get("scenes", [])}

    result = {}
    for ep in raw.get("episodes", []):
        ep_num = ep.get("episode", 1)
        ep_key = f"E{str(ep_num).zfill(2)}"

        scene_shots: dict[str, list] = {}
        for shot in ep.get("shots", []):
            sid = shot.get("scene_id", "unknown")
            scene_shots.setdefault(sid, []).append(shot)

        scenes = []
        for sid, shots in scene_shots.items():
            scene_info = scene_map.get(sid, {})
            converted_shots = []
            for shot in shots:
                char_names = [char_map.get(cid, cid) for cid in shot.get("characters", [])]
                dialogues = []
                for d in shot.get("dialogue", []):
                    dialogues.append({
                        "character": char_map.get(d.get("character", ""), d.get("character", "")),
                        "text": d.get("text", ""),
                        "emotion": d.get("emotion"),
                    })
                converted_shots.append({
                    "shot_id": shot.get("shot_id", ""),
                    "scene_id": sid,
                    "description": shot.get("description", ""),
                    "characters": char_names,
                    "location": scene_info.get("name", ""),
                    "dialogue": dialogues,
                    "camera": shot.get("camera"),
                    "vfx": shot.get("vfx"),
                    "duration": shot.get("duration"),
                })

            scenes.append({
                "scene_id": sid,
                "location": scene_info.get("name", sid),
                "time": "",
                "shots": converted_shots,
            })

        result[ep_key] = {
            "episode_id": ep_key,
            "label": ep.get("title", f"第{ep_num}集"),
            "scenes": scenes,
        }

    return result


# Prompt 模板常量
CHARACTER_VIEW_KEYS = ["front", "side", "back"]
SCENE_VIEW_KEYS = ["establishing", "eye_level", "extreme", "detail"]

CHARACTER_VIEW_PROMPTS = {
    "side": "character portrait, {appearance}, white background, full body, three-quarter view, side profile, anime style",
    "back": "character portrait, {appearance}, white background, full body, back view, rear perspective, anime style",
}

SCENE_VIEW_PROMPTS = {
    "eye_level": "background art, {description}, eye-level medium shot, horizontal composition, anime style, no characters",
    "extreme": "background art, {description}, dramatic extreme angle, strong perspective lines, anime style, no characters",
    "detail": "background art, {description}, close-up detail shot, environmental details, anime style, no characters",
}
