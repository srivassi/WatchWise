import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { ScoreCard } from "../components/ScoreCard";

const API = "http://localhost:8000";

const JUDGES = [
  {
    key: "pacing",       endpoint: "/agents/pacing/stream",
    name: "Pacing",      title: "Rhythm Judge",
    color: "#ff8c69",
    blob: "42% 58% 54% 46% / 56% 44% 58% 44%",
  },
  {
    key: "sensory",      endpoint: "/agents/sensory/stream",
    name: "Sensory",     title: "Stimulation Judge",
    color: "#5bbde4",
    blob: "52% 48% 44% 56% / 62% 38% 56% 44%",
  },
  {
    key: "educational",  endpoint: "/agents/educational/stream",
    name: "Learning",    title: "Education Judge",
    color: "#6dd49a",
    blob: "56% 44% 46% 54% / 44% 58% 42% 58%",
  },
  {
    key: "manipulation", endpoint: "/agents/manipulation/stream",
    name: "Influence",   title: "Manipulation Judge",
    color: "#ffc947",
    blob: "44% 56% 62% 38% / 54% 46% 46% 54%",
  },
  {
    key: "dopamine",     endpoint: "/agents/dopamine/stream",
    name: "Dopamine",    title: "Reward Judge",
    color: "#c3a8e8",
    blob: "62% 38% 48% 52% / 48% 62% 52% 48%",
  },
];

const IDLE_STATE    = { status: "idle",    thoughts: "", score: null };
const WAITING_STATE = { status: "waiting", thoughts: "", score: null };

/* ── Blob face SVG ───────────────────────────────────── */
function BlobFace({ status }) {
  if (status === "waiting") return (
    <svg viewBox="0 0 80 80" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <line x1="24" y1="37" x2="34" y2="37" stroke="white" strokeWidth="3.5" strokeLinecap="round" opacity="0.9" />
      <line x1="46" y1="37" x2="56" y2="37" stroke="white" strokeWidth="3.5" strokeLinecap="round" opacity="0.9" />
      <path d="M33 50 Q40 53 47 50" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.75" />
    </svg>
  );

  if (status === "thinking") return (
    <svg viewBox="0 0 80 80" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <circle cx="28" cy="35" r="7.5" fill="white" opacity="0.95" />
      <circle cx="52" cy="35" r="7.5" fill="white" opacity="0.95" />
      <circle cx="30" cy="36" r="3.5" fill="#3d3560" />
      <circle cx="54" cy="36" r="3.5" fill="#3d3560" />
      <circle cx="31.5" cy="34" r="1.2" fill="white" />
      <circle cx="55.5" cy="34" r="1.2" fill="white" />
      <ellipse cx="40" cy="53" rx="5" ry="4" fill="white" opacity="0.75" />
    </svg>
  );

  if (status === "done") return (
    <svg viewBox="0 0 80 80" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <path d="M21 38 Q28 29 35 38" stroke="white" strokeWidth="3.5" fill="none" strokeLinecap="round" opacity="0.95" />
      <path d="M45 38 Q52 29 59 38" stroke="white" strokeWidth="3.5" fill="none" strokeLinecap="round" opacity="0.95" />
      <path d="M25 50 Q40 63 55 50" stroke="white" strokeWidth="3.5" fill="none" strokeLinecap="round" opacity="0.95" />
    </svg>
  );

  /* error */
  return (
    <svg viewBox="0 0 80 80" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <circle cx="28" cy="35" r="7" fill="white" opacity="0.85" />
      <circle cx="52" cy="35" r="7" fill="white" opacity="0.85" />
      <circle cx="28" cy="35" r="3" fill="#3d3560" />
      <circle cx="52" cy="35" r="3" fill="#3d3560" />
      <path d="M28 54 Q40 48 52 54" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

/* ── Judge card ──────────────────────────────────────── */
function JudgeCard({ judge, state }) {
  const speechRef = useRef(null);

  useEffect(() => {
    if (speechRef.current)
      speechRef.current.scrollTop = speechRef.current.scrollHeight;
  }, [state.thoughts]);

  const { status, thoughts, score } = state;

  return (
    <div
      className={`judge-card judge-${status}`}
      style={{ "--jc": judge.color }}
    >
      {/* blob avatar */}
      <div className="judge-avatar-wrap">
        <div
          className={`judge-blob anim-${status}`}
          style={{ background: judge.color, borderRadius: judge.blob }}
        >
          <BlobFace status={status} />
        </div>
        {status === "thinking" && (
          <div className="think-dots">
            <div className="think-dot" />
            <div className="think-dot" />
            <div className="think-dot" />
          </div>
        )}
      </div>

      <div className="judge-name">{judge.name}</div>
      <div className="judge-title">{judge.title}</div>

      {thoughts ? (
        <div className="judge-speech" ref={speechRef}>
          {thoughts}
          {status === "thinking" && <span className="judge-cursor">▊</span>}
        </div>
      ) : status === "waiting" ? (
        <div className="judge-waiting-text">Getting ready…</div>
      ) : null}

      {status === "done" && score !== null && (
        <div className="judge-score-badge">Score: {score}</div>
      )}
      {status === "error" && (
        <div className="judge-error-text">Unavailable</div>
      )}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────── */
export default function VideoScore() {
  const [url, setUrl]         = useState("");
  const [age, setAge]         = useState(8);
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [showPanel, setShowPanel] = useState(false);
  const [judgeStates, setJudgeStates] = useState(
    Object.fromEntries(JUDGES.map(j => [j.key, IDLE_STATE]))
  );

  function patchJudge(key, patch) {
    setJudgeStates(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }
  function appendThought(key, text) {
    setJudgeStates(prev => ({
      ...prev,
      [key]: { ...prev[key], thoughts: prev[key].thoughts + text },
    }));
  }

  async function streamJudge(judge, payload) {
    patchJudge(judge.key, { status: "thinking", thoughts: "", score: null });
    try {
      const res = await fetch(`${API}${judge.endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { patchJudge(judge.key, { status: "error" }); return; }

      const reader = res.body.getReader();
      const dec    = new TextDecoder();
      let buf = "", finalScore = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();

        for (const raw of lines) {
          const line = raw.trim();
          if (!line || line === "[DONE]") continue;
          const chunk = line.startsWith("data: ") ? line.slice(6) : line;
          if (chunk === "[DONE]") continue;
          try {
            const obj = JSON.parse(chunk);
            const text = obj.text ?? obj.content ?? obj.chunk ?? obj.delta?.text ?? obj.delta?.content ?? "";
            if (text) appendThought(judge.key, text);
            if (obj.score !== undefined) finalScore = obj.score;
          } catch {
            if (chunk) appendThought(judge.key, chunk);
          }
        }
      }
      patchJudge(judge.key, { status: "done", score: finalScore });
    } catch {
      patchJudge(judge.key, { status: "error" });
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setResult(null); setLoading(true);
    setShowPanel(true);
    setJudgeStates(Object.fromEntries(JUDGES.map(j => [j.key, WAITING_STATE])));

    try {
      const { data: pipeline } = await axios.post(`${API}/pipeline`, { url, age: Number(age) });

      const agentPayload = {
        signals:    pipeline.signals,
        transcript: pipeline.transcript ?? "",
        channel:    pipeline.channel   ?? "",
        age:        Number(age),
      };

      await Promise.all([
        ...JUDGES.map(j => streamJudge(j, agentPayload)),
        axios.post(`${API}/score`, { url, age: Number(age) })
          .then(({ data }) => setResult(data))
          .catch(err => setError(err.response?.data?.detail || "Something went wrong")),
      ]);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to extract video data");
    } finally {
      setLoading(false);
      setStage("");
    }
  }

  const allDone = JUDGES.every(j =>
    judgeStates[j.key].status === "done" || judgeStates[j.key].status === "error"
  );
  const isWaiting = JUDGES.every(j => judgeStates[j.key].status === "waiting");

  return (
    <>
      <div className="card">
        <div className="section-title">Score a YouTube Video</div>
        <form onSubmit={handleSubmit}>
          <div className="row">
            <input
              type="text" placeholder="https://youtube.com/watch?v=…"
              value={url} onChange={e => setUrl(e.target.value)} required
            />
            <span className="age-label">Age</span>
            <input type="number" min={2} max={17} value={age}
              onChange={e => setAge(e.target.value)} />
            <button type="submit" disabled={loading}>
              {loading ? "Analyzing…" : "Analyze ✨"}
            </button>
          </div>
        </form>
        {error && <div className="error">{error}</div>}
      </div>

      {showPanel && (
        <div className="panel-of-judges">
          <div className="panel-header">
            <div className="panel-title">
              <span className="panel-title-stars">★</span>
              {" "}Panel of Judges{" "}
              <span className="panel-title-stars">★</span>
            </div>
            <div className="panel-subtitle">
              {isWaiting
                ? "Extracting video data…"
                : loading && !allDone
                ? "Deliberating…"
                : "Verdict reached!"}
            </div>
          </div>

          <div className="judges-grid">
            {JUDGES.map(judge => (
              <JudgeCard key={judge.key} judge={judge} state={judgeStates[judge.key]} />
            ))}
          </div>
        </div>
      )}

      {result && <ScoreCard result={result} />}
    </>
  );
}
