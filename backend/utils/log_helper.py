import json
from datetime import datetime
from pathlib import Path

from config import settings


def append_log(project_id: str, stage: str, message: str, level: str = "info"):
    project = settings.PROJECTS_DIR / project_id
    logs_path = project / "logs.json"
    logs = []
    if logs_path.exists():
        try:
            logs = json.loads(logs_path.read_text())
        except Exception:
            logs = []
    logs.append({
        "timestamp": datetime.now().isoformat(),
        "stage": stage,
        "message": message,
        "level": level,
    })
    logs_path.write_text(json.dumps(logs, ensure_ascii=False, indent=2))
