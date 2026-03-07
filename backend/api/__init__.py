from .projects import router as projects_router
from .script import router as script_router
from .assets import router as assets_router
from .frames import router as frames_router
from .voice import router as voice_router
from .synthesis import router as synthesis_router
from .settings import router as settings_router

__all__ = ["projects_router", "script_router", "assets_router", "frames_router", "voice_router", "synthesis_router", "settings_router"]
