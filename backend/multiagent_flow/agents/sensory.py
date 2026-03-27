"""
Sensory Integration Therapist — scores the `sensory_overload` radar axis.
Assesses the audiovisual environment against clinical sensory processing thresholds.
"""
import json
from multiagent_flow.client import async_client, MODEL, parse_score
from multiagent_flow.age_bands import get_age_band, age_bracket_label

AGENT_ID = "sensory_overload"
AGENT_LABEL = "Sensory Integration Therapist"

SYSTEM = """\
You are a Sensory Integration Therapist with clinical experience treating children with sensory \
processing difficulties. Your expertise is in how audiovisual environments impact a child's \
nervous system regulation — particularly how volume chaos, sudden loudness spikes, and sustained \
auditory unpredictability dysregulate developing sensory systems.

You have been given audio environment metrics and pre-computed sensory load assessment for a \
video a child has watched. Write 2–3 sentences from your therapeutic perspective on what you observe.

End your response on a new line with exactly:
SCORE: <0-100>
(0 = calm, well-regulated sensory environment  |  100 = severe sensory overwhelm risk)\
"""


def _assess_sensory_load(volume_variance: float, spike_frequency: float, age: int) -> dict:
    band = get_age_band(age)
    max_spike_pct = band["max_volume_spike_pct"]

    variance_level = (
        "stable" if volume_variance < 0.3 else
        "moderate" if volume_variance < 0.6 else
        "jarring"
    )
    spike_level = (
        "calm" if spike_frequency < 5 else
        "moderate" if spike_frequency < 10 else
        "chaotic"
    )

    return {
        "volume_variance": round(volume_variance, 3),
        "volume_variance_level": variance_level,
        "spike_frequency_level": spike_level,
        "safe_variance_for_age": max_spike_pct,
        "threshold_exceeded": volume_variance > max_spike_pct,
        "db_overload_risk": volume_variance > 0.6,
        "clinical_note": (
            "Sustained exposure at this level is associated with sensory dysregulation and "
            "heightened cortisol response in children under 8." if spike_frequency > 10 else
            "Spike frequency is within manageable range, though cumulative exposure matters."
        ),
    }


async def sensory_agent(signals: dict, age: int):
    bracket = age_bracket_label(age)
    band = get_age_band(age)
    variance = signals.get("avg_volume_variance", 0)
    spike_freq = signals.get("volume_spike_frequency", 0)

    analysis = _assess_sensory_load(variance, spike_freq, age)

    user = (
        f"Child age: {age} (bracket: {bracket}, safe volume spike threshold: {band['max_volume_spike_pct']})\n"
        f"Avg volume variance (0–1): {variance}\n"
        f"Volume spike frequency (per min): {spike_freq}\n"
        f"Duration: {signals.get('duration_sec', 0)}s\n\n"
        f"Computed sensory load assessment:\n{json.dumps(analysis, indent=2)}\n\n"
        "Assess the sensory load of this video's audio environment for this child."
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
