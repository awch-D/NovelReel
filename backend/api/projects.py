import json
import shutil
import uuid
import tempfile
from datetime import datetime
from pathlib import Path
from typing import List

from fastapi import APIRouter, UploadFile, Form, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse, Response, FileResponse
from pydantic import BaseModel

from config import settings
from pipeline import run_pipeline
from utils.project_helpers import project_dir

router = APIRouter(prefix="/api", tags=["projects"])


@router.get("/projects")
async def list_projects():
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

        # Find cover image from first episode frames
        cover = None
        frames_dir = d / "frames" / "episode_1"
        if frames_dir.exists():
            pngs = sorted(frames_dir.glob("*.png"))
            if pngs:
                cover = f"/api/projects/{d.name}/frames/episode_1/{pngs[0].stem}"

        projects.append({
            "project_id": d.name,
            "name": status.get("name", d.name),
            "status": status.get("status", "created"),
            "created_at": status.get("created_at"),
            "cover": cover,
        })
    return JSONResponse(projects)


@router.post("/projects")
async def create_project(file: List[UploadFile] = None, name: str = Form("untitled")):
    project_id = uuid.uuid4().hex[:12]
    project = settings.PROJECTS_DIR / project_id
    project.mkdir(parents=True, exist_ok=True)

    files = file or []
    if not files:
        raise HTTPException(400, "At least one file is required")

    # Save originals and merge
    novels_dir = project / "novels"
    novels_dir.mkdir(exist_ok=True)
    merged = []
    for i, f in enumerate(files):
        content = await f.read()
        (novels_dir / f"{i:03d}_{f.filename}").write_bytes(content)
        try:
            merged.append(content.decode("utf-8"))
        except UnicodeDecodeError:
            merged.append(content.decode("gbk", errors="replace"))

    (project / "novel.txt").write_text("\n\n".join(merged), encoding="utf-8")

    now = datetime.now().isoformat()
    status = {"status": "created", "name": name, "current_step": None, "progress": 0, "error": None, "created_at": now}
    (project / "status.json").write_text(json.dumps(status, ensure_ascii=False, indent=2))

    return {"project_id": project_id, "name": name}


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    project = project_dir(project_id)
    shutil.rmtree(project)
    return Response(status_code=204)


class TestApiRequest(BaseModel):
    base_url: str
    api_key: str
    model: str


@router.post("/test-llm")
async def test_llm(body: TestApiRequest):
    """测试 LLM 连接（只调 /models，零费用）"""
    import httpx
    headers = {
        "Authorization": f"Bearer {body.api_key}",
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{body.base_url.rstrip('/')}/v1/models",
                headers=headers,
            )
        if resp.status_code != 200:
            return {"ok": False, "message": f"HTTP {resp.status_code}: {resp.text[:200]}"}
        # 检查模型是否存在
        data = resp.json()
        model_ids = [m.get("id", "") for m in data.get("data", [])]
        if model_ids and body.model not in model_ids:
            return {"ok": True, "message": f"连接成功，但未找到模型 {body.model}"}
        return {"ok": True, "message": "连接成功"}
    except Exception as e:
        return {"ok": False, "message": str(e)[:200]}


class RunRequest(BaseModel):
    settings: dict | None = None


class ReorderRequest(BaseModel):
    file_order: list[str]


@router.put("/projects/{project_id}/novel/reorder")
async def reorder_novel(project_id: str, body: ReorderRequest):
    project = project_dir(project_id)
    novels_dir = project / "novels"
    if not novels_dir.exists():
        raise HTTPException(400, "No uploaded files found")

    existing = {f.name: f for f in sorted(novels_dir.iterdir()) if f.is_file()}
    merged = []
    for name in body.file_order:
        f = existing.get(name)
        if not f:
            raise HTTPException(400, f"File not found: {name}")
        content = f.read_bytes()
        try:
            merged.append(content.decode("utf-8"))
        except UnicodeDecodeError:
            merged.append(content.decode("gbk", errors="replace"))

    (project / "novel.txt").write_text("\n\n".join(merged), encoding="utf-8")
    return {"status": "ok", "files": body.file_order}


@router.post("/projects/{project_id}/run")
async def run_project(project_id: str, bg: BackgroundTasks, body: RunRequest = RunRequest()):
    project = project_dir(project_id)
    status_path = project / "status.json"
    status = json.loads(status_path.read_text())

    if status.get("status") == "running":
        raise HTTPException(409, "Pipeline already running")

    if body.settings:
        (project / "settings.json").write_text(json.dumps(body.settings, ensure_ascii=False, indent=2))

    bg.add_task(run_pipeline, project_id)
    return {"message": "Pipeline started", "project_id": project_id}


@router.get("/projects/{project_id}/status")
async def get_status(project_id: str):
    project = project_dir(project_id)
    return JSONResponse(json.loads((project / "status.json").read_text()))


@router.get("/projects/{project_id}/novel")
async def get_novel(project_id: str):
    project = project_dir(project_id)
    novel_path = project / "novel.txt"
    if not novel_path.exists():
        raise HTTPException(404, "Novel not found")
    return JSONResponse({"text": novel_path.read_text(encoding="utf-8")})


@router.get("/projects/{project_id}/logs")
async def get_logs(project_id: str):
    project = project_dir(project_id)
    logs_path = project / "logs.json"
    if not logs_path.exists():
        return JSONResponse([])
    return JSONResponse(json.loads(logs_path.read_text()))


@router.get("/projects/{project_id}/export")
async def export_project(project_id: str):
    project = project_dir(project_id)
    tmp = tempfile.mkdtemp()
    archive_path = Path(tmp) / f"{project_id}"
    shutil.make_archive(str(archive_path), "zip", str(project))
    return FileResponse(
        f"{archive_path}.zip",
        media_type="application/zip",
        filename=f"{project_id}.zip",
    )
