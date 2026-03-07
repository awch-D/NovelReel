import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import projects_router, script_router, assets_router, frames_router, voice_router, synthesis_router, settings_router

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Novel2Toon", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects_router)
app.include_router(script_router)
app.include_router(assets_router)
app.include_router(frames_router)
app.include_router(voice_router)
app.include_router(synthesis_router)
app.include_router(settings_router)
