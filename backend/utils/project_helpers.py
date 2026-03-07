"""共享的项目工具函数和常量"""
import json
import re
from pathlib import Path

from fastapi import HTTPException

from config import settings
from clients.comfyui import ImageClient

_PROJECT_ID_RE = re.compile(r"^[a-f0-9]{12}$")

SYSTEM_SETTINGS_FILE = Path(__file__).parent.parent / "system_settings.json"

# 需要解密的字段
_SECRET_FIELDS = {
    "llm_api_key", "image_api_key",
    "jimeng_image_access_key", "jimeng_image_secret_key",
    "jimeng_video_access_key", "jimeng_video_secret_key",
}

# system_settings.json 字段 → config.py (.env) 字段映射
_SYS_TO_ENV = {
    "llm_base_url": "LLM_BASE_URL",
    "llm_api_key": "LLM_API_KEY",
    "llm_model": "LLM_MODEL",
    "image_provider": "IMAGE_PROVIDER",
    "image_base_url": "IMAGE_BASE_URL",
    "image_api_key": "IMAGE_API_KEY",
    "image_model": "IMAGE_MODEL",
    "jimeng_image_access_key": "JIMENG_ACCESS_KEY_ID",
    "jimeng_image_secret_key": "JIMENG_SECRET_ACCESS_KEY",
    "tts_base_url": "TTS_BASE_URL",
    "sadtalker_base_url": "SADTALKER_BASE_URL",
}


def _load_system_settings() -> dict:
    if SYSTEM_SETTINGS_FILE.exists():
        try:
            data = json.loads(SYSTEM_SETTINGS_FILE.read_text("utf-8"))
            # 解密密钥字段
            from utils.crypto import decrypt
            for key in _SECRET_FIELDS:
                if key in data and data[key]:
                    data[key] = decrypt(data[key])
            return data
        except Exception:
            pass
    return {}


def get_effective_config(project_id: str | None = None) -> dict:
    """三层配置合并：项目 settings.json → system_settings.json → .env 默认值"""
    # Layer 3: .env defaults (lowest priority)
    result = {}
    for sys_key, env_key in _SYS_TO_ENV.items():
        result[sys_key] = getattr(settings, env_key, "")

    # Layer 2: system_settings.json
    sys_cfg = _load_system_settings()
    for key, val in sys_cfg.items():
        if val:  # 只覆盖非空值
            result[key] = val

    # Layer 1: project settings.json (highest priority)
    if project_id:
        settings_path = settings.PROJECTS_DIR / project_id / "settings.json"
        if settings_path.exists():
            try:
                proj = json.loads(settings_path.read_text())
                for key, val in proj.items():
                    if val:
                        result[key] = val
            except Exception:
                pass

    return result


def project_dir(project_id: str) -> Path:
    if not _PROJECT_ID_RE.match(project_id):
        raise HTTPException(404, "Project not found")
    p = settings.PROJECTS_DIR / project_id
    if not p.exists():
        raise HTTPException(404, "Project not found")
    return p


def validate_path_segment(segment: str, name: str = "path segment"):
    """校验路径片段不含目录遍历字符"""
    if not segment or ".." in segment or "/" in segment or "\\" in segment or "\x00" in segment:
        raise HTTPException(400, f"Invalid {name}")


def get_image_client(project_id: str | None = None) -> ImageClient:
    cfg = get_effective_config(project_id)
    return ImageClient(
        base_url=cfg.get("image_base_url", ""),
        api_key=cfg.get("image_api_key", ""),
        model=cfg.get("image_model", ""),
        provider=cfg.get("image_provider", "mock"),
        jimeng_ak=cfg.get("jimeng_image_access_key", ""),
        jimeng_sk=cfg.get("jimeng_image_secret_key", ""),
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
