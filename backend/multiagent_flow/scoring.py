"""
Scoring pipeline orchestrator.

score_video_stream() — async generator, yields SSE events for streaming to frontend.
                       mode="sequential" (default) — agents speak one at a time, panel discussion feel.
                       mode="parallel"              — all 5 agents run concurrently, events interleave as they arrive.
score_video()        — consumes the stream silently, returns the final result dict.
                       Used by the history and creator batch endpoints.
"""
import asyncio
from multiagent_flow.agents.pacing import pacing_agent
from multiagent_flow.agents.sensory import sensory_agent
from multiagent_flow.agents.educational import educational_agent
from multiagent_flow.agents.manipulation import manipulation_agent
from multiagent_flow.agents.dopamine import dopamine_agent
from multiagent_flow.judge import judge_agent

_SENTINEL = object()


async def _drain_agent_to_queue(agent_gen, queue: asyncio.Queue):
    """Run an agent generator and push every event onto a shared queue."""
    async for event in agent_gen:
        await queue.put(event)
    await queue.put(_SENTINEL)


async def score_video_stream(
    transcript: str,
    signals: dict,
    age: int,
    channel: str,
    mode: str = "sequential",
):
    """
    Yields SSE event dicts for the full scoring run.

    mode="sequential" — agents speak one at a time (good for demo / panel UX).
    mode="parallel"   — all 5 agents fire concurrently; events arrive as each streams.
                        Faster, but output from different specialists will interleave.

    Event types:
      agent_start  — {"agent": str, "label": str}
      token        — {"agent": str, "text": str}
      tool_call    — {"agent": str, "tool": str}
      agent_done   — {"agent": str, "label": str, "score": int}
      final        — full result payload (brainrot_score, verdict, radar, summary, …)
    """
    radar: dict[str, int] = {}

    specialists = [
        pacing_agent(signals, age),
        sensory_agent(signals, age),
        educational_agent(transcript, channel, age),
        manipulation_agent(transcript, channel, age),
        dopamine_agent(signals, age),
    ]

    if mode == "sequential":
        for agent_gen in specialists:
            async for event in agent_gen:
                yield event
                if event["type"] == "agent_done":
                    radar[event["agent"]] = event["score"]

    else:  # parallel
        queue: asyncio.Queue = asyncio.Queue()
        tasks = [
            asyncio.create_task(_drain_agent_to_queue(gen, queue))
            for gen in specialists
        ]

        done = 0
        while done < len(specialists):
            event = await queue.get()
            if event is _SENTINEL:
                done += 1
            else:
                yield event
                if event["type"] == "agent_done":
                    radar[event["agent"]] = event["score"]

        await asyncio.gather(*tasks)

    async for event in judge_agent(radar, age, channel):
        yield event


async def score_video(transcript: str, signals: dict, age: int, channel: str) -> dict:
    """Non-streaming version — returns the final result dict. Used for batch endpoints."""
    result: dict = {}
    async for event in score_video_stream(transcript, signals, age, channel):
        if event["type"] == "final":
            result = event
    return result
