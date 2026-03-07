"""FFmpeg wrapper utilities for video synthesis."""
import logging
import subprocess
import shutil
from pathlib import Path

from config import settings

logger = logging.getLogger(__name__)

FFMPEG = settings.FFMPEG_PATH or shutil.which("ffmpeg") or "ffmpeg"


def _run(cmd: list[str], timeout: int = 300):
    logger.info("ffmpeg: %s", " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if result.returncode != 0:
        logger.error("ffmpeg stderr: %s", result.stderr)
        raise RuntimeError(f"ffmpeg failed: {result.stderr[:500]}")
    return result


def image_to_video(image: Path, duration: float, output: Path, fps: int = 24):
    """Static image → video with subtle Ken Burns zoom."""
    _run([
        FFMPEG, "-y",
        "-loop", "1", "-i", str(image),
        "-vf", f"zoompan=z='min(zoom+0.0005,1.03)':d={int(duration*fps)}:s=1920x1080:fps={fps}",
        "-t", str(duration),
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        str(output),
    ])


def overlay_lipsync(base: Path, lipsync: Path, output: Path):
    """Overlay lip-sync video onto base (simple replace for now)."""
    shutil.copy2(lipsync, output)


def mix_audio(video: Path, audio: Path, output: Path):
    """Mix audio track into video."""
    _run([
        FFMPEG, "-y",
        "-i", str(video), "-i", str(audio),
        "-c:v", "copy", "-c:a", "aac", "-shortest",
        str(output),
    ])


def apply_vfx(video: Path, vfx_type: str, output: Path):
    """Apply simple VFX filter. Supported: speed_lines, screen_shake, none."""
    if vfx_type == "screen_shake":
        _run([
            FFMPEG, "-y", "-i", str(video),
            "-vf", "crop=iw-10:ih-10:5*sin(n):5*cos(n)",
            "-c:a", "copy", str(output),
        ])
    else:
        # No VFX or unsupported — pass through
        shutil.copy2(video, output)


def concat_clips(clips: list[Path], output: Path):
    """Concatenate video clips."""
    if not clips:
        raise ValueError("No clips to concat")
    if len(clips) == 1:
        shutil.copy2(clips[0], output)
        return
    list_file = output.parent / f"_concat_{output.stem}.txt"
    list_file.write_text("\n".join(f"file '{c.resolve()}'" for c in clips))
    _run([
        FFMPEG, "-y", "-f", "concat", "-safe", "0",
        "-i", str(list_file),
        "-c", "copy", str(output),
    ])
    list_file.unlink(missing_ok=True)


def mix_bgm(video: Path, bgm: Path, output: Path, volume: float = 0.15):
    """Mix BGM into video, lowering BGM volume."""
    _run([
        FFMPEG, "-y",
        "-i", str(video), "-i", str(bgm),
        "-filter_complex", f"[1:a]volume={volume}[bgm];[0:a][bgm]amix=inputs=2:duration=first[out]",
        "-map", "0:v", "-map", "[out]",
        "-c:v", "copy", "-c:a", "aac", "-shortest",
        str(output),
    ])


def burn_subtitles(video: Path, srt: Path, output: Path, font_size: int = 24):
    """Burn SRT subtitles into video."""
    _run([
        FFMPEG, "-y",
        "-i", str(video),
        "-vf", f"subtitles={str(srt)}:force_style='FontSize={font_size},PrimaryColour=&Hffffff&,OutlineColour=&H000000&,Outline=2'",
        "-c:a", "copy", str(output),
    ])


def generate_srt(dialogues: list[dict], output: Path, default_duration: float = 3.0):
    """Generate SRT subtitle file from dialogue list.
    Each dict: {text, character, start_time (optional), duration (optional)}
    """
    lines = []
    t = 0.0
    for i, d in enumerate(dialogues, 1):
        start = d.get("start_time", t)
        dur = d.get("duration", default_duration)
        end = start + dur
        char = d.get("character", "")
        text = d.get("text", "")
        display = f"{char}: {text}" if char else text
        lines.append(f"{i}")
        lines.append(f"{_srt_time(start)} --> {_srt_time(end)}")
        lines.append(display)
        lines.append("")
        t = end
    output.write_text("\n".join(lines), encoding="utf-8")


def _srt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
