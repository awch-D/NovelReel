import logging
import shutil
from pathlib import Path

import httpx

from config import settings

logger = logging.getLogger(__name__)


class LipSyncClient:
    """SadTalker Gradio API client."""

    def __init__(self, base_url: str | None = None):
        self.base_url = (base_url or settings.SADTALKER_BASE_URL).rstrip("/")

    async def generate(
        self,
        face_image: Path,
        audio: Path,
        output: Path,
        still_mode: bool = True,
    ) -> Path:
        """Call SadTalker API to generate lip-synced video."""
        try:
            async with httpx.AsyncClient(timeout=300) as client:
                files = {
                    "source_image": ("face.png", face_image.read_bytes(), "image/png"),
                    "driven_audio": ("audio.wav", audio.read_bytes(), "audio/wav"),
                }
                data = {"still": str(still_mode).lower()}
                resp = await client.post(
                    f"{self.base_url}/api/predict",
                    files=files,
                    data=data,
                )
                resp.raise_for_status()
                output.write_bytes(resp.content)
                return output
        except Exception as e:
            logger.error("LipSync failed: %s", e)
            raise


class MockLipSyncClient:
    """Copy input image as a static 'video' for testing."""

    async def generate(
        self,
        face_image: Path,
        audio: Path,
        output: Path,
        still_mode: bool = True,
    ) -> Path:
        shutil.copy2(face_image, output.with_suffix(".png"))
        # Create a minimal placeholder
        output.write_bytes(b"MOCK_VIDEO")
        return output
