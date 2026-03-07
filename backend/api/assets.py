import json
import shutil
import logging
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from config import settings
from utils.project_helpers import (
    project_dir, get_image_client, scan_candidates, scan_views,
    validate_path_segment,
    CHARACTER_VIEW_KEYS, SCENE_VIEW_KEYS,
    CHARACTER_VIEW_PROMPTS, SCENE_VIEW_PROMPTS,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["assets"])


class SelectAssetRequest(BaseModel):
    image: str


@router.get("/projects/{project_id}/characters")
async def get_characters(project_id: str):
    project = project_dir(project_id)
    script_path = project / "script.json"
    if not script_path.exists():
        raise HTTPException(404, "Script not generated yet")
    raw = json.loads(script_path.read_text())
    characters = []
    for c in raw.get("characters", []):
        char_dir = project / "assets" / "characters" / c["id"]
        ref_path = char_dir / "ref.png"
        views, core_views_status = scan_views(char_dir, project_id, "characters", c["id"], CHARACTER_VIEW_KEYS)
        characters.append({
            "id": c["id"],
            "name": c["name"],
            "description": c.get("appearance", ""),
            "appearance": c.get("appearance", ""),
            "locked": ref_path.exists(),
            "reference_image": f"/api/projects/{project_id}/assets/characters/{c['id']}/ref.png" if ref_path.exists() else None,
            "candidates": scan_candidates(char_dir, project_id, "characters", c["id"]),
            "views": views,
            "core_views_status": core_views_status,
        })
    return JSONResponse(characters)


@router.get("/projects/{project_id}/scenes")
async def get_scenes(project_id: str):
    project = project_dir(project_id)
    script_path = project / "script.json"
    if not script_path.exists():
        raise HTTPException(404, "Script not generated yet")
    raw = json.loads(script_path.read_text())
    scenes = []
    for s in raw.get("scenes", []):
        scene_dir = project / "assets" / "scenes" / s["id"]
        ref_path = scene_dir / "ref.png"
        views, core_views_status = scan_views(scene_dir, project_id, "scenes", s["id"], SCENE_VIEW_KEYS)
        scenes.append({
            "id": s["id"],
            "name": s["name"],
            "description": s.get("description", ""),
            "locked": ref_path.exists(),
            "reference_image": f"/api/projects/{project_id}/assets/scenes/{s['id']}/ref.png" if ref_path.exists() else None,
            "candidates": scan_candidates(scene_dir, project_id, "scenes", s["id"]),
            "views": views,
            "core_views_status": core_views_status,
        })
    return JSONResponse(scenes)


@router.post("/projects/{project_id}/characters/{char_id}/regenerate")
async def regenerate_character(project_id: str, char_id: str):
    project = project_dir(project_id)
    script_path = project / "script.json"
    if not script_path.exists():
        raise HTTPException(404, "Script not generated yet")

    raw = json.loads(script_path.read_text())
    char = next((c for c in raw.get("characters", []) if c["id"] == char_id), None)
    if not char:
        raise HTTPException(404, f"Character {char_id} not found")

    char_dir = project / "assets" / "characters" / char_id
    char_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = char_dir / f"candidate_{timestamp}.png"

    prompt = f"character portrait, {char['appearance']}, white background, full body, anime style"
    img_client = get_image_client(project_id)
    await img_client.text2img(prompt, "lowres, blurry", output_path)

    image_url = f"/api/projects/{project_id}/assets/characters/{char_id}/{output_path.name}"
    return {"image": image_url}


@router.post("/projects/{project_id}/scenes/{scene_id}/regenerate")
async def regenerate_scene(project_id: str, scene_id: str):
    project = project_dir(project_id)
    script_path = project / "script.json"
    if not script_path.exists():
        raise HTTPException(404, "Script not generated yet")

    raw = json.loads(script_path.read_text())
    scene = next((s for s in raw.get("scenes", []) if s["id"] == scene_id), None)
    if not scene:
        raise HTTPException(404, f"Scene {scene_id} not found")

    scene_dir = project / "assets" / "scenes" / scene_id
    scene_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = scene_dir / f"candidate_{timestamp}.png"

    prompt = f"background art, {scene['description']}, anime style, no characters"
    img_client = get_image_client(project_id)
    await img_client.text2img(prompt, "lowres, blurry", output_path)

    image_url = f"/api/projects/{project_id}/assets/scenes/{scene_id}/{output_path.name}"
    return {"image": image_url}


@router.get("/projects/{project_id}/assets/{asset_type}/{asset_id}/candidates")
async def get_candidates(project_id: str, asset_type: str, asset_id: str):
    project = project_dir(project_id)
    asset_dir = project / "assets" / asset_type / asset_id
    candidates = scan_candidates(asset_dir, project_id, asset_type, asset_id)
    return {"candidates": candidates}


@router.post("/projects/{project_id}/assets/{asset_type}/{asset_id}/select")
async def select_asset(project_id: str, asset_type: str, asset_id: str, body: SelectAssetRequest):
    project = project_dir(project_id)
    asset_dir = project / "assets" / asset_type / asset_id
    source = asset_dir / body.image
    if not source.resolve().is_relative_to(asset_dir.resolve()):
        raise HTTPException(400, "Invalid image path")
    if not source.exists():
        raise HTTPException(404, f"Candidate {body.image} not found")
    ref_path = asset_dir / "ref.png"
    shutil.copy2(source, ref_path)
    return {"reference_image": f"/api/projects/{project_id}/assets/{asset_type}/{asset_id}/ref.png"}


@router.get("/projects/{project_id}/assets/{asset_type}/{asset_id}/views/{filename}")
async def get_asset_view_file(project_id: str, asset_type: str, asset_id: str, filename: str):
    validate_path_segment(filename, "filename")
    project = project_dir(project_id)
    file_path = project / "assets" / asset_type / asset_id / "views" / filename
    if not file_path.resolve().is_relative_to(project.resolve()):
        raise HTTPException(400, "Invalid path")
    if not file_path.exists():
        raise HTTPException(404, "View file not found")
    return FileResponse(file_path, media_type="image/png")


@router.get("/projects/{project_id}/assets/{asset_type}/{asset_id}/{filename}")
async def get_asset_file(project_id: str, asset_type: str, asset_id: str, filename: str):
    validate_path_segment(filename, "filename")
    project = project_dir(project_id)
    file_path = project / "assets" / asset_type / asset_id / filename
    if not file_path.resolve().is_relative_to(project.resolve()):
        raise HTTPException(400, "Invalid path")
    if not file_path.exists():
        raise HTTPException(404, "Asset file not found")
    return FileResponse(file_path, media_type="image/png")


# --- Generate core views ---

async def _generate_character_views(project_id: str, char_id: str, appearance: str):
    project = settings.PROJECTS_DIR / project_id
    char_dir = project / "assets" / "characters" / char_id
    views_dir = char_dir / "views"
    views_dir.mkdir(parents=True, exist_ok=True)
    flag = views_dir / ".generating"
    flag.touch()

    try:
        ref_path = char_dir / "ref.png"
        shutil.copy2(ref_path, views_dir / "front.png")

        img_client = get_image_client(project_id)
        for view_key, prompt_tpl in CHARACTER_VIEW_PROMPTS.items():
            prompt = prompt_tpl.format(appearance=appearance)
            output = views_dir / f"{view_key}.png"
            await img_client.text2img_with_ref(prompt, "lowres, blurry", ref_path, output)
            logger.info("Generated character view %s for %s", view_key, char_id)
    except Exception:
        logger.exception("Failed to generate character views for %s", char_id)
    finally:
        flag.unlink(missing_ok=True)


async def _generate_scene_views(project_id: str, scene_id: str, description: str):
    project = settings.PROJECTS_DIR / project_id
    scene_dir = project / "assets" / "scenes" / scene_id
    views_dir = scene_dir / "views"
    views_dir.mkdir(parents=True, exist_ok=True)
    flag = views_dir / ".generating"
    flag.touch()

    try:
        ref_path = scene_dir / "ref.png"
        shutil.copy2(ref_path, views_dir / "establishing.png")

        img_client = get_image_client(project_id)
        for view_key, prompt_tpl in SCENE_VIEW_PROMPTS.items():
            prompt = prompt_tpl.format(description=description)
            output = views_dir / f"{view_key}.png"
            await img_client.text2img_with_ref(prompt, "lowres, blurry", ref_path, output)
            logger.info("Generated scene view %s for %s", view_key, scene_id)
    except Exception:
        logger.exception("Failed to generate scene views for %s", scene_id)
    finally:
        flag.unlink(missing_ok=True)


@router.post("/projects/{project_id}/characters/{char_id}/generate-core-views")
async def generate_character_core_views(project_id: str, char_id: str, bg: BackgroundTasks):
    project = project_dir(project_id)
    script_path = project / "script.json"
    if not script_path.exists():
        raise HTTPException(404, "Script not generated yet")

    raw = json.loads(script_path.read_text())
    char = next((c for c in raw.get("characters", []) if c["id"] == char_id), None)
    if not char:
        raise HTTPException(404, f"Character {char_id} not found")

    char_dir = project / "assets" / "characters" / char_id
    ref_path = char_dir / "ref.png"
    if not ref_path.exists():
        raise HTTPException(400, "Reference image not found, lock the character first")

    bg.add_task(_generate_character_views, project_id, char_id, char.get("appearance", ""))
    return {"status": "generating"}


@router.post("/projects/{project_id}/scenes/{scene_id}/generate-core-views")
async def generate_scene_core_views(project_id: str, scene_id: str, bg: BackgroundTasks):
    project = project_dir(project_id)
    script_path = project / "script.json"
    if not script_path.exists():
        raise HTTPException(404, "Script not generated yet")

    raw = json.loads(script_path.read_text())
    scene = next((s for s in raw.get("scenes", []) if s["id"] == scene_id), None)
    if not scene:
        raise HTTPException(404, f"Scene {scene_id} not found")

    scene_dir = project / "assets" / "scenes" / scene_id
    ref_path = scene_dir / "ref.png"
    if not ref_path.exists():
        raise HTTPException(400, "Reference image not found, lock the scene first")

    bg.add_task(_generate_scene_views, project_id, scene_id, scene.get("description", ""))
    return {"status": "generating"}


# --- Props ---

@router.get("/projects/{project_id}/props")
async def get_props(project_id: str):
    project = project_dir(project_id)
    script_path = project / "script.json"
    if not script_path.exists():
        raise HTTPException(404, "Script not generated yet")
    raw = json.loads(script_path.read_text())
    props = []
    for p in raw.get("props", []):
        prop_dir = project / "assets" / "props" / p["id"]
        ref_path = prop_dir / "ref.png"
        props.append({
            "id": p["id"],
            "name": p["name"],
            "description": p.get("description", ""),
            "locked": ref_path.exists(),
            "reference_image": f"/api/projects/{project_id}/assets/props/{p['id']}/ref.png" if ref_path.exists() else None,
            "candidates": scan_candidates(prop_dir, project_id, "props", p["id"]),
        })
    return JSONResponse(props)


@router.post("/projects/{project_id}/props/{prop_id}/regenerate")
async def regenerate_prop(project_id: str, prop_id: str):
    project = project_dir(project_id)
    script_path = project / "script.json"
    if not script_path.exists():
        raise HTTPException(404, "Script not generated yet")

    raw = json.loads(script_path.read_text())
    prop = next((p for p in raw.get("props", []) if p["id"] == prop_id), None)
    if not prop:
        raise HTTPException(404, f"Prop {prop_id} not found")

    prop_dir = project / "assets" / "props" / prop_id
    prop_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = prop_dir / f"candidate_{timestamp}.png"

    prompt = f"item illustration, {prop['description']}, white background, detailed, anime style"
    img_client = get_image_client(project_id)
    await img_client.text2img(prompt, "lowres, blurry", output_path)

    image_url = f"/api/projects/{project_id}/assets/props/{prop_id}/{output_path.name}"
    return {"image": image_url}


# --- Upload candidate image ---

@router.post("/projects/{project_id}/assets/{asset_type}/{asset_id}/upload")
async def upload_candidate(project_id: str, asset_type: str, asset_id: str, file: UploadFile):
    if asset_type not in ("characters", "scenes", "props"):
        raise HTTPException(400, "Invalid asset type")
    validate_path_segment(asset_id, "asset_id")
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if file.filename else ""
    if ext not in ("png", "jpg", "jpeg", "webp"):
        raise HTTPException(400, "Only .png/.jpg/.jpeg/.webp files allowed")
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Only image files are allowed")
    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 20MB)")

    project = project_dir(project_id)
    asset_dir = project / "assets" / asset_type / asset_id
    asset_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = asset_dir / f"candidate_{timestamp}.png"
    output_path.write_bytes(content)

    image_url = f"/api/projects/{project_id}/assets/{asset_type}/{asset_id}/{output_path.name}"
    return {"image": image_url}


# --- Asset library (versioning) ---

@router.get("/projects/{project_id}/assets/{asset_type}/{asset_id}/library")
async def get_library(project_id: str, asset_type: str, asset_id: str):
    project = project_dir(project_id)
    lib_dir = project / "assets" / asset_type / asset_id / "library"
    versions = []
    if lib_dir.exists():
        for f in sorted(lib_dir.glob("v*.png")):
            versions.append({
                "version": f.stem,
                "url": f"/api/projects/{project_id}/assets/{asset_type}/{asset_id}/library/{f.name}",
            })
    return {"versions": versions}


@router.post("/projects/{project_id}/assets/{asset_type}/{asset_id}/library/save")
async def save_to_library(project_id: str, asset_type: str, asset_id: str):
    project = project_dir(project_id)
    asset_dir = project / "assets" / asset_type / asset_id
    ref_path = asset_dir / "ref.png"
    if not ref_path.exists():
        raise HTTPException(400, "No reference image to save")

    lib_dir = asset_dir / "library"
    lib_dir.mkdir(parents=True, exist_ok=True)
    existing = sorted(lib_dir.glob("v*.png"))
    next_num = len(existing) + 1
    dest = lib_dir / f"v{next_num}.png"
    shutil.copy2(ref_path, dest)
    return {"version": f"v{next_num}", "url": f"/api/projects/{project_id}/assets/{asset_type}/{asset_id}/library/{dest.name}"}


@router.post("/projects/{project_id}/assets/{asset_type}/{asset_id}/library/{version}/activate")
async def activate_version(project_id: str, asset_type: str, asset_id: str, version: str):
    project = project_dir(project_id)
    asset_dir = project / "assets" / asset_type / asset_id
    lib_dir = asset_dir / "library"
    version_file = lib_dir / f"{version}.png"
    if not version_file.exists():
        raise HTTPException(404, f"Version {version} not found")
    ref_path = asset_dir / "ref.png"
    shutil.copy2(version_file, ref_path)
    return {"reference_image": f"/api/projects/{project_id}/assets/{asset_type}/{asset_id}/ref.png"}


@router.get("/projects/{project_id}/assets/{asset_type}/{asset_id}/library/{filename}")
async def get_library_file(project_id: str, asset_type: str, asset_id: str, filename: str):
    validate_path_segment(filename, "filename")
    project = project_dir(project_id)
    file_path = project / "assets" / asset_type / asset_id / "library" / filename
    if not file_path.resolve().is_relative_to(project.resolve()):
        raise HTTPException(400, "Invalid path")
    if not file_path.exists():
        raise HTTPException(404, "Library file not found")
    return FileResponse(file_path, media_type="image/png")


# --- Unlock asset ---

@router.post("/projects/{project_id}/assets/{asset_type}/{asset_id}/unlock")
async def unlock_asset(project_id: str, asset_type: str, asset_id: str):
    project = project_dir(project_id)
    asset_dir = project / "assets" / asset_type / asset_id
    ref_path = asset_dir / "ref.png"
    if not ref_path.exists():
        raise HTTPException(400, "Asset is not locked")

    # Scan script to find affected episodes/shots
    script_path = project / "script.json"
    affected_episodes = set()
    affected_shots = 0
    if script_path.exists():
        raw = json.loads(script_path.read_text())
        for key, ep_data in raw.items():
            if not isinstance(ep_data, dict) or "shots" not in ep_data:
                continue
            for shot in ep_data.get("shots", []):
                refs = shot.get("characters", []) + [shot.get("scene", "")]
                if asset_id in refs:
                    affected_episodes.add(key)
                    affected_shots += 1

    ref_path.unlink()
    return {
        "affected_episodes": sorted(affected_episodes),
        "affected_shots": affected_shots,
    }


@router.get("/projects/{project_id}/assets/lock-status")
async def get_lock_status(project_id: str):
    project = project_dir(project_id)
    script_path = project / "script.json"
    if not script_path.exists():
        return {"all_locked": False, "unlocked": []}

    raw = json.loads(script_path.read_text())
    unlocked = []
    for c in raw.get("characters", []):
        ref = project / "assets" / "characters" / c["id"] / "ref.png"
        if not ref.exists():
            unlocked.append({"type": "characters", "id": c["id"], "name": c["name"]})
    for s in raw.get("scenes", []):
        ref = project / "assets" / "scenes" / s["id"] / "ref.png"
        if not ref.exists():
            unlocked.append({"type": "scenes", "id": s["id"], "name": s["name"]})
    for p in raw.get("props", []):
        ref = project / "assets" / "props" / p["id"] / "ref.png"
        if not ref.exists():
            unlocked.append({"type": "props", "id": p["id"], "name": p["name"]})

    return {"all_locked": len(unlocked) == 0, "unlocked": unlocked}
