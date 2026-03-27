# RotCheck 🧠

Scores how overstimulating/brain-rotty YouTube content is for kids, grounded in neuroscience.

Prezi link: https://prezi.com/p/edit/rsyd2wcrpvna/

Devpost link: https://devpost.com/software/rotcheck

## Prerequisites

- Python 3.11+
- Node.js 18+
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) installed and on PATH
- [ffmpeg](https://ffmpeg.org/download.html) installed and on PATH
- Anthropic API key

## Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt

# Add your Anthropic key to .env
# ANTHROPIC_API_KEY=sk-ant-...

uvicorn main:app --reload
```

API runs at http://localhost:8000

## Frontend Setup

```bash
cd frontend
npm install
npm start
```

App runs at https://watchwise-blond.vercel.app/

## Features

| Page | What it does |
|------|-------------|
| Score Video | Paste a YouTube URL → BrainRot score (0–100) + radar chart breakdown |
| Watch History | Upload Google Takeout `watch-history.json` → dashboard with trend line + creator table |
| Creator Lookup | Enter a channel URL → samples 5 recent videos → average kid-friendliness rating |

## Scoring Dimensions (Radar Chart)

- **Pacing** — cuts/min from audio onset detection (maps to attentional demand)
- **Sensory Overload** — volume spike frequency + avg volume variance (audio chaos)
- **Educational Value** — transcript + title analysis via Claude
- **Manipulation** — clickbait, parasocial language, fake urgency
- **Dopamine Cycling** — reward loop risk based on pacing + content patterns

## Age Adjustment

All three Claude agents receive the child's age. Thresholds shift — 3 cuts/min is flagged as high pacing for a 4-year-old but acceptable for a 12-year-old.

## Architecture

```
yt-dlp → audio (librosa: cuts_per_min, avg_volume_variance, volume_spike_frequency)
       → transcript (auto-subs)
       → metadata (title, channel, thumbnail, duration_sec)
            ↓
   behavioral_neuroscientist_agent (Claude) — dopamine cycling
   child_dev_learning_agent (Claude) — educational deficits
   child_consumer_psych_agent (Claude) — manipulation tactics
   cognitive_load_researcher_agent (Claude) — pacing, cognitive load
   sensory_integration_agent (Claude) — sensory overload
            ↓
   judge_agent (Claude) — synthesizes → BrainRot score + verdict + summary
```
