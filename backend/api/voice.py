import json
import logging
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from config import settings
from clients.tts import TTSClient, MockTTSClient
from clients.lipsync import LipSyncClient, MockLipSyncClient
from utils.audio import merge_dialogues, get_audio_duration
from utils.project_helpers import project_dir, get_effective_config, validate_path_segment

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["voice"])


def _get_tts_client(project_id: str):
    cfg = get_effective_config(project_id)
    provider = cfg.get("image_provider", "mock")
    if provider == "mock":
        return MockTTSClient()
    tts_url = cfg.get("tts_base_url", "")
    return TTSClient(tts_url)


def _get_lipsync_client(project_id: str):
    cfg = get_effective_config(project_id)
    provider = cfg.get("image_provider", "mock")
    if provider == "mock":
        return MockLipSyncClient()
    url = cfg.get("sadtalker_base_url", "")
    return LipSyncClient(url)


def _voice_dir(project_id: str) -> Path:
    d = settings.PROJECTS_DIR / project_id / "voice"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _char_voice_dir(project_id: str, char_id: str) -> Path:
    d = _voice_dir(project_id) / "characters" / char_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def _episode_voice_dir(project_id: str, episode: str) -> Path:
    d = _voice_dir(project_id) / "episodes" / episode
    d.mkdir(parents=True, exist_ok=True)
    return d


# --- Character voice config ---

@router.get("/projects/{project_id}/voice/characters")
async def get_voice_characters(project_id: str):
    project = project_dir(project_id)
    script_path = project / "script.json"
    if not script_path.exists():
        return JSONResponse([])

    raw = json.loads(script_path.read_text())
    result = []
    for c in raw.get("characters", []):
        char_dir = _char_voice_dir(project_id, c["id"])
        config_path = char_dir / "config.json"
        config = {}
        if config_path.exists():
            config = json.loads(config_path.read_text())
        has_ref = (char_dir / "ref_audio.wav").exists()
        result.append({
            "id": c["id"],
            "name": c["name"],
            "has_ref_audio": has_ref,
            "ref_audio_url": f"/api/projects/{project_id}/voice/audio/characters/{c['id']}/ref_audio.wav" if has_ref else None,
            "config": config,
        })
    return JSONResponse(result)


class VoiceConfigUpdate(BaseModel):
    language: str = "zh"
    prompt_text: str = ""


@router.put("/projects/{project_id}/voice/characters/{char_id}")
async def update_voice_config(project_id: str, char_id: str, body: VoiceConfigUpdate):
    char_dir = _char_voice_dir(project_id, char_id)
    config = {"language": body.language, "prompt_text": body.prompt_text}
    (char_dir / "config.json").write_text(json.dumps(config, ensure_ascii=False, indent=2))
    return config


@router.post("/projects/{project_id}/voice/characters/{char_id}/upload-ref")
async def upload_ref_audio(project_id: str, char_id: str, file: UploadFile):
    validate_path_segment(char_id, "char_id")
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if file.filename else ""
    if ext not in ("wav", "mp3", "flac", "ogg"):
        raise HTTPException(400, "Only .wav/.mp3/.flac/.ogg files allowed")
    if not file.content_type or not file.content_type.startswith("audio/"):
        raise HTTPException(400, "Only audio files are allowed")
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 50MB)")
    char_dir = _char_voice_dir(project_id, char_id)
    (char_dir / "ref_audio.wav").write_bytes(content)
    return {"status": "ok"}


# --- Dialogues ---

def _extract_dialogues(project_id: str, episode: str) -> list[dict]:
    """Extract dialogue lines from script for an episode."""
    project = settings.PROJECTS_DIR / project_id
    script_path = project / "script.json"
    if not script_path.exists():
        return []

    raw = json.loads(script_path.read_text())
    ep_key = episode.replace("episode_", "E").lstrip("E").lstrip("0") or "1"
    ep_data = raw.get(f"E{ep_key.zfill(2)}") or raw.get(f"E{ep_key}")
    if not ep_data:
        # Try from episodes array
        for ep in raw.get("episodes", []):
            if str(ep.get("episode")) == ep_key:
                ep_data = ep
                break
    if not ep_data:
        return []

    lines = []
    for shot in ep_data.get("shots", []):
        shot_id = shot.get("shot_id", "")
        for i, d in enumerate(shot.get("dialogue", [])):
            line_id = f"{shot_id}_d{i}"
            lines.append({
                "line_id": line_id,
                "shot_id": shot_id,
                "char_id": d.get("character", ""),
                "text": d.get("text", ""),
                "emotion": d.get("emotion", "neutral"),
            })
    return lines


@router.get("/projects/{project_id}/voice/dialogues/{episode}")
async def get_dialogues(project_id: str, episode: str):
    validate_path_segment(episode, "episode")
    project_dir(project_id)
    lines = _extract_dialogues(project_id, episode)
    ep_dir = _episode_voice_dir(project_id, episode) / "lines"
    ep_dir.mkdir(parents=True, exist_ok=True)

    result = []
    for line in lines:
        audio_path = ep_dir / f"{line['line_id']}.wav"
        result.append({
            **line,
            "audio_url": f"/api/projects/{project_id}/voice/audio/episodes/{episode}/lines/{line['line_id']}.wav" if audio_path.exists() else None,
            "status": "done" if audio_path.exists() else "pending",
        })
    return JSONResponse(result)


@router.post("/projects/{project_id}/voice/dialogues/{line_id}/generate")
async def generate_single_tts(project_id: str, line_id: str):
    project = project_dir(project_id)
    script_path = project / "script.json"
    if not script_path.exists():
        raise HTTPException(404, "Script not found")

    # Find the line across all episodes
    raw = json.loads(script_path.read_text())
    target_line = None
    target_episode = None
    for ep in raw.get("episodes", []):
        for shot in ep.get("shots", []):
            for i, d in enumerate(shot.get("dialogue", [])):
                lid = f"{shot.get('shot_id', '')}_d{i}"
                if lid == line_id:
                    target_line = d
                    target_episode = f"episode_{ep['episode']}"
                    break

    if not target_line or not target_episode:
        raise HTTPException(404, f"Dialogue line {line_id} not found")

    char_id = target_line.get("character", "")
    char_dir = _char_voice_dir(project_id, char_id)
    ref_path = char_dir / "ref_audio.wav"
    config_path = char_dir / "config.json"
    config = {}
    if config_path.exists():
        config = json.loads(config_path.read_text())

    tts = _get_tts_client(project_id)
    wav_bytes = await tts.synthesize(
        text=target_line.get("text", ""),
        refer_wav_path=str(ref_path) if ref_path.exists() else None,
        prompt_text=config.get("prompt_text", ""),
        language=config.get("language", "zh"),
    )

    ep_dir = _episode_voice_dir(project_id, target_episode) / "lines"
    ep_dir.mkdir(parents=True, exist_ok=True)
    (ep_dir / f"{line_id}.wav").write_bytes(wav_bytes)

    return {"status": "done", "line_id": line_id}


@router.post("/projects/{project_id}/voice/episodes/{episode}/generate-all")
async def generate_all_tts(project_id: str, episode: str, bg: BackgroundTasks):
    project_dir(project_id)
    lines = _extract_dialogues(project_id, episode)
    if not lines:
        raise HTTPException(404, "No dialogues found")

    async def _generate_all():
        tts = _get_tts_client(project_id)
        ep_dir = _episode_voice_dir(project_id, episode) / "lines"
        ep_dir.mkdir(parents=True, exist_ok=True)

        for line in lines:
            output = ep_dir / f"{line['line_id']}.wav"
            if output.exists():
                continue
            char_dir = _char_voice_dir(project_id, line["char_id"])
            ref_path = char_dir / "ref_audio.wav"
            config_path = char_dir / "config.json"
            config = {}
            if config_path.exists():
                config = json.loads(config_path.read_text())
            try:
                wav_bytes = await tts.synthesize(
                    text=line["text"],
                    refer_wav_path=str(ref_path) if ref_path.exists() else None,
                    prompt_text=config.get("prompt_text", ""),
                    language=config.get("language", "zh"),
                )
                output.write_bytes(wav_bytes)
            except Exception as e:
                logger.error("TTS failed for %s: %s", line["line_id"], e)

    bg.add_task(_generate_all)
    return {"status": "generating", "count": len(lines)}


@router.post("/projects/{project_id}/voice/episodes/{episode}/merge")
async def merge_episode_dialogues(project_id: str, episode: str):
    project_dir(project_id)
    lines = _extract_dialogues(project_id, episode)
    ep_dir = _episode_voice_dir(project_id, episode)
    lines_dir = ep_dir / "lines"
    merged_dir = ep_dir / "merged"
    merged_dir.mkdir(parents=True, exist_ok=True)

    # Group by shot_id
    shot_lines: dict[str, list[Path]] = {}
    for line in lines:
        wav = lines_dir / f"{line['line_id']}.wav"
        if wav.exists():
            shot_lines.setdefault(line["shot_id"], []).append(wav)

    for shot_id, wavs in shot_lines.items():
        output = merged_dir / f"{shot_id}.wav"
        merge_dialogues(wavs, output, silence_ms=300)

    return {"status": "done", "merged_shots": len(shot_lines)}


@router.post("/projects/{project_id}/voice/lipsync/{shot_id}")
async def generate_lipsync(project_id: str, shot_id: str, bg: BackgroundTasks):
    project = project_dir(project_id)
    # Find episode for this shot
    script_path = project / "script.json"
    if not script_path.exists():
        raise HTTPException(404, "Script not found")

    raw = json.loads(script_path.read_text())
    target_ep = None
    target_shot = None
    for ep in raw.get("episodes", []):
        for shot in ep.get("shots", []):
            if shot.get("shot_id") == shot_id:
                target_ep = f"episode_{ep['episode']}"
                target_shot = shot
                break

    if not target_ep or not target_shot:
        raise HTTPException(404, f"Shot {shot_id} not found")

    ep_dir = _episode_voice_dir(project_id, target_ep)
    merged_audio = ep_dir / "merged" / f"{shot_id}.wav"
    if not merged_audio.exists():
        raise HTTPException(400, "Merged audio not found, run merge first")

    # Get character face image
    char_ids = target_shot.get("characters", [])
    face_image = None
    if char_ids:
        ref = project / "assets" / "characters" / char_ids[0] / "ref.png"
        if ref.exists():
            face_image = ref

    if not face_image:
        # Use frame as fallback
        frame = project / "frames" / target_ep / f"{shot_id}.png"
        if frame.exists():
            face_image = frame

    if not face_image:
        raise HTTPException(400, "No face image available")

    lipsync_dir = ep_dir / "lipsync"
    lipsync_dir.mkdir(parents=True, exist_ok=True)
    output = lipsync_dir / f"{shot_id}.mp4"

    async def _run():
        client = _get_lipsync_client(project_id)
        await client.generate(face_image, merged_audio, output)

    bg.add_task(_run)
    return {"status": "generating"}


@router.post("/projects/{project_id}/voice/test-tts")
async def test_tts(project_id: str):
    tts = _get_tts_client(project_id)
    ok = await tts.health_check()
    return {"ok": ok, "message": "TTS 服务连接成功" if ok else "TTS 服务无法连接"}


# --- Audio file serving ---

@router.get("/projects/{project_id}/voice/audio/{path:path}")
async def get_voice_audio(project_id: str, path: str):
    project = project_dir(project_id)
    file_path = project / "voice" / path
    if not file_path.resolve().is_relative_to(project.resolve()):
        raise HTTPException(400, "Invalid path")
    if not file_path.exists():
        raise HTTPException(404, "Audio file not found")
    media_type = "audio/wav" if file_path.suffix == ".wav" else "video/mp4"
    return FileResponse(file_path, media_type=media_type)
