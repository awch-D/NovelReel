import json
import logging
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from config import settings
from prompts.script import build_sd_prompt
from utils.project_helpers import project_dir, get_image_client, validate_path_segment

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["frames"])


def _load_marks(ep_dir: Path) -> dict:
    marks_path = ep_dir / ".marks.json"
    if marks_path.exists():
        return json.loads(marks_path.read_text())
    return {}


def _save_marks(ep_dir: Path, marks: dict):
    (ep_dir / ".marks.json").write_text(json.dumps(marks, ensure_ascii=False, indent=2))


def _frame_status(ep_dir: Path, shot_id: str, marks: dict) -> str:
    if marks.get(shot_id):
        return "marked"
    if (ep_dir / f"{shot_id}.png").exists():
        return "generated"
    if (ep_dir / f"{shot_id}.generating").exists():
        return "generating"
    return "pending"


@router.get("/projects/{project_id}/frames/{episode}/{shot_id}")
async def get_frame(project_id: str, episode: str, shot_id: str):
    validate_path_segment(episode, "episode")
    validate_path_segment(shot_id, "shot_id")
    project = project_dir(project_id)
    frame = project / "frames" / episode / f"{shot_id}.png"
    if not frame.exists():
        raise HTTPException(404, "Frame not found")
    return FileResponse(frame, media_type="image/png")


@router.get("/projects/{project_id}/frames-list/{episode}")
async def get_frame_list(project_id: str, episode: str):
    validate_path_segment(episode, "episode")
    project = project_dir(project_id)
    ep_dir = project / "frames" / episode
    ep_dir.mkdir(parents=True, exist_ok=True)
    marks = _load_marks(ep_dir)

    # Get shot list from script
    script_path = project / "script.json"
    if not script_path.exists():
        return JSONResponse([])

    raw = json.loads(script_path.read_text())
    ep_key = episode.replace("episode_", "E").lstrip("E").lstrip("0") or "1"
    ep_data = raw.get(f"E{ep_key.zfill(2)}") or raw.get(f"E{ep_key}")
    if not ep_data:
        return JSONResponse([])

    shots = ep_data.get("shots", [])
    result = []
    for shot in shots:
        sid = shot.get("shot_id", "")
        status = _frame_status(ep_dir, sid, marks)
        url = f"/api/projects/{project_id}/frames/{episode}/{sid}" if (ep_dir / f"{sid}.png").exists() else None
        result.append({"shot_id": sid, "status": status, "url": url})
    return JSONResponse(result)


async def _regenerate_single_frame(project_id: str, episode: str, shot_id: str):
    project = settings.PROJECTS_DIR / project_id
    ep_dir = project / "frames" / episode
    ep_dir.mkdir(parents=True, exist_ok=True)
    flag = ep_dir / f"{shot_id}.generating"
    flag.touch()

    try:
        script_path = project / "script.json"
        raw = json.loads(script_path.read_text())
        all_characters = {c["id"]: c for c in raw.get("characters", [])}
        all_scenes = {s["id"]: s for s in raw.get("scenes", [])}

        ep_key = episode.replace("episode_", "E").lstrip("E").lstrip("0") or "1"
        ep_data = raw.get(f"E{ep_key.zfill(2)}") or raw.get(f"E{ep_key}") or {}
        shot = next((s for s in ep_data.get("shots", []) if s.get("shot_id") == shot_id), None)
        if not shot:
            logger.error("Shot %s not found in %s", shot_id, episode)
            return

        settings_path = project / "settings.json"
        visual_style = "anime_cel"
        if settings_path.exists():
            proj_settings = json.loads(settings_path.read_text())
            visual_style = proj_settings.get("visual_style", "anime_cel")

        positive, negative = build_sd_prompt(shot, all_characters, all_scenes, style=visual_style)

        char_ids = shot.get("characters", [])
        ref_path = None
        if char_ids:
            candidate = project / "assets" / "characters" / char_ids[0] / "ref.png"
            if candidate.exists():
                ref_path = candidate

        output = ep_dir / f"{shot_id}.png"
        img_client = get_image_client(project_id)
        if ref_path:
            await img_client.text2img_with_ref(positive, negative, ref_path, output)
        else:
            await img_client.text2img(positive, negative, output)
        logger.info("Regenerated frame %s/%s", episode, shot_id)
    except Exception:
        logger.exception("Failed to regenerate frame %s/%s", episode, shot_id)
    finally:
        flag.unlink(missing_ok=True)


@router.post("/projects/{project_id}/frames/{episode}/{shot_id}/regenerate")
async def regenerate_frame(project_id: str, episode: str, shot_id: str, bg: BackgroundTasks):
    validate_path_segment(episode, "episode")
    validate_path_segment(shot_id, "shot_id")
    project_dir(project_id)  # validate exists
    bg.add_task(_regenerate_single_frame, project_id, episode, shot_id)
    return {"status": "generating"}


class BatchRegenerateRequest(BaseModel):
    shot_ids: list[str]


@router.post("/projects/{project_id}/frames/{episode}/regenerate-batch")
async def regenerate_batch(project_id: str, episode: str, bg: BackgroundTasks, body: BatchRegenerateRequest):
    validate_path_segment(episode, "episode")
    project_dir(project_id)
    for sid in body.shot_ids:
        bg.add_task(_regenerate_single_frame, project_id, episode, sid)
    return {"status": "generating", "count": len(body.shot_ids)}


@router.post("/projects/{project_id}/frames/{episode}/generate")
async def generate_episode_frames(project_id: str, episode: str, bg: BackgroundTasks):
    validate_path_segment(episode, "episode")
    project = project_dir(project_id)
    ep_dir = project / "frames" / episode
    ep_dir.mkdir(parents=True, exist_ok=True)

    script_path = project / "script.json"
    if not script_path.exists():
        raise HTTPException(404, "Script not generated yet")

    raw = json.loads(script_path.read_text())
    ep_key = episode.replace("episode_", "E").lstrip("E").lstrip("0") or "1"
    ep_data = raw.get(f"E{ep_key.zfill(2)}") or raw.get(f"E{ep_key}")
    if not ep_data:
        raise HTTPException(404, f"Episode {episode} not found in script")

    count = 0
    for shot in ep_data.get("shots", []):
        sid = shot.get("shot_id", "")
        if not (ep_dir / f"{sid}.png").exists():
            bg.add_task(_regenerate_single_frame, project_id, episode, sid)
            count += 1
    return {"status": "generating", "count": count}


@router.put("/projects/{project_id}/frames/{episode}/{shot_id}/mark")
async def mark_frame(project_id: str, episode: str, shot_id: str):
    validate_path_segment(episode, "episode")
    validate_path_segment(shot_id, "shot_id")
    project = project_dir(project_id)
    ep_dir = project / "frames" / episode
    ep_dir.mkdir(parents=True, exist_ok=True)
    marks = _load_marks(ep_dir)
    marks[shot_id] = not marks.get(shot_id, False)
    _save_marks(ep_dir, marks)
    return {"shot_id": shot_id, "marked": marks[shot_id]}
