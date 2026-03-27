# WatchWise 🧠

Scores how overstimulating/brain-rotty YouTube content is for kids, grounded in neuroscience.

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

# Copy and fill in your Anthropic key
cp .env.example .env

uvicorn main:app --reload
```

API runs at http://localhost:8000

## Frontend Setup

```bash
cd frontend
npm install
npm start
```

App runs at http://localhost:3000

## Features

| Page | What it does |
|------|-------------|
| Score Video | Paste a YouTube URL → BrainRot score (0–100) + radar chart, with live agent streaming |
| Watch History | Upload Google Takeout `watch-history.json` → dashboard with trend line + creator table |
| Creator Lookup | Enter a channel URL → samples 5 recent videos → average kid-friendliness rating |

## Scoring Dimensions (Radar Chart)

- **Pacing** — cuts/min from ffmpeg scene detection (falls back to librosa onset detection)
- **Sensory Overload** — volume spike frequency + avg volume variance via IQR analysis
- **Educational Value** — transcript analysis via Claude
- **Manipulation** — clickbait, parasocial language, fake urgency detection
- **Dopamine Cycling** — variable reward schedule modelling from pacing + audio signals

## Age Adjustment

All scoring agents receive the child's age. Thresholds shift — 3 cuts/min is flagged as high pacing for a 4-year-old but acceptable for a 12-year-old.

## Architecture

```
yt-dlp → video (ffmpeg: scene cuts → cuts_per_min)
       → audio (librosa: avg_volume_variance, volume_spike_frequency)
       → transcript (auto-subs) + metadata (title, channel, thumbnail, duration_sec)
            ↓
   pacing_agent          — attentional demand (Fernando FSM model)
   sensory_agent         — audio environment vs clinical thresholds
   educational_agent     — content quality + language complexity
   manipulation_agent    — clickbait, parasocial language, fake urgency
   dopamine_agent        — variable reward schedule risk
            ↓
   judge_agent — synthesizes → BrainRot score (0–100) + verdict + radar + summary
```

Results stream to the frontend in real-time as each specialist completes.
Pipeline output is cached in-memory so repeated URLs skip re-downloading.
