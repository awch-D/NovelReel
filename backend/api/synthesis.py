import json
import logging
import shutil
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from config import settings
from utils.project_helpers import project_dir
from utils.ffmpeg import (
    image_to_video, overlay_lipsync, mix_audio, apply_vfx,
    concat_clips, mix_bgm, burn_subtitles, generate_srt,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["synthesis"])


def _synthesis_dir(project_id: str) -> Path:
    d = settings.PROJECTS_DIR / project_id / "synthesis"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _load_synthesis_settings(project_id: str) -> dict:
    path = _synthesis_dir(project_id) / "settings.json"
    if path.exists():
        return json.loads(path.read_text())
    return {"bgm": None, "bgm_volume": 0.15, "subtitles": True, "font_size": 24}


class SynthesisSettingsUpdate(BaseModel):
    bgm: str | None = None
    bgm_volume: float = 0.15
    subtitles: bool = True
    font_size: int = 24


@router.put("/projects/{project_id}/synthesis/settings")
async def update_synthesis_settings(project_id: str, body: SynthesisSettingsUpdate):
    project_dir(project_id)
    path = _synthesis_dir(project_id) / "settings.json"
    data = body.model_dump()
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    return data


@router.get("/projects/{project_id}/synthesis/settings")
async def get_synthesis_settings(project_id: str):
    project_dir(project_id)
    return JSONResponse(_load_synthesis_settings(project_id))


@router.get("/projects/{project_id}/synthesis/status")
async def get_synthesis_status(project_id: str):
    project = project_dir(project_id)
    syn_dir = _synthesis_dir(project_id)
    status_path = syn_dir / "status.json"
    if status_path.exists():
        return JSONResponse(json.loads(status_path.read_text()))

    # Scan for completed episodes
    script_path = project / "script.json"
    if not script_path.exists():
        return JSONResponse({"episodes": []})

    raw = json.loads(script_path.read_text())
    episodes = []
    for ep in raw.get("episodes", []):
        ep_key = f"episode_{ep['episode']}"
        output = syn_dir / f"{ep_key}.mp4"
        episodes.append({
            "episode": ep_key,
            "status": "done" if output.exists() else "pending",
            "url": f"/api/projects/{project_id}/synthesis/output/{ep_key}.mp4" if output.exists() else None,
        })
    return JSONResponse({"episodes": episodes})


async def _assemble_episode(project_id: str, episode: str):
    """Assemble a single episode video."""
    project = project_dir(project_id)
    syn_dir = _synthesis_dir(project_id)
    syn_settings = _load_synthesis_settings(project_id)

    script_path = project / "script.json"
    if not script_path.exists():
        return

    raw = json.loads(script_path.read_text())
    ep_num = episode.replace("episode_", "")
    ep_data = None
    for ep in raw.get("episodes", []):
        if str(ep.get("episode")) == ep_num:
            ep_data = ep
            break
    if not ep_data:
        return

    frames_dir = project / "frames" / episode
    voice_dir = project / "voice" / "episodes" / episode
    work_dir = syn_dir / episode
    work_dir.mkdir(parents=True, exist_ok=True)

    clips = []
    all_dialogues = []
    time_offset = 0.0

    for shot in ep_data.get("shots", []):
        shot_id = shot.get("shot_id", "")
        frame = frames_dir / f"{shot_id}.png"
        if not frame.exists():
            continue

        duration = shot.get("duration", 4.0)
        shot_clip = work_dir / f"{shot_id}_base.mp4"

        # Step 1: Image → video
        image_to_video(frame, duration, shot_clip)

        current = shot_clip

        # Step 2: Overlay lipsync if available
        lipsync_file = voice_dir / "lipsync" / f"{shot_id}.mp4"
        if lipsync_file.exists():
            lip_out = work_dir / f"{shot_id}_lip.mp4"
            overlay_lipsync(current, lipsync_file, lip_out)
            current = lip_out

        # Step 3: Mix dialogue audio if available
        merged_audio = voice_dir / "merged" / f"{shot_id}.wav"
        if merged_audio.exists():
            audio_out = work_dir / f"{shot_id}_audio.mp4"
            mix_audio(current, merged_audio, audio_out)
            current = audio_out

        # Step 4: VFX
        vfx = shot.get("vfx")
        if vfx:
            vfx_out = work_dir / f"{shot_id}_vfx.mp4"
            apply_vfx(current, vfx, vfx_out)
            current = vfx_out

        clips.append(current)

        # Collect dialogues for subtitles
        for d in shot.get("dialogue", []):
            all_dialogues.append({
                "character": d.get("character", ""),
                "text": d.get("text", ""),
                "start_time": time_offset,
                "duration": duration / max(len(shot.get("dialogue", [])), 1),
            })
            time_offset += duration / max(len(shot.get("dialogue", [])), 1)

        time_offset = max(time_offset, time_offset)

    if not clips:
        return

    # Step 5: Concat all clips
    concat_out = work_dir / "concat.mp4"
    concat_clips(clips, concat_out)
    current = concat_out

    # Step 6: Mix BGM
    bgm_path = syn_settings.get("bgm")
    if bgm_path:
        bgm_file = Path(bgm_path) if Path(bgm_path).is_absolute() else settings.PROJECTS_DIR / project_id / bgm_path
        if bgm_file.exists():
            bgm_out = work_dir / "bgm.mp4"
            mix_bgm(current, bgm_file, bgm_out, volume=syn_settings.get("bgm_volume", 0.15))
            current = bgm_out

    # Step 7: Subtitles
    if syn_settings.get("subtitles") and all_dialogues:
        srt_path = work_dir / "subtitles.srt"
        generate_srt(all_dialogues, srt_path)
        sub_out = work_dir / "subtitled.mp4"
        burn_subtitles(current, srt_path, sub_out, font_size=syn_settings.get("font_size", 24))
        current = sub_out

    # Final output
    final = syn_dir / f"{episode}.mp4"
    shutil.copy2(current, final)
    logger.info("Episode %s assembled: %s", episode, final)


@router.post("/projects/{project_id}/synthesis/episodes/{episode}/assemble")
async def assemble_episode(project_id: str, episode: str, bg: BackgroundTasks):
    project_dir(project_id)
    bg.add_task(_assemble_episode, project_id, episode)
    return {"status": "assembling", "episode": episode}


@router.post("/projects/{project_id}/synthesis/assemble-all")
async def assemble_all(project_id: str, bg: BackgroundTasks):
    project = project_dir(project_id)
    script_path = project / "script.json"
    if not script_path.exists():
        raise HTTPException(404, "Script not found")

    raw = json.loads(script_path.read_text())
    episodes = [f"episode_{ep['episode']}" for ep in raw.get("episodes", [])]

    for ep in episodes:
        bg.add_task(_assemble_episode, project_id, ep)

    return {"status": "assembling", "count": len(episodes)}


@router.get("/projects/{project_id}/synthesis/episodes/{episode}/preview")
async def preview_episode(project_id: str, episode: str):
    syn_dir = _synthesis_dir(project_id)
    video = syn_dir / f"{episode}.mp4"
    if not video.exists():
        raise HTTPException(404, "Video not found, run assemble first")
    return FileResponse(video, media_type="video/mp4")


@router.get("/projects/{project_id}/synthesis/output/{filename}")
async def get_output_file(project_id: str, filename: str):
    syn_dir = _synthesis_dir(project_id)
    file_path = syn_dir / filename
    if not file_path.resolve().is_relative_to(syn_dir.resolve()):
        raise HTTPException(400, "Invalid path")
    if not file_path.exists():
        raise HTTPException(404, "File not found")
    media = "video/mp4" if file_path.suffix == ".mp4" else "audio/wav"
    return FileResponse(file_path, media_type=media)


@router.post("/projects/{project_id}/synthesis/bgm/upload")
async def upload_bgm(project_id: str, file: UploadFile):
    if not file.content_type or not file.content_type.startswith("audio/"):
        raise HTTPException(400, "Only audio files allowed")
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 50MB)")
    bgm_dir = _synthesis_dir(project_id) / "bgm"
    bgm_dir.mkdir(parents=True, exist_ok=True)
    dest = bgm_dir / (file.filename or "custom.mp3")
    dest.write_bytes(content)
    return {"path": f"synthesis/bgm/{dest.name}", "name": dest.name}


@router.get("/projects/{project_id}/synthesis/bgm/list")
async def list_bgm(project_id: str):
    project_dir(project_id)
    bgm_dir = _synthesis_dir(project_id) / "bgm"
    result = []
    # Project-uploaded BGM
    if bgm_dir.exists():
        for f in sorted(bgm_dir.iterdir()):
            if f.suffix in (".mp3", ".wav", ".ogg"):
                result.append({
                    "name": f.stem,
                    "path": f"synthesis/bgm/{f.name}",
                    "url": f"/api/projects/{project_id}/synthesis/output/bgm/{f.name}",
                })
    return JSONResponse(result)


@router.get("/projects/{project_id}/synthesis/bgm/presets")
async def list_bgm_presets(project_id: str):
    project_dir(project_id)
    result = []
    bgm_dir = settings.BGM_DIR
    if bgm_dir.exists():
        for category in sorted(bgm_dir.iterdir()):
            if category.is_dir():
                for f in sorted(category.iterdir()):
                    if f.suffix in (".mp3", ".wav", ".ogg"):
                        result.append({
                            "name": f.stem,
                            "category": category.name,
                            "path": str(f),
                            "url": f"/api/projects/{project_id}/synthesis/output/presets/{category.name}/{f.name}",
                        })
    return JSONResponse(result)
