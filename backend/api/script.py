import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from utils.project_helpers import project_dir, convert_script_to_frontend

router = APIRouter(prefix="/api", tags=["script"])


@router.get("/projects/{project_id}/script")
async def get_script(project_id: str):
    project = project_dir(project_id)
    script_path = project / "script.json"
    if not script_path.exists():
        raise HTTPException(404, "Script not generated yet")
    raw = json.loads(script_path.read_text())
    converted = convert_script_to_frontend(raw, project_id)
    return JSONResponse(converted)


@router.get("/projects/{project_id}/analysis")
async def get_analysis(project_id: str):
    project = project_dir(project_id)
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


@router.get("/projects/{project_id}/outlines")
async def get_outlines(project_id: str):
    project = project_dir(project_id)
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
