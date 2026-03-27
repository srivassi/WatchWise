"""
Behavioral Neuroscientist — scores the `dopamine_cycling` radar axis.
Models the variable reward schedule to estimate dopamine cycling risk.
"""
import json
from multiagent_flow.client import async_client, MODEL, parse_score
from multiagent_flow.age_bands import age_bracket_label

AGENT_ID = "dopamine_cycling"
AGENT_LABEL = "Behavioral Neuroscientist"

SYSTEM = """\
You are a Behavioral Neuroscientist specialising in dopaminergic reward systems and how \
media environments shape the developing brain's reward circuitry. Your research focuses on \
variable reward schedules in children's content — how cut frequency, audio surprises, and \
content hooks combine to create slot-machine-like reward patterns that drive compulsive viewing.

You have been given pacing and audio signals and a pre-computed reward schedule model for a \
video a child has watched. Write 2–3 sentences from your neuroscience perspective on what the \
reward structure means for this child's dopamine system.

End your response on a new line with exactly:
SCORE: <0-100>
(0 = healthy content cadence, no reward manipulation  |  100 = slot-machine-level dopamine cycling)\
"""


def _model_reward_schedule(cuts_per_min: float, volume_spike_frequency: float, duration_sec: int) -> dict:
    total_events_per_min = cuts_per_min + volume_spike_frequency
    avg_interval_sec = 60 / max(total_events_per_min, 0.1)

    schedule_type = (
        "continuous (low stimulation)"        if avg_interval_sec > 10 else
        "fixed-ratio (moderate stimulation)"  if avg_interval_sec > 4  else
        "variable-ratio (slot machine range)"
    )

    total_reward_events = int(total_events_per_min * duration_sec / 60)

    return {
        "avg_reward_interval_sec": round(avg_interval_sec, 2),
        "reward_schedule_type": schedule_type,
        "total_estimated_reward_events": total_reward_events,
        "slot_machine_risk": avg_interval_sec < 3,
        "neuroscience_note": (
            "Variable-ratio schedules under 3 seconds mirror slot machine mechanics — "
            "the most potent addiction-reinforcing pattern in behavioral neuroscience. "
            "Developing brains are especially vulnerable due to immature prefrontal inhibition."
            if avg_interval_sec < 3 else
            "Reward interval is above the high-risk threshold, though cumulative viewing time still matters."
        ),
    }


async def dopamine_agent(signals: dict, age: int):
    bracket = age_bracket_label(age)
    cuts = signals.get("cuts_per_min", 0)
    spike_freq = signals.get("volume_spike_frequency", 0)
    duration = signals.get("duration_sec", 0)

    analysis = _model_reward_schedule(cuts, spike_freq, duration)

    user = (
        f"Child age: {age} (bracket: {bracket})\n"
        f"Cuts per minute: {cuts}\n"
        f"Volume spike frequency (per min): {spike_freq}\n"
        f"Duration: {duration}s\n\n"
        f"Computed reward schedule model:\n{json.dumps(analysis, indent=2)}\n\n"
        "Model the reward schedule and assess dopamine cycling risk for this child."
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
