import logging
import struct
import wave
from pathlib import Path

import httpx

from config import settings

logger = logging.getLogger(__name__)


class TTSClient:
    """GPT-SoVITS TTS client."""

    def __init__(self, base_url: str | None = None):
        self.base_url = (base_url or settings.TTS_BASE_URL).rstrip("/")

    async def health_check(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(self.base_url)
                return resp.status_code < 500
        except Exception:
            return False

    async def synthesize(
        self,
        text: str,
        refer_wav_path: str | None = None,
        prompt_text: str = "",
        language: str = "zh",
    ) -> bytes:
        """Call GPT-SoVITS API. Returns WAV bytes."""
        params = {
            "text": text,
            "text_language": language,
        }
        if refer_wav_path:
            params["refer_wav_path"] = refer_wav_path
        if prompt_text:
            params["prompt_text"] = prompt_text

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.get(f"{self.base_url}/tts", params=params)
                resp.raise_for_status()
                return resp.content
        except Exception as e:
            logger.error("TTS failed: %s", e)
            raise


class MockTTSClient:
    """Generate silent WAV for testing."""

    async def health_check(self) -> bool:
        return True

    async def synthesize(
        self,
        text: str,
        refer_wav_path: str | None = None,
        prompt_text: str = "",
        language: str = "zh",
    ) -> bytes:
        # ~1 second of silence at 22050Hz, 16-bit mono
        duration = max(0.5, len(text) * 0.15)
        sample_rate = 22050
        n_samples = int(sample_rate * duration)
        import io
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(b"\x00\x00" * n_samples)
        return buf.getvalue()
