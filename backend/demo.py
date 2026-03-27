"""
Demo script — calls each agent endpoint separately over HTTP, then the judge.
No YouTube URL or ffmpeg needed.

Run from the backend/ directory:
    python demo.py
"""
import asyncio
import json
import threading
import time

import httpx
import uvicorn

from main import app

# ── Config ─────────────────────────────────────────────────────────────────────

BASE_URL = "http://127.0.0.1:8765"
PORT     = 8765

# ── Fake pipeline output (what /pipeline would normally return) ────────────────

MOCK_SIGNALS = {
    "cuts_per_min": 42,
    "avg_volume_variance": 0.71,
    "volume_spike_frequency": 14,
    "duration_sec": 487,
}

MOCK_TRANSCRIPT = """
Oh my gosh you guys are NOT gonna believe what's in this mystery box!! Smash that like button
RIGHT NOW before we open it!! I love you guys SO much, you're literally my favourite people in
the whole world!! HURRY because this is a LIMITED TIME unboxing and everyone is watching!!
Wait for it... wait for it... OH WOW that is INSANE!! You won't believe what just happened!!
Comment below if you want to see more!! Don't forget to ring the bell so you NEVER miss a video!!
This is the CRAZIEST thing I've ever seen and if you're not subscribed you're literally missing out!!
"""

MOCK_CHANNEL = "CrazyUnboxKidz"
MOCK_AGE     = 7

AGENT_REQUEST = {
    "signals":    MOCK_SIGNALS,
    "transcript": MOCK_TRANSCRIPT.strip(),
    "age":        MOCK_AGE,
    "channel":    MOCK_CHANNEL,
}

# ── Terminal colours ────────────────────────────────────────────────────────────

COLOURS = {
    "pacing":               "\033[94m",   # blue
    "sensory_overload":     "\033[95m",   # magenta
    "educational_deficit":  "\033[92m",   # green
    "manipulation":         "\033[91m",   # red
    "dopamine_cycling":     "\033[93m",   # yellow
    "judge":                "\033[97m",   # white
}
RESET = "\033[0m"
BOLD  = "\033[1m"
DIM   = "\033[2m"


def colour(agent: str) -> str:
    return COLOURS.get(agent, "\033[96m")


# ── SSE helper ─────────────────────────────────────────────────────────────────

async def iter_sse(response: httpx.Response):
    async for line in response.aiter_lines():
        if line.startswith("data: "):
            yield json.loads(line[6:])


# ── Per-agent coroutine ────────────────────────────────────────────────────────

async def run_agent(client: httpx.AsyncClient, path: str, radar: dict):
    try:
        async with client.stream("POST", f"{BASE_URL}{path}", json=AGENT_REQUEST, timeout=120) as resp:
            async for event in iter_sse(resp):
                t = event["type"]
                if t == "agent_start":
                    c = colour(event["agent"])
                    print(f"\n{c}{BOLD}[ {event['label']} ]{RESET}", flush=True)
                elif t == "token":
                    print(f"{colour(event['agent'])}{event['text']}{RESET}", end="", flush=True)
                elif t == "tool_call":
                    print(f"\n{DIM}{colour(event['agent'])}  → calling tool: {event['tool']}{RESET}", flush=True)
                elif t == "agent_done":
                    c = colour(event["agent"])
                    score = event["score"]
                    bar = "█" * (score // 5) + "░" * (20 - score // 5)
                    print(f"\n{c}  SCORE: {BOLD}{score}/100{RESET} {c}[{bar}]{RESET}\n", flush=True)
                    radar[event["agent"]] = score
                elif t == "error":
                    print(f"\n{DIM}  [error: {event['message'][:80]}]{RESET}\n", flush=True)
    except httpx.RemoteProtocolError as e:
        print(f"\n{DIM}  [connection dropped: {e}]{RESET}\n", flush=True)


# ── Judge coroutine ────────────────────────────────────────────────────────────

async def run_judge(client: httpx.AsyncClient, radar: dict):
    body = {"radar": radar, "age": MOCK_AGE, "channel": MOCK_CHANNEL}
    async with client.stream("POST", f"{BASE_URL}/judge/stream", json=body, timeout=120) as resp:
        async for event in iter_sse(resp):
            t = event["type"]
            if t == "agent_start":
                print(f"\n{COLOURS['judge']}{BOLD}[ {event['label']} ]{RESET}", flush=True)
            elif t == "token":
                print(f"{COLOURS['judge']}{event['text']}{RESET}", end="", flush=True)
            elif t == "agent_done":
                c = COLOURS["judge"]
                score = event["score"]
                bar = "█" * (score // 5) + "░" * (20 - score // 5)
                print(f"\n{c}  BRAINROT SCORE: {BOLD}{score}/100{RESET} {c}[{bar}]{RESET}\n", flush=True)
            elif t == "final":
                print("\n" + "─" * 60)
                verdict_colour = {
                    "Enriching": "\033[92m", "Mostly Fine": "\033[92m",
                    "Mixed": "\033[93m", "Concerning": "\033[91m", "Brain Rot": "\033[91m",
                }.get(event.get("verdict", ""), "\033[97m")
                print(f"\n{BOLD}FINAL BRAINROT SCORE: {verdict_colour}{event['brainrot_score']}/100{RESET}")
                print(f"{verdict_colour}{BOLD}{event['verdict']}{RESET}  |  age {event['age_bracket']}  |  pacing risk: {event['fsm_risk_level']}")
                print(f"\n{DIM}{event['summary']}{RESET}\n")
                print(f"{BOLD}Radar:{RESET}")
                for dim, score in event["radar"].items():
                    bar = "█" * (score // 5) + "░" * (20 - score // 5)
                    c = colour(dim)
                    print(f"  {c}{dim:<22}{RESET} {score:>3}/100  {c}[{bar}]{RESET}")
                print()


# ── Server startup ─────────────────────────────────────────────────────────────

def _start_server():
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")


async def _wait_for_server(timeout: float = 10.0):
    deadline = time.monotonic() + timeout
    async with httpx.AsyncClient() as client:
        while time.monotonic() < deadline:
            try:
                r = await client.get(f"{BASE_URL}/openapi.json")
                if r.status_code == 200:
                    return
            except httpx.TransportError:
                pass
            await asyncio.sleep(0.2)
    raise RuntimeError("Server did not start in time")


# ── Main ───────────────────────────────────────────────────────────────────────

async def run_demo():
    print(f"\n{DIM}Starting server…{RESET}", flush=True)
    thread = threading.Thread(target=_start_server, daemon=True)
    thread.start()
    await _wait_for_server()
    print(f"{DIM}Server ready.{RESET}")

    print(f"\n{BOLD}RotCheck Demo{RESET}  {DIM}[mode: concurrent HTTP]{RESET}")
    print(f"{DIM}Video: {MOCK_CHANNEL} | Age: {MOCK_AGE} | Duration: {MOCK_SIGNALS['duration_sec']}s{RESET}")
    print(f"{DIM}Cuts/min: {MOCK_SIGNALS['cuts_per_min']} | Volume variance: {MOCK_SIGNALS['avg_volume_variance']}{RESET}\n")
    print("─" * 60)

    radar: dict = {}

    async with httpx.AsyncClient() as client:
        await asyncio.gather(
            run_agent(client, "/agents/pacing/stream",        radar),
            run_agent(client, "/agents/sensory/stream",       radar),
            run_agent(client, "/agents/educational/stream",   radar),
            run_agent(client, "/agents/manipulation/stream",  radar),
            run_agent(client, "/agents/dopamine/stream",      radar),
        )

        print("\n" + "─" * 60)
        await run_judge(client, radar)


if __name__ == "__main__":
    asyncio.run(run_demo())
