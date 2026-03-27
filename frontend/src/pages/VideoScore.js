import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { ScoreCard } from "../components/ScoreCard";

const API = "http://localhost:8000";

const JUDGES = [
  {
    key: "pacing",       agentId: "pacing",              endpoint: "/agents/pacing/stream",
    name: "Pacing",      title: "Rhythm Judge",
    color: "#ff8c69",
    blob: "42% 58% 54% 46% / 56% 44% 58% 44%",
  },
  {
    key: "sensory",      agentId: "sensory_overload",    endpoint: "/agents/sensory/stream",
    name: "Sensory",     title: "Stimulation Judge",
    color: "#5bbde4",
    blob: "52% 48% 44% 56% / 62% 38% 56% 44%",
  },
  {
    key: "educational",  agentId: "educational_deficit", endpoint: "/agents/educational/stream",
    name: "Learning",    title: "Education Judge",
    color: "#6dd49a",
    blob: "56% 44% 46% 54% / 44% 58% 42% 58%",
  },
  {
    key: "manipulation", agentId: "manipulation",        endpoint: "/agents/manipulation/stream",
    name: "Influence",   title: "Manipulation Judge",
    color: "#ffc947",
    blob: "44% 56% 62% 38% / 54% 46% 46% 54%",
  },
  {
    key: "dopamine",     agentId: "dopamine_cycling",    endpoint: "/agents/dopamine/stream",
    name: "Dopamine",    title: "Reward Judge",
    color: "#c3a8e8",
    blob: "62% 38% 48% 52% / 48% 62% 52% 48%",
  },
];

const FINAL_JUDGE = {
  key: "judge",
  name: "Final Verdict",
  title: "Senior Child Media Health Reviewer",
  color: "#e8748a",
  blob: "50% 50% 50% 50% / 50% 50% 50% 50%",
};

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

/* ── SSE stream reader helper ────────────────────────── */
async function readSSEStream(res, onEvent) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";

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
        onEvent(JSON.parse(chunk));
      } catch {
        /* ignore malformed lines */
      }
    }
  }
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
    Object.fromEntries([...JUDGES, FINAL_JUDGE].map(j => [j.key, IDLE_STATE]))
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

  /* Stream one specialist agent; returns { agentId, score } */
  async function streamSpecialist(judge, payload) {
    patchJudge(judge.key, { status: "thinking", thoughts: "", score: null });
    let finalScore = null;
    try {
      const res = await fetch(`${API}${judge.endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { patchJudge(judge.key, { status: "error" }); return { agentId: judge.agentId, score: null }; }

      await readSSEStream(res, (obj) => {
        const text = obj.text ?? "";
        if (text) appendThought(judge.key, text);
        if (obj.score !== undefined) finalScore = obj.score;
      });

      patchJudge(judge.key, { status: "done", score: finalScore });
    } catch {
      patchJudge(judge.key, { status: "error" });
    }
    return { agentId: judge.agentId, score: finalScore };
  }

  /* Stream the final judge; uses radar from specialist scores */
  async function streamFinalJudge(radar, age, channel, meta) {
    patchJudge(FINAL_JUDGE.key, { status: "thinking", thoughts: "", score: null });
    try {
      const res = await fetch(`${API}/judge/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ radar, age, channel }),
      });
      if (!res.ok) { patchJudge(FINAL_JUDGE.key, { status: "error" }); return; }

      let finalScore = null;
      await readSSEStream(res, (obj) => {
        const text = obj.text ?? "";
        if (text) appendThought(FINAL_JUDGE.key, text);
        if (obj.score !== undefined) finalScore = obj.score;
        if (obj.type === "final") {
          setResult({ ...obj, meta });
        }
      });

      patchJudge(FINAL_JUDGE.key, { status: "done", score: finalScore });
    } catch {
      patchJudge(FINAL_JUDGE.key, { status: "error" });
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setResult(null); setLoading(true);
    setShowPanel(true);
    setJudgeStates(Object.fromEntries([...JUDGES, FINAL_JUDGE].map(j => [j.key, WAITING_STATE])));

    try {
      const { data: pipeline } = await axios.post(`${API}/pipeline`, { url, age: Number(age) });

      const agentPayload = {
        signals:    pipeline.signals,
        transcript: pipeline.transcript ?? "",
        channel:    pipeline.channel   ?? "",
        age:        Number(age),
      };

      /* Run all 5 specialists in parallel */
      const results = await Promise.all(JUDGES.map(j => streamSpecialist(j, agentPayload)));

      /* Build radar from returned scores (skip any that errored) */
      const radar = {};
      for (const { agentId, score } of results) {
        if (score !== null) radar[agentId] = score;
      }

      /* Run final judge with collected scores */
      await streamFinalJudge(radar, Number(age), pipeline.channel ?? "", pipeline.meta ?? {});
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to extract video data");
    } finally {
      setLoading(false);
    }
  }

  const specialists = JUDGES.map(j => judgeStates[j.key]);
  const allSpecialistsDone = specialists.every(s => s.status === "done" || s.status === "error");
  const isWaiting = [...JUDGES, FINAL_JUDGE].every(j => judgeStates[j.key].status === "waiting");
  const allDone = judgeStates[FINAL_JUDGE.key].status === "done" || judgeStates[FINAL_JUDGE.key].status === "error";

  return (
    <>
      <div style={{ textAlign: "center", marginBottom: "3rem", padding: "1rem 1rem 0" }}>
        <div style={{ display: "inline-block", color: "#8b9eed", fontSize: "0.85rem", fontWeight: "800", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "1.5rem" }}>
          ✦ 01 - VIDEO ANALYSIS ✦
        </div>
        <h1 style={{ color: "#2d3346", fontSize: "3.8rem", fontWeight: "900", margin: "0 0 0.5rem", lineHeight: "1.2", letterSpacing: "-0.01em" }}>
          Ensure their <span style={{ background: "#8b9eed", color: "#fff", padding: "0.1em 0.4em", borderRadius: "12px", display: "inline-block", transform: "rotate(-1.5deg)" }}>screen time</span> is
          <br />
          healthy
        </h1>
        <p style={{ color: "#6e758d", fontSize: "1.15rem", maxWidth: "680px", margin: "1.8rem auto 0", lineHeight: "1.7", fontWeight: "500" }}>
          Check any YouTube video for its pacing, sensory overload, and educational<br/>
          value. Our panel of specialized judges analyzes the content to give you<br/>
          peace of mind before your child watches.
        </p>
      </div>

      <div style={{ marginBottom: "2.5rem" }}>
        <form onSubmit={handleSubmit} style={{ background: "#fff", padding: "1.5rem", borderRadius: "24px", boxShadow: "0 12px 24px rgba(100, 70, 200, 0.05)", border: "2px solid #e8e2ff" }}>
          <div className="row" style={{ gap: "1rem" }}>
            <input
              type="text" placeholder="https://youtube.com/watch?v=…"
              value={url} onChange={e => setUrl(e.target.value)} required
              style={{ flex: 1, padding: "16px 20px", fontSize: "1.1rem", borderRadius: "16px", border: "2px solid #e8e2ff", outline: "none", background: "#f7f4ff" }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "#f0eeff", padding: "4px 16px", borderRadius: "16px" }}>
              <span className="age-label" style={{ fontWeight: 800, color: "#6248d4" }}>Age</span>
              <input type="number" min={2} max={17} value={age}
                onChange={e => setAge(e.target.value)} 
                style={{ width: "60px", padding: "8px", border: "none", borderRadius: "8px", textAlign: "center", fontWeight: "800", fontSize: "1.1rem", color: "#2d3346", background: "#fff" }}
              />
            </div>
            <button type="submit" disabled={loading} style={{ padding: "16px 32px", fontSize: "1.1rem", borderRadius: "16px", background: "#6248d4", color: "#fff", fontWeight: "800", border: "none", cursor: "pointer", transition: "transform 0.1s" }}>
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

          {/* Final judge appears once specialists are done */}
          {allSpecialistsDone && (
            <div style={{ marginTop: "1.5rem" }}>
              <div className="panel-subtitle" style={{ marginBottom: "1rem" }}>Final Verdict</div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <JudgeCard judge={FINAL_JUDGE} state={judgeStates[FINAL_JUDGE.key]} />
              </div>
            </div>
          )}
        </div>
      )}

      {result && <ScoreCard result={result} />}
    </>
  );
}
