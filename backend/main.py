import json
import shutil
import uuid
import logging
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, UploadFile, Form, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel

from config import settings
from pipeline import run_pipeline
from clients.comfyui import ImageClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
app = FastAPI(title="Novel2Toon", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _project_dir(project_id: str) -> Path:
    p = settings.PROJECTS_DIR / project_id
    if not p.exists():
        raise HTTPException(404, "Project not found")
    return p


def _get_image_client(project_id: str | None = None) -> ImageClient:
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


def _scan_candidates(asset_dir: Path, project_id: str, asset_type: str, asset_id: str) -> list[str]:
    """扫描资产目录下所有 png 文件，返回 URL 列表"""
    if not asset_dir.exists():
        return []
    return [
        f"/api/projects/{project_id}/assets/{asset_type}/{asset_id}/{f.name}"
        for f in sorted(asset_dir.glob("*.png"))
        if f.name != "ref.png"
    ]


class SelectAssetRequest(BaseModel):
    image: str


def _convert_script_to_frontend(raw: dict, project_id: str) -> dict:
    """将后端 script.json 转换为前端期望的 scriptData 格式"""
    # 建立 char_id -> name 映射
    char_map = {c["id"]: c["name"] for c in raw.get("characters", [])}
    # 建立 scene_id -> scene 映射
    scene_map = {s["id"]: s for s in raw.get("scenes", [])}

    result = {}
    for ep in raw.get("episodes", []):
        ep_num = ep.get("episode", 1)
        ep_key = f"E{str(ep_num).zfill(2)}"

        # 按 scene_id 分组 shots
        scene_shots: dict[str, list] = {}
        for shot in ep.get("shots", []):
            sid = shot.get("scene_id", "unknown")
            scene_shots.setdefault(sid, []).append(shot)

        scenes = []
        for sid, shots in scene_shots.items():
            scene_info = scene_map.get(sid, {})
            converted_shots = []
            for shot in shots:
                # char_id -> 角色名
                char_names = [char_map.get(cid, cid) for cid in shot.get("characters", [])]
                # dialogue 中的 char_id 也转换
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


# --- Project CRUD ---

@app.get("/api/projects")
async def list_projects():
    """扫描 PROJECTS_DIR，返回项目列表"""
    projects = []
    if not settings.PROJECTS_DIR.exists():
        return JSONResponse([])
    for d in sorted(settings.PROJECTS_DIR.iterdir(), reverse=True):
        if not d.is_dir():
            continue
        status_path = d / "status.json"
        if not status_path.exists():
            continue
        status = json.loads(status_path.read_text())
        projects.append({
            "project_id": d.name,
            "name": status.get("name", d.name),
            "status": status.get("status", "created"),
            "created_at": status.get("created_at"),
        })
    return JSONResponse(projects)


@app.post("/api/projects")
async def create_project(file: UploadFile, name: str = Form("untitled")):
    project_id = uuid.uuid4().hex[:12]
    project = settings.PROJECTS_DIR / project_id
    project.mkdir(parents=True, exist_ok=True)

    content = await file.read()
    (project / "novel.txt").write_bytes(content)

    now = datetime.now().isoformat()
    status = {"status": "created", "name": name, "current_step": None, "progress": 0, "error": None, "created_at": now}
    (project / "status.json").write_text(json.dumps(status, ensure_ascii=False, indent=2))

    return {"project_id": project_id, "name": name}


@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: str):
    project = _project_dir(project_id)
    shutil.rmtree(project)
    return Response(status_code=204)


class TestApiRequest(BaseModel):
    base_url: str
    api_key: str
    model: str


@app.post("/api/test-llm")
async def test_llm(body: TestApiRequest):
    """发送一个最小请求测试 LLM API 可用性"""
    import httpx
    headers = {
        "Authorization": f"Bearer {body.api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": body.model,
        "max_tokens": 5,
        "messages": [{"role": "user", "content": "hi"}],
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{body.base_url.rstrip('/')}/v1/chat/completions",
                headers=headers,
                json=payload,
            )
        if resp.status_code == 200:
            return {"ok": True, "message": "连接成功"}
        return {"ok": False, "message": f"HTTP {resp.status_code}: {resp.text[:200]}"}
    except Exception as e:
        return {"ok": False, "message": str(e)[:200]}


class RunRequest(BaseModel):
    settings: dict | None = None


@app.post("/api/projects/{project_id}/run")
async def run_project(project_id: str, bg: BackgroundTasks, body: RunRequest = RunRequest()):
    project = _project_dir(project_id)
    status_path = project / "status.json"
    status = json.loads(status_path.read_text())

    if status.get("status") == "running":
        raise HTTPException(409, "Pipeline already running")

    if body.settings:
        (project / "settings.json").write_text(json.dumps(body.settings, ensure_ascii=False, indent=2))

    bg.add_task(run_pipeline, project_id)
    return {"message": "Pipeline started", "project_id": project_id}


@app.get("/api/projects/{project_id}/status")
async def get_status(project_id: str):
    project = _project_dir(project_id)
    return JSONResponse(json.loads((project / "status.json").read_text()))


@app.get("/api/projects/{project_id}/novel")
async def get_novel(project_id: str):
    project = _project_dir(project_id)
    novel_path = project / "novel.txt"
    if not novel_path.exists():
        raise HTTPException(404, "Novel not found")
    return JSONResponse({"text": novel_path.read_text(encoding="utf-8")})


@app.get("/api/projects/{project_id}/script")
async def get_script(project_id: str):
    project = _project_dir(project_id)
    script_path = project / "script.json"
    if not script_path.exists():
        raise HTTPException(404, "Script not generated yet")
    raw = json.loads(script_path.read_text())
    converted = _convert_script_to_frontend(raw, project_id)
    return JSONResponse(converted)


@app.get("/api/projects/{project_id}/analysis")
async def get_analysis(project_id: str):
    project = _project_dir(project_id)
    script_path = project / "script.json"
    if not script_path.exists():
        raise HTTPException(404, "Script not generated yet")
    raw = json.loads(script_path.read_text())

    episodes = raw.get("episodes", [])
    characters = raw.get("characters", [])
    scenes = raw.get("scenes", [])

    theme = " / ".join(ep.get("title", "") for ep in episodes[:5]) or "未知"
    core_conflict = ""
    if episodes and episodes[0].get("shots"):
        core_conflict = episodes[0]["shots"][0].get("description", "")

    return JSONResponse({
        "theme": theme,
        "tone": "叙事",
        "era": "现代",
        "core_conflict": core_conflict,
        "character_names": [c["name"] for c in characters],
        "scene_names": [s["name"] for s in scenes],
    })


@app.get("/api/projects/{project_id}/outlines")
async def get_outlines(project_id: str):
    project = _project_dir(project_id)
    script_path = project / "script.json"
    if not script_path.exists():
        raise HTTPException(404, "Script not generated yet")
    raw = json.loads(script_path.read_text())

    outlines = []
    for ep in raw.get("episodes", []):
        shots = ep.get("shots", [])
        summary = " ".join(s.get("description", "") for s in shots[:6])
        if len(summary) > 200:
            summary = summary[:200] + "..."
        outlines.append({
            "episode": ep.get("episode", 1),
            "title": ep.get("title", f"第{ep.get('episode', 1)}集"),
            "summary": summary,
            "chapters": f"第{ep.get('episode', 1)}章",
        })

    return JSONResponse(outlines)


@app.get("/api/projects/{project_id}/characters")
async def get_characters(project_id: str):
    project = _project_dir(project_id)
    script_path = project / "script.json"
    if not script_path.exists():
        raise HTTPException(404, "Script not generated yet")
    raw = json.loads(script_path.read_text())
    characters = []
    for c in raw.get("characters", []):
        char_dir = project / "assets" / "characters" / c["id"]
        ref_path = char_dir / "ref.png"
        characters.append({
            "id": c["id"],
            "name": c["name"],
            "description": c.get("appearance", ""),
            "appearance": c.get("appearance", ""),
            "locked": ref_path.exists(),
            "reference_image": f"/api/projects/{project_id}/assets/characters/{c['id']}/ref.png" if ref_path.exists() else None,
            "candidates": _scan_candidates(char_dir, project_id, "characters", c["id"]),
        })
    return JSONResponse(characters)


@app.get("/api/projects/{project_id}/scenes")
async def get_scenes(project_id: str):
    project = _project_dir(project_id)
    script_path = project / "script.json"
    if not script_path.exists():
        raise HTTPException(404, "Script not generated yet")
    raw = json.loads(script_path.read_text())
    scenes = []
    for s in raw.get("scenes", []):
        scene_dir = project / "assets" / "scenes" / s["id"]
        ref_path = scene_dir / "ref.png"
        scenes.append({
            "id": s["id"],
            "name": s["name"],
            "description": s.get("description", ""),
            "locked": ref_path.exists(),
            "reference_image": f"/api/projects/{project_id}/assets/scenes/{s['id']}/ref.png" if ref_path.exists() else None,
            "candidates": _scan_candidates(scene_dir, project_id, "scenes", s["id"]),
        })
    return JSONResponse(scenes)



@app.get("/api/projects/{project_id}/frames/{episode}/{shot_id}")
async def get_frame(project_id: str, episode: str, shot_id: str):
    project = _project_dir(project_id)
    frame = project / "frames" / episode / f"{shot_id}.png"
    if not frame.exists():
        raise HTTPException(404, "Frame not found")
    return FileResponse(frame, media_type="image/png")


# --- Regenerate ---

@app.post("/api/projects/{project_id}/characters/{char_id}/regenerate")
async def regenerate_character(project_id: str, char_id: str):
    project = _project_dir(project_id)
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
    img_client = _get_image_client(project_id)
    await img_client.text2img(prompt, "lowres, blurry", output_path)

    image_url = f"/api/projects/{project_id}/assets/characters/{char_id}/{output_path.name}"
    return {"image": image_url}


@app.post("/api/projects/{project_id}/scenes/{scene_id}/regenerate")
async def regenerate_scene(project_id: str, scene_id: str):
    project = _project_dir(project_id)
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
    img_client = _get_image_client(project_id)
    await img_client.text2img(prompt, "lowres, blurry", output_path)

    image_url = f"/api/projects/{project_id}/assets/scenes/{scene_id}/{output_path.name}"
    return {"image": image_url}


# --- Candidates list ---

@app.get("/api/projects/{project_id}/assets/{asset_type}/{asset_id}/candidates")
async def get_candidates(project_id: str, asset_type: str, asset_id: str):
    project = _project_dir(project_id)
    asset_dir = project / "assets" / asset_type / asset_id
    candidates = _scan_candidates(asset_dir, project_id, asset_type, asset_id)
    return {"candidates": candidates}


# --- Select reference image ---

@app.post("/api/projects/{project_id}/assets/{asset_type}/{asset_id}/select")
async def select_asset(project_id: str, asset_type: str, asset_id: str, body: SelectAssetRequest):
    project = _project_dir(project_id)
    asset_dir = project / "assets" / asset_type / asset_id
    source = asset_dir / body.image
    # 防止路径遍历
    if not source.resolve().is_relative_to(asset_dir.resolve()):
        raise HTTPException(400, "Invalid image path")
    if not source.exists():
        raise HTTPException(404, f"Candidate {body.image} not found")
    ref_path = asset_dir / "ref.png"
    shutil.copy2(source, ref_path)
    return {"reference_image": f"/api/projects/{project_id}/assets/{asset_type}/{asset_id}/ref.png"}


# --- Asset file serving (candidates) ---

@app.get("/api/projects/{project_id}/assets/{asset_type}/{asset_id}/{filename}")
async def get_asset_file(project_id: str, asset_type: str, asset_id: str, filename: str):
    project = _project_dir(project_id)
    file_path = project / "assets" / asset_type / asset_id / filename
    if not file_path.resolve().is_relative_to(project.resolve()):
        raise HTTPException(400, "Invalid path")
    if not file_path.exists():
        raise HTTPException(404, "Asset file not found")
    return FileResponse(file_path, media_type="image/png")
