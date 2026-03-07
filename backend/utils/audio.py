import wave
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def get_audio_duration(path: Path) -> float:
    """Get duration of a WAV file in seconds."""
    try:
        with wave.open(str(path), "rb") as wf:
            return wf.getnframes() / wf.getframerate()
    except Exception:
        return 0.0


def merge_dialogues(wav_paths: list[Path], output: Path, silence_ms: int = 300):
    """Merge multiple WAV files with silence gaps between them."""
    if not wav_paths:
        return

    # Read first file to get params
    with wave.open(str(wav_paths[0]), "rb") as wf:
        params = wf.getparams()
        sample_rate = params.framerate
        sample_width = params.sampwidth
        channels = params.nchannels

    silence_frames = int(sample_rate * silence_ms / 1000)
    silence_bytes = b"\x00" * (silence_frames * sample_width * channels)

    with wave.open(str(output), "wb") as out:
        out.setnchannels(channels)
        out.setsampwidth(sample_width)
        out.setframerate(sample_rate)

        for i, path in enumerate(wav_paths):
            try:
                with wave.open(str(path), "rb") as wf:
                    out.writeframes(wf.readframes(wf.getnframes()))
                if i < len(wav_paths) - 1:
                    out.writeframes(silence_bytes)
            except Exception as e:
                logger.error("Failed to merge %s: %s", path, e)
