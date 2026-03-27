"""
Per-agent streaming endpoints + pipeline endpoint.

POST /pipeline                  — runs yt-dlp + librosa, returns signals + transcript + meta
POST /agents/pacing/stream      — SSE, streams pacing agent
POST /agents/sensory/stream     — SSE, streams sensory agent
POST /agents/educational/stream — SSE, streams educational agent
POST /agents/manipulation/stream— SSE, streams manipulation agent
POST /agents/dopamine/stream    — SSE, streams dopamine agent
POST /judge/stream              — SSE, streams judge verdict
"""
import asyncio
import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from pipeline.video import run_pipeline
from multiagent_flow.agents.pacing import pacing_agent
from multiagent_flow.agents.sensory import sensory_agent
from multiagent_flow.agents.educational import educational_agent
from multiagent_flow.agents.manipulation import manipulation_agent
from multiagent_flow.agents.dopamine import dopamine_agent
from multiagent_flow.judge import judge_agent

agent_router = APIRouter()


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class PipelineRequest(BaseModel):
    url: str
    age: int = 8


class AgentRequest(BaseModel):
    signals: dict           # cuts_per_min, avg_volume_variance, volume_spike_frequency, duration_sec
    transcript: str = ""
    age: int = 8
    channel: str = ""


class JudgeRequest(BaseModel):
    radar: dict             # {pacing, sensory_overload, educational_deficit, manipulation, dopamine_cycling}
    age: int = 8
    channel: str = ""


# ---------------------------------------------------------------------------
# Helper: wrap an async generator as an SSE StreamingResponse
# ---------------------------------------------------------------------------

def _sse_response(gen):
    async def _stream():
        try:
            async for event in gen:
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(_stream(), media_type="text/event-stream")


# ---------------------------------------------------------------------------
# /pipeline
# ---------------------------------------------------------------------------

@agent_router.post("/pipeline")
async def pipeline(req: PipelineRequest):
    data = await asyncio.to_thread(run_pipeline, req.url)
    signals = {
        "cuts_per_min": data.get("cuts_per_min", 0),
        "avg_volume_variance": data.get("avg_volume_variance", 0.0),
        "volume_spike_frequency": data.get("volume_spike_frequency", 0),
        "duration_sec": data.get("duration_sec", 0),
    }
    return {
        "signals": signals,
        "transcript": data.get("transcript", ""),
        "channel": data.get("channel", ""),
        "age": req.age,
        "meta": {
            "title": data.get("title", ""),
            "description": data.get("description", ""),
            "thumbnail": data.get("thumbnail", ""),
            "duration_sec": data.get("duration_sec", 0),
        },
    }


# ---------------------------------------------------------------------------
# /agents/{name}/stream  (5 specialist agents)
# ---------------------------------------------------------------------------

@agent_router.post("/agents/pacing/stream")
async def stream_pacing(req: AgentRequest):
    return _sse_response(pacing_agent(req.signals, req.age))


@agent_router.post("/agents/sensory/stream")
async def stream_sensory(req: AgentRequest):
    return _sse_response(sensory_agent(req.signals, req.age))


@agent_router.post("/agents/educational/stream")
async def stream_educational(req: AgentRequest):
    return _sse_response(educational_agent(req.transcript, req.channel, req.age))


@agent_router.post("/agents/manipulation/stream")
async def stream_manipulation(req: AgentRequest):
    return _sse_response(manipulation_agent(req.transcript, req.channel, req.age))


@agent_router.post("/agents/dopamine/stream")
async def stream_dopamine(req: AgentRequest):
    return _sse_response(dopamine_agent(req.signals, req.age))


# ---------------------------------------------------------------------------
# /judge/stream
# ---------------------------------------------------------------------------

@agent_router.post("/judge/stream")
async def stream_judge(req: JudgeRequest):
    return _sse_response(judge_agent(req.radar, req.age, req.channel))
