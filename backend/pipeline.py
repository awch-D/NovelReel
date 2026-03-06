import json
import logging
from datetime import datetime
from pathlib import Path

from config import settings
from clients.llm import LLMClient
from clients.comfyui import ImageClient
from utils.chapter_split import split_chapters
from utils.json_repair import repair_json
from prompts.script import build_script_prompt, build_sd_prompt

logger = logging.getLogger(__name__)


def _project_dir(project_id: str) -> Path:
    return settings.PROJECTS_DIR / project_id


def _update_status(project_id: str, **kwargs):
    path = _project_dir(project_id) / "status.json"
    status = {}
    if path.exists():
        status = json.loads(path.read_text())
    if "created_at" not in status:
        status["created_at"] = datetime.now().isoformat()
    status.update(kwargs)
    path.write_text(json.dumps(status, ensure_ascii=False, indent=2))


async def run_pipeline(project_id: str):
    project = _project_dir(project_id)

    # 优先从 settings.json 读取模型配置，fallback 到 .env
    proj_settings = {}
    settings_path = project / "settings.json"
    if settings_path.exists():
        proj_settings = json.loads(settings_path.read_text())

    llm = LLMClient(
        proj_settings.get("llm_base_url") or settings.LLM_BASE_URL,
        proj_settings.get("llm_api_key") or settings.LLM_API_KEY,
        proj_settings.get("llm_model") or settings.LLM_MODEL,
    )

    image_provider = proj_settings.get("image_provider") or settings.IMAGE_PROVIDER
    img = ImageClient(
        base_url=proj_settings.get("image_base_url") or settings.IMAGE_BASE_URL,
        api_key=proj_settings.get("image_api_key") or settings.IMAGE_API_KEY,
        model=proj_settings.get("image_model") or settings.IMAGE_MODEL,
        provider=image_provider,
        jimeng_ak=proj_settings.get("jimeng_access_key") or settings.JIMENG_ACCESS_KEY_ID,
        jimeng_sk=proj_settings.get("jimeng_secret_key") or settings.JIMENG_SECRET_ACCESS_KEY,
    )

    try:
        _update_status(project_id, status="running", current_step="split_chapters", progress=0, error=None)

        # 1. Read novel and split chapters
        novel_text = (project / "novel.txt").read_text(encoding="utf-8")
        chapters = split_chapters(novel_text)
        logger.info("Split into %d chapters", len(chapters))

        # 2. Generate script for each chapter via LLM
        _update_status(project_id, current_step="generate_script", progress=10)
        all_characters = {}
        all_scenes = {}
        all_episodes = []

        for ch in chapters:
            messages = build_script_prompt(ch["content"], ch["index"])
            raw = await llm.chat(messages, json_mode=True)
            episode = repair_json(raw)

            # Collect characters and scenes (dedup by id)
            for c in episode.get("characters", []):
                all_characters[c["id"]] = c
            for s in episode.get("scenes", []):
                all_scenes[s["id"]] = s

            all_episodes.append(
                {
                    "episode": ch["index"],
                    "title": ch["title"],
                    "characters": episode.get("characters", []),
                    "scenes": episode.get("scenes", []),
                    "shots": episode.get("shots", []),
                }
            )

            pct = 10 + int(40 * ch["index"] / len(chapters))
            _update_status(project_id, progress=pct)

        # Save merged script
        script = {"episodes": all_episodes, "characters": list(all_characters.values()), "scenes": list(all_scenes.values())}
        script_path = project / "script.json"
        script_path.write_text(json.dumps(script, ensure_ascii=False, indent=2))
        logger.info("Script saved: %s", script_path)

        # 3. Generate character reference images
        _update_status(project_id, current_step="generate_characters", progress=50)
        chars_dir = project / "assets" / "characters"
        for cid, char in all_characters.items():
            char_dir = chars_dir / cid
            char_dir.mkdir(parents=True, exist_ok=True)
            prompt = f"character portrait, {char['appearance']}, white background, full body, anime style"
            try:
                await img.text2img(prompt, "lowres, blurry", char_dir / "ref.png")
            except Exception as e:
                logger.error("Failed to generate character %s: %s", cid, e)

        # 4. Generate scene reference images
        _update_status(project_id, current_step="generate_scenes", progress=60)
        scenes_dir = project / "assets" / "scenes"
        for sid, scene in all_scenes.items():
            scene_dir = scenes_dir / sid
            scene_dir.mkdir(parents=True, exist_ok=True)
            prompt = f"background art, {scene['description']}, anime style, no characters"
            try:
                await img.text2img(prompt, "lowres, blurry", scene_dir / "ref.png")
            except Exception as e:
                logger.error("Failed to generate scene %s: %s", sid, e)

        # 5. Generate frames for each shot
        _update_status(project_id, current_step="generate_frames", progress=70)
        total_shots = sum(len(ep["shots"]) for ep in all_episodes)
        done_shots = 0

        # Read settings
        settings_path = project / "settings.json"
        visual_style = "anime_cel"
        if settings_path.exists():
            proj_settings = json.loads(settings_path.read_text())
            visual_style = proj_settings.get("visual_style", "anime_cel")

        for ep in all_episodes:
            ep_dir = project / "frames" / f"episode_{ep['episode']}"
            ep_dir.mkdir(parents=True, exist_ok=True)

            for shot in ep["shots"]:
                shot_id = shot.get("shot_id", f"s{ep['episode']}_unknown")
                positive, negative = build_sd_prompt(shot, all_characters, all_scenes, style=visual_style)

                # Find character ref if available
                char_ids = shot.get("characters", [])
                ref_path = None
                if char_ids:
                    candidate = chars_dir / char_ids[0] / "ref.png"
                    if candidate.exists():
                        ref_path = candidate

                output = ep_dir / f"{shot_id}.png"
                try:
                    if ref_path:
                        await img.text2img_with_ref(positive, negative, ref_path, output)
                    else:
                        await img.text2img(positive, negative, output)
                except Exception as e:
                    logger.error("Failed to generate shot %s: %s", shot_id, e)

                done_shots += 1
                pct = 70 + int(30 * done_shots / max(total_shots, 1))
                _update_status(project_id, progress=pct)

        _update_status(project_id, status="completed", current_step="done", progress=100)
        logger.info("Pipeline completed for project %s", project_id)

    except Exception as e:
        logger.exception("Pipeline failed for project %s", project_id)
        _update_status(project_id, status="failed", error=str(e))
