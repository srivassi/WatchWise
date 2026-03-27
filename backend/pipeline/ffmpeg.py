"""
ffmpeg utilities for the video pipeline.
"""
import os
import re
import subprocess


def extract_audio_from_video(video_path: str, audio_path: str) -> bool:
    """
    Extract mono 22050 Hz WAV from a video file using ffmpeg.
    Returns True on success.
    """
    result = subprocess.run(
        [
            "ffmpeg", "-i", video_path,
            "-vn",                  # strip video stream
            "-acodec", "pcm_s16le", # uncompressed PCM
            "-ar", "22050",         # sample rate librosa expects
            "-ac", "1",             # mono
            "-y",                   # overwrite output
            audio_path,
        ],
        capture_output=True,
    )
    return result.returncode == 0 and os.path.exists(audio_path)


def detect_scene_cuts(video_path: str | None, duration_sec: int) -> int:
    """
    Returns cuts per minute using ffmpeg scene detection.
    Falls back to 0 (triggering audio-onset proxy in video.py) if unavailable.

    Uses showinfo to get per-frame timestamps, then deduplicates cuts that fall
    within 0.5 s of each other — ffmpeg often reports multiple frames per transition.
    """
    if not video_path or not os.path.exists(video_path):
        return 0
    if duration_sec <= 0:
        return 0

    result = subprocess.run(
        [
            "ffmpeg", "-i", video_path,
            "-vf", "select='gt(scene,0.3)',showinfo",
            "-f", "null", "-",
        ],
        capture_output=True,
        text=True,
    )

    # Parse timestamps from stderr showinfo lines
    timestamps = []
    for line in result.stderr.splitlines():
        if "Parsed_showinfo" not in line:
            continue
        m = re.search(r"pts_time:([\d.]+)", line)
        if m:
            timestamps.append(float(m.group(1)))

    if not timestamps:
        return 0

    # Deduplicate: only count a new cut if ≥0.5 s after the previous one
    deduped = [timestamps[0]]
    for ts in timestamps[1:]:
        if ts - deduped[-1] >= 0.5:
            deduped.append(ts)

    return round(len(deduped) / (duration_sec / 60))
