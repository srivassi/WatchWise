"""
Child Consumer Psychology Analyst — scores the `manipulation` radar axis.
Detects dark patterns that exploit children's psychological vulnerabilities.
"""
import json
from multiagent_flow.client import async_client, MODEL, parse_score
from multiagent_flow.age_bands import age_bracket_label

AGENT_ID = "manipulation"
AGENT_LABEL = "Child Consumer Psychology Analyst"

SYSTEM = """\
You are a Child Consumer Psychology Analyst who researches how digital media exploits \
children's developmental vulnerabilities for engagement and commercial gain. You have deep \
expertise in the specific manipulation tactics used in children's content: parasocial bonding, \
engineered FOMO, fake urgency, clickbait framing, and engagement-bait language that targets \
children who lack the cognitive defenses adults have.

You have been given a video transcript and pre-computed manipulation pattern scan results. \
Write 2–3 sentences from your analytical perspective on what you find and what it means for \
a child viewer.

End your response on a new line with exactly:
SCORE: <0-100>
(0 = no manipulative tactics detected  |  100 = heavily engineered to exploit child psychology)\
"""


def _scan_manipulation_patterns(transcript: str) -> dict:
    if not transcript:
        return {
            "patterns_detected": {},
            "categories_flagged": 0,
            "high_concern": False,
            "analyst_note": "No transcript available — pattern scan could not be performed.",
        }

    lower = transcript.lower()

    pattern_library = {
        "parasocial_bonding": [
            "i love you guys", "you're my favorite", "we're best friends",
            "our family", "you guys are everything", "i need you",
        ],
        "fake_urgency": [
            "right now", "don't miss", "limited time", "hurry", "last chance",
            "before it's gone", "act fast", "only today",
        ],
        "engagement_bait": [
            "smash that like", "hit subscribe", "ring the bell", "comment below",
            "let me know", "drop a like", "turn on notifications",
        ],
        "fomo_triggers": [
            "everyone is", "you don't want to miss", "viral", "trending",
            "all your friends", "can you believe", "you've never seen",
        ],
        "clickbait_framing": [
            "you won't believe", "gone wrong", "exposed", "shocking", "secret",
            "they don't want you to know", "this is why", "wait for it",
        ],
    }

    found: dict[str, list] = {}
    for category, phrases in pattern_library.items():
        hits = [p for p in phrases if p in lower]
        if hits:
            found[category] = hits

    return {
        "patterns_detected": found,
        "categories_flagged": len(found),
        "high_concern": len(found) >= 3,
        "analyst_note": (
            f"{len(found)} manipulation categories detected. "
            + (
                "Content employs multiple overlapping tactics consistent with engagement-maximising "
                "design that exploits children's underdeveloped impulse control and parasocial tendencies."
                if len(found) >= 3 else
                "Some tactics present but not a coordinated manipulation pattern."
                if len(found) > 0 else
                "No explicit manipulation language detected in transcript."
            )
        ),
    }


async def manipulation_agent(transcript: str, channel: str, age: int):
    bracket = age_bracket_label(age)

    analysis = _scan_manipulation_patterns(transcript)
    transcript_snippet = transcript[:1500] if transcript else "(no transcript available)"

    user = (
        f"Child age: {age} (bracket: {bracket})\n"
        f"Channel: {channel}\n"
        f"Transcript (first 1500 chars):\n{transcript_snippet}\n\n"
        f"Computed manipulation pattern scan:\n{json.dumps(analysis, indent=2)}\n\n"
        "Identify any manipulation tactics targeting this child viewer."
    )

    yield {"type": "agent_start", "agent": AGENT_ID, "label": AGENT_LABEL}

    full_text = ""
    async with async_client.messages.stream(
        model=MODEL, max_tokens=200, system=SYSTEM,
        messages=[{"role": "user", "content": user}],
    ) as stream:
        async for text in stream.text_stream:
            full_text += text
            yield {"type": "token", "agent": AGENT_ID, "text": text}

    yield {"type": "agent_done", "agent": AGENT_ID, "label": AGENT_LABEL, "score": parse_score(full_text)}
