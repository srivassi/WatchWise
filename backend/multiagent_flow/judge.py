"""
Senior Child Media Health Reviewer — synthesises all 5 specialist scores into a final verdict.
Brainrot score is computed deterministically from age-weighted radar; Claude streams the summary.
"""
from multiagent_flow.client import async_client, MODEL
from multiagent_flow.age_bands import age_bracket_label, compute_brainrot_score, get_verdict, get_age_band

AGENT_ID = "judge"
AGENT_LABEL = "Senior Child Media Health Reviewer"

SYSTEM = """\
You are a Senior Child Media Health Reviewer who synthesises findings from a panel of specialists \
into a clear, parent-facing verdict. You have received scores from five domain experts who each \
assessed a different dimension of the content. Your job is to write a 2–3 sentence summary that \
explains, in plain language, what this content is doing to a child's developing brain and whether \
parents should be concerned. Be direct and specific — reference the dimensions that drove the score.\
"""


def _fsm_risk(pacing_score: int) -> str:
    if pacing_score < 35:   return "safe"
    if pacing_score < 65:   return "moderate"
    return "high"


async def judge_agent(radar: dict, age: int, channel: str):
    bracket = age_bracket_label(age)
    brainrot_score = compute_brainrot_score(radar, age)
    verdict = get_verdict(brainrot_score)
    band = get_age_band(age)

    user = (
        f"Child age: {age} (bracket: {bracket})\n"
        f"Channel: {channel}\n"
        f"Specialist scores (0–100, higher = more harmful):\n"
        + "\n".join(f"  {dim}: {score}" for dim, score in radar.items()) +
        f"\n\nFinal brainrot score (age-weighted): {brainrot_score}/100\n"
        f"Verdict: {verdict}\n\n"
        "Write your parent-facing summary."
    )

    yield {"type": "agent_start", "agent": AGENT_ID, "label": AGENT_LABEL}

    summary = ""
    async with async_client.messages.stream(
        model=MODEL, max_tokens=200, system=SYSTEM,
        messages=[{"role": "user", "content": user}],
    ) as stream:
        async for text in stream.text_stream:
            summary += text
            yield {"type": "token", "agent": AGENT_ID, "text": text}

    yield {"type": "agent_done", "agent": AGENT_ID, "label": AGENT_LABEL, "score": brainrot_score}
    yield {
        "type": "final",
        "brainrot_score": brainrot_score,
        "verdict": verdict,
        "summary": summary.strip(),
        "radar": radar,
        "age_bracket": bracket,
        "fsm_risk_level": _fsm_risk(radar.get("pacing", 50)),
    }
