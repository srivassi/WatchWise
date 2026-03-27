"""
FastAPI route handlers.
Own this file if you're on the API/backend integration role.
"""
import json, subprocess, asyncio
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pipeline.video import run_pipeline
from multiagent_flow.scoring import score_video, score_video_stream

router = APIRouter()


# ── Request schemas ────────────────────────────────────────────────────────────

class VideoRequest(BaseModel):
    url: str
    age: int = 8


class CreatorRequest(BaseModel):
    channel_url: str
    age: int = 8


# ── Helpers ────────────────────────────────────────────────────────────────────

def _extract_signals(data: dict) -> dict:
    return {
        "cuts_per_min": data.get("cuts_per_min", 0),
        "avg_volume_variance": data.get("avg_volume_variance", 0.0),
        "volume_spike_frequency": data.get("volume_spike_frequency", 0),
        "duration_sec": data.get("duration_sec", 0),
    }


def _meta(data: dict) -> dict:
    return {
        "title": data.get("title"),
        "channel": data.get("channel"),
        "duration": data.get("duration_sec"),
        "thumbnail": data.get("thumbnail"),
    }


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/score/stream")
async def score_url_stream(req: VideoRequest):
    """
    Score a single YouTube video with streaming SSE output.
    The frontend receives agent events in real-time as each specialist analyses the content.

    Event types: agent_start | token | tool_call | agent_done | final
    """
    try:
        data = await asyncio.to_thread(run_pipeline, req.url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    async def generate():
        yield f"data: {json.dumps({'type': 'meta', 'data': _meta(data)})}\n\n"
        async for event in score_video_stream(
            transcript=data.get("transcript", ""),
            signals=_extract_signals(data),
            age=req.age,
            channel=data.get("channel", ""),
        ):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/score")
async def score_url(req: VideoRequest):
    """Score a single YouTube video, returning the full result as JSON."""
    try:
        data = await asyncio.to_thread(run_pipeline, req.url)
        result = await score_video(
            transcript=data.get("transcript", ""),
            signals=_extract_signals(data),
            age=req.age,
            channel=data.get("channel", ""),
        )
        result["meta"] = _meta(data)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/history")
async def score_history(file: UploadFile = File(...), age: int = 8):
    """Accept a YouTube Takeout watch-history.json and score a sample of videos."""
    raw = await file.read()
    try:
        history = json.loads(raw)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    entries = [e for e in history if e.get("titleUrl", "").startswith("https://www.youtube.com/watch")]
    if not entries:
        raise HTTPException(status_code=400, detail="No YouTube watch entries found")

    sample = entries[:20]
    results = []
    for entry in sample:
        try:
            data = await asyncio.to_thread(run_pipeline, entry["titleUrl"])
            score = await score_video(
                transcript=data.get("transcript", ""),
                signals=_extract_signals(data),
                age=age,
                channel=data.get("channel", ""),
            )
            score["meta"] = _meta(data)
            score["watched_at"] = entry.get("time", "")
            results.append(score)
        except Exception:
            continue

    if not results:
        raise HTTPException(status_code=500, detail="Could not score any videos")

    avg_score = sum(r["brainrot_score"] for r in results) / len(results)

    creator_scores: dict = {}
    for r in results:
        ch = r["meta"].get("channel", "Unknown")
        creator_scores.setdefault(ch, []).append(r["brainrot_score"])
    creator_summary = {
        ch: round(sum(v) / len(v), 1)
        for ch, v in sorted(creator_scores.items(), key=lambda x: -sum(x[1]) / len(x[1]))
    }

    return {
        "average_brainrot_score": round(avg_score, 1),
        "total_scored": len(results),
        "creator_scores": creator_summary,
        "videos": results,
    }


@router.post("/creator")
async def score_creator(req: CreatorRequest):
    """Sample up to 5 recent uploads from a channel and average the scores."""
    try:
        result = subprocess.run(
            ["yt-dlp", "--flat-playlist", "--dump-json", "--playlist-end", "5", req.channel_url],
            capture_output=True, text=True, timeout=30,
        )
        urls = [
            f"https://www.youtube.com/watch?v={json.loads(line)['id']}"
            for line in result.stdout.strip().splitlines()
            if line.strip()
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not fetch channel: {e}")

    if not urls:
        raise HTTPException(status_code=404, detail="No videos found for this creator")

    scores = []
    for url in urls:
        try:
            data = await asyncio.to_thread(run_pipeline, url)
            score = await score_video(
                transcript=data.get("transcript", ""),
                signals=_extract_signals(data),
                age=req.age,
                channel=data.get("channel", ""),
            )
            score["meta"] = _meta(data)
            scores.append(score)
        except Exception:
            continue

    if not scores:
        raise HTTPException(status_code=500, detail="Could not score any videos")

    avg = round(sum(s["brainrot_score"] for s in scores) / len(scores), 1)
    return {
        "channel_url": req.channel_url,
        "average_brainrot_score": avg,
        "videos_sampled": len(scores),
        "videos": scores,
    }
