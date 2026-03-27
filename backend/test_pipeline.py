"""
Quick end-to-end test. Run from the backend/ folder:
    python test_pipeline.py
    python test_pipeline.py https://www.youtube.com/watch?v=...
"""
import sys, json, asyncio

URL = sys.argv[1] if len(sys.argv) > 1 else "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
AGE = 8


def section(title):
    print(f"\n{'='*50}\n  {title}\n{'='*50}")


# ── Step 0: check system tools ────────────────────────────────────────────────
section("0/3  Checking system tools")
import subprocess
for tool in ["yt-dlp", "ffmpeg"]:
    try:
        r = subprocess.run([tool, "--version"], capture_output=True, timeout=5)
        print(f"  ✓ {tool} found")
    except FileNotFoundError:
        print(f"  ✗ {tool} NOT found — install it and add to PATH")
    except Exception as e:
        print(f"  ✗ {tool} error: {e}")


# ── Step 1: imports ────────────────────────────────────────────────────────────
section("1/3  Checking imports")
try:
    from pipeline.video import run_pipeline
    from multiagent_flow.scoring import score_video
    from routers import router
    print("  ✓ all imports ok")
except Exception as e:
    print(f"  ✗ import failed: {e}")
    sys.exit(1)


# ── Step 2: pipeline (no API call) ─────────────────────────────────────────────
section(f"2/3  Running video pipeline\n  url: {URL}")
try:
    data = run_pipeline(URL)
    signals = {
        "cuts_per_min":          data.get("cuts_per_min"),
        "avg_volume_variance":   data.get("avg_volume_variance"),
        "volume_spike_frequency":data.get("volume_spike_frequency"),
        "duration_sec":          data.get("duration_sec"),
    }
    print(f"  title:      {data.get('title', '(none)')}")
    print(f"  channel:    {data.get('channel', '(none)')}")
    print(f"  transcript: {len(data.get('transcript', ''))} chars")
    print(f"  signals:    {json.dumps(signals, indent=14)}")

    missing = [k for k, v in signals.items() if not v]
    if missing:
        print(f"\n  ⚠ zero values for: {missing}")
    else:
        print("\n  ✓ all signals populated")
except Exception as e:
    print(f"  ✗ pipeline failed: {e}")
    sys.exit(1)


# ── Step 3: scoring agents (burns API credits) ─────────────────────────────────
section("3/3  Running scoring agents (API call)")
answer = input("  Run scoring agents? Uses API credits. [y/N] ").strip().lower()
if answer != "y":
    print("  skipped.")
    sys.exit(0)

async def run_scoring():
    result = await score_video(
        transcript=data.get("transcript", ""),
        signals=signals,
        age=AGE,
        channel=data.get("channel", ""),
    )
    result["meta"] = {
        "title": data.get("title"),
        "channel": data.get("channel"),
        "duration": data.get("duration_sec"),
        "thumbnail": data.get("thumbnail"),
    }
    return result

try:
    result = asyncio.run(run_scoring())
    print(f"\n  brainrot_score : {result.get('brainrot_score')}")
    print(f"  verdict        : {result.get('verdict')}")
    print(f"  summary        : {result.get('summary')}")
    print(f"  radar          : {json.dumps(result.get('radar'), indent=18)}")
    print("\n  ✓ full pipeline working")
except Exception as e:
    print(f"  ✗ scoring failed: {e}")
    sys.exit(1)
