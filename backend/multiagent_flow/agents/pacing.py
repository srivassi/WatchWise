"""
Cognitive Load Researcher — scores the `pacing` radar axis.
Uses the Fernando FSM string density model to quantify attentional demand.
"""
import json
from multiagent_flow.client import async_client, MODEL, parse_score
from multiagent_flow.age_bands import get_age_band, age_bracket_label

AGENT_ID = "pacing"
AGENT_LABEL = "Cognitive Load Researcher"

SYSTEM = """\
You are a Cognitive Load Researcher specialising in pediatric attention systems and how rapid \
visual transitions fragment attentional networks in developing brains. You apply Fernando's \
finite-state temporal string model: video pacing as strings over Σ = {s, n}, where string \
density |n|/t (cuts/min) is the primary attentional demand signal.

You have been given pacing signals and pre-computed attention load metrics for a video a child \
has watched. Write 2–3 sentences from your research perspective on what the pacing means for \
this child's developing attention system.

End your response on a new line with exactly:
SCORE: <0-100>
(0 = smooth, age-appropriate pacing  |  100 = severely overstimulating for this age group)\
"""


def _compute_attention_load(cuts_per_min: float, age: int, duration_sec: int) -> dict:
    band = get_age_band(age)
    max_cuts = band["max_cuts_per_min"]
    ratio = cuts_per_min / max(max_cuts, 1)

    if ratio <= 1.0:   risk = "within safe threshold"
    elif ratio <= 1.5: risk = "moderately above threshold"
    else:              risk = "severely above threshold"

    return {
        "string_density_cuts_per_min": round(cuts_per_min, 2),
        "safe_threshold_for_age": max_cuts,
        "ratio_to_threshold": round(ratio, 2),
        "risk_classification": risk,
        "total_estimated_cuts": int(cuts_per_min * duration_sec / 60),
        "fsm_note": (
            f"At {cuts_per_min}/min, burst sequences nᵏ where k>{int(cuts_per_min/2)} are likely — "
            f"exceeding working memory capacity for age {age}."
        ),
    }


async def pacing_agent(signals: dict, age: int):
    bracket = age_bracket_label(age)
    band = get_age_band(age)
    cuts = signals.get("cuts_per_min", 0)
    duration = signals.get("duration_sec", 0)

    analysis = _compute_attention_load(cuts, age, duration)

    user = (
        f"Child age: {age} (bracket: {bracket}, safe limit: ≤{band['max_cuts_per_min']} cuts/min)\n"
        f"Cuts per minute: {cuts}\n"
        f"Duration: {duration}s\n\n"
        f"Computed attention load analysis:\n{json.dumps(analysis, indent=2)}\n\n"
        "Assess the pacing demands on this child's attention system."
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
