"""Shared Claude clients and utilities used by all scoring agents."""
import os, re
import anthropic
from dotenv import load_dotenv

load_dotenv()

MODEL = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
async_client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


def _call(system: str, user: str) -> str:
    """Blocking single-turn call. Used for non-streaming contexts."""
    msg = client.messages.create(
        model=MODEL, max_tokens=512, system=system,
        messages=[{"role": "user", "content": user}],
    )
    return msg.content[0].text


def parse_score(text: str, fallback: int = 50) -> int:
    """Extract SCORE: <number> from agent response text."""
    match = re.search(r"SCORE:\s*(\d+)", text, re.IGNORECASE)
    if match:
        return max(0, min(100, int(match.group(1))))
    return fallback
