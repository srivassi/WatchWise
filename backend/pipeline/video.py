import subprocess, tempfile, os, json
import numpy as np
import librosa
from pipeline.ffmpeg import extract_audio_from_video, detect_scene_cuts

# Videos longer than this are sampled rather than fully loaded
_FULL_ANALYSIS_CAP_SEC = 600   # 10 min
_SAMPLE_WINDOW_SEC = 120        # 2 min per window
_SAMPLE_OFFSETS_FRAC = [0.0, 0.4, 0.8]  # start, ~40%, ~80% through the video


def extract_video(url: str, out_dir: str) -> dict:
    """Download video + transcript via yt-dlp, extract audio via ffmpeg."""
    video_path = os.path.join(out_dir, "video.mp4")
    audio_path = os.path.join(out_dir, "audio.wav")
    sub_prefix = os.path.join(out_dir, "sub")

    # Single yt-dlp call: dump metadata JSON + write auto-subtitles
    meta_result = subprocess.run(
        [
            "yt-dlp",
            "--dump-json",
            "--write-auto-sub", "--sub-format", "json3",
            "--sub-langs", "en.*",
            "--skip-download",
            "-o", sub_prefix,
            url,
        ],
        capture_output=True, text=True, check=False,
    )
    meta = {}
    if meta_result.returncode == 0 and meta_result.stdout.strip():
        try:
            # --dump-json prints one JSON object per line; take the last
            meta = json.loads(meta_result.stdout.strip().splitlines()[-1])
        except Exception:
            pass

    # Download video (best mp4) — used for both scene detection and audio extraction
    subprocess.run(
        ["yt-dlp", "-f", "bestvideo[ext=mp4]/bestvideo", "-o", video_path, url],
        capture_output=True, check=False,
    )

    # Extract audio from the video file (avoids a second full network download)
    if os.path.exists(video_path):
        extract_audio_from_video(video_path, audio_path)

    # Fallback: direct audio download if ffmpeg extraction failed
    if not os.path.exists(audio_path):
        subprocess.run(
            ["yt-dlp", "-x", "--audio-format", "wav", "-o", audio_path, url],
            capture_output=True, check=False,
        )

    return {
        "title": meta.get("title", ""),
        "description": meta.get("description", ""),
        "duration": meta.get("duration", 0),
        "channel": meta.get("channel", meta.get("uploader", "")),
        "thumbnail": meta.get("thumbnail", ""),
        "audio_path": audio_path if os.path.exists(audio_path) else None,
        "video_path": video_path if os.path.exists(video_path) else None,
        "transcript": _parse_transcript(out_dir),
    }


def _parse_transcript(out_dir: str) -> str:
    """Extract clean text from the first json3 subtitle file found."""
    for f in sorted(os.listdir(out_dir)):
        if not (f.endswith(".json3") or (f.startswith("sub") and f.endswith(".json"))):
            continue
        try:
            with open(os.path.join(out_dir, f)) as fh:
                sub_data = json.load(fh)
            words = [
                seg.get("utf8", "")
                for e in sub_data.get("events", [])
                for seg in e.get("segs", [])
                if seg.get("utf8", "").strip()
            ]
            text = " ".join(words).strip()
            if text:
                return text
        except Exception:
            continue
    return ""


def _load_audio(audio_path: str, duration_sec: int) -> tuple[np.ndarray, int]:
    """
    Load audio for analysis.

    Videos ≤ 10 min: load in full.
    Videos > 10 min: concatenate three 2-min windows at 0%, 40%, and 80% through
    the video. Keeps memory and CPU bounded while sampling the full character of
    the content rather than just the opening minutes.
    """
    sr = 22050
    if duration_sec <= _FULL_ANALYSIS_CAP_SEC:
        y, _ = librosa.load(audio_path, sr=sr, mono=True)
        return y, sr

    segments = []
    for frac in _SAMPLE_OFFSETS_FRAC:
        offset = int(frac * duration_sec)
        # Don't start so close to the end that the window would be cut short
        offset = min(offset, max(0, duration_sec - _SAMPLE_WINDOW_SEC))
        try:
            y_seg, _ = librosa.load(
                audio_path, sr=sr, mono=True,
                offset=offset, duration=_SAMPLE_WINDOW_SEC,
            )
            segments.append(y_seg)
        except Exception:
            continue

    return (np.concatenate(segments) if segments else np.zeros(sr * 10, dtype=np.float32)), sr


def analyze_audio(audio_path: str, duration_sec: int = 0) -> dict:
    """Compute overstimulation signals from audio."""
    if not audio_path or not os.path.exists(audio_path):
        return {"cuts_per_min": 0, "avg_volume_variance": 0.0, "volume_spike_frequency": 0}

    y, sr = _load_audio(audio_path, duration_sec)
    duration_min = len(y) / sr / 60

    # ── Pacing proxy (audio onsets as edit-cut proxy) ──────────────────────────
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    onsets = librosa.onset.onset_detect(
        onset_envelope=onset_env, sr=sr, units="time",
        backtrack=True,  # snap to the actual attack, not the peak
        delta=0.5,       # higher delta = only strong onsets, less jitter
    )
    cuts_per_minute = len(onsets) / max(duration_min, 0.1)

    # ── Volume dynamics ─────────────────────────────────────────────────────────
    rms = librosa.feature.rms(y=y, hop_length=512)[0]
    p25, p50, p75 = np.percentile(rms, [25, 50, 75])
    iqr = p75 - p25

    # avg_volume_variance: normalised IQR — how chaotically volume swings (0–1)
    # Dividing IQR by median then clamping gives a scale-invariant chaos metric
    avg_volume_variance = round(float(np.clip(iqr / max(p50, 1e-6) / 2, 0.0, 1.0)), 4)

    # volume_spike_frequency: distinct loud bursts per minute
    # Tukey's fence (p75 + 1.5 * IQR) targets true statistical outlier spikes,
    # not just "louder than average" frames
    threshold = p75 + 1.5 * iqr
    spike_binary = (rms > threshold).astype(int)
    spike_events = int(np.sum(np.diff(spike_binary) == 1))  # rising edges only
    volume_spike_frequency = int(round(spike_events / max(duration_min, 0.1)))

    return {
        "cuts_per_min": int(round(cuts_per_minute)),
        "avg_volume_variance": avg_volume_variance,
        "volume_spike_frequency": volume_spike_frequency,
    }


def run_pipeline(url: str) -> dict:
    with tempfile.TemporaryDirectory() as tmp:
        video_data = extract_video(url, tmp)
        duration_sec = int(video_data.get("duration", 0))
        audio_metrics = analyze_audio(video_data["audio_path"], duration_sec)

        # Prefer ffmpeg scene detection (frame-accurate); fall back to audio-onset proxy
        scene_cuts = detect_scene_cuts(
            video_path=video_data.get("video_path"),
            duration_sec=duration_sec,
        )
        if scene_cuts > 0:
            audio_metrics["cuts_per_min"] = scene_cuts

    result = {**video_data, **audio_metrics, "audio_path": None, "video_path": None}
    result["duration_sec"] = duration_sec
    result.pop("duration", None)
    return result
