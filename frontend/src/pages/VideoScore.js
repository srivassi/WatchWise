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
    intro: "I monitor how fast the cuts are to protect young attention spans.",
  },
  {
    key: "sensory",      agentId: "sensory_overload",    endpoint: "/agents/sensory/stream",
    name: "Sensory",     title: "Stimulation Judge",
    color: "#5bbde4",
    blob: "52% 48% 44% 56% / 62% 38% 56% 44%",
    intro: "I watch out for loud noises, bright colors, and overstimulation.",
  },
  {
    key: "educational",  agentId: "educational_deficit", endpoint: "/agents/educational/stream",
    name: "Learning",    title: "Education Judge",
    color: "#6dd49a",
    blob: "56% 44% 46% 54% / 44% 58% 42% 58%",
    intro: "I look for real learning value instead of empty entertainment.",
  },
  {
    key: "manipulation", agentId: "manipulation",        endpoint: "/agents/manipulation/stream",
    name: "Influence",   title: "Manipulation Judge",
    color: "#ffc947",
    blob: "44% 56% 62% 38% / 54% 46% 46% 54%",
    intro: "I catch sneaky tactics like fake scarcity and product pushing.",
  },
  {
    key: "dopamine",     agentId: "dopamine_cycling",    endpoint: "/agents/dopamine/stream",
    name: "Dopamine",    title: "Reward Judge",
    color: "#c3a8e8",
    blob: "62% 38% 48% 52% / 48% 62% 52% 48%",
    intro: "I evaluate the highs and lows of the video's reward loops.",
  },
];

const FINAL_JUDGE = {
  key: "judge",
  name: "Final Verdict",
  title: "Senior Child Media Health Reviewer",
  color: "#e8748a",
  blob: "50% 50% 50% 50% / 50% 50% 50% 50%",
  intro: "I'll review everyone's notes to give you the final verdict.",
};

const IDLE_STATE    = { status: "idle",    thoughts: "", score: null };
const WAITING_STATE = { status: "waiting", thoughts: "", score: null };

/* ── Blob face SVG ───────────────────────────────────── */
function BlobFace({ status, score }) {
  if (status === "waiting" || status === "idle" || status === "thinking") return (
    <svg viewBox="0 0 80 80" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <line x1="24" y1="37" x2="34" y2="37" stroke="white" strokeWidth="3.5" strokeLinecap="round" opacity="0.9" />
      <line x1="46" y1="37" x2="56" y2="37" stroke="white" strokeWidth="3.5" strokeLinecap="round" opacity="0.9" />
      <path d="M33 50 Q40 53 47 50" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.75" />
    </svg>
  );

  if (status === "done") {
    if (score !== null && score < 50) {
      return (
        <svg viewBox="0 0 80 80" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <path d="M21 38 Q28 35 35 38" stroke="white" strokeWidth="3.5" fill="none" strokeLinecap="round" opacity="0.95" />
          <path d="M45 38 Q52 35 59 38" stroke="white" strokeWidth="3.5" fill="none" strokeLinecap="round" opacity="0.95" />
          <path d="M25 55 Q40 46 55 55" stroke="white" strokeWidth="3.5" fill="none" strokeLinecap="round" opacity="0.95" />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 80 80" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <path d="M21 38 Q28 29 35 38" stroke="white" strokeWidth="3.5" fill="none" strokeLinecap="round" opacity="0.95" />
        <path d="M45 38 Q52 29 59 38" stroke="white" strokeWidth="3.5" fill="none" strokeLinecap="round" opacity="0.95" />
        <path d="M25 50 Q40 63 55 50" stroke="white" strokeWidth="3.5" fill="none" strokeLinecap="round" opacity="0.95" />
      </svg>
    );
  }

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
          <BlobFace status={status} score={score} />
        </div>
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
const PRESET_VIDEOS = [
  { title: "Cocomelon - Wheels on the Bus", url: "https://www.youtube.com/watch?v=e_04ZrNroTo", thumb: "https://img.youtube.com/vi/e_04ZrNroTo/0.jpg" },
  { title: "Ms Rachel - Baby Learning", url: "https://www.youtube.com/watch?v=HqgP0e557rA", thumb: "https://img.youtube.com/vi/HqgP0e557rA/0.jpg" },
  { title: "MrBeast - Extreme Challenge", url: "https://www.youtube.com/watch?v=0e3GPea1Tyg", thumb: "https://img.youtube.com/vi/0e3GPea1Tyg/0.jpg" },
  { title: "Blippi - Learn Colors", url: "https://www.youtube.com/watch?v=E-uQo1v5oX0", thumb: "https://img.youtube.com/vi/E-uQo1v5oX0/0.jpg" }
];

export default function VideoScore() {
  const [url, setUrl]         = useState("");
  const [age, setAge]         = useState(8);
  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [showPanel, setShowPanel] = useState(true);
  const [judgeStates, setJudgeStates] = useState(
    Object.fromEntries([...JUDGES, FINAL_JUDGE].map(j => [j.key, { ...IDLE_STATE, thoughts: j.intro }]))
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
        let text = obj.text ?? "";
        if (text) {
          text = text.replace(/[\*#`~]/g, "");
          appendThought(judge.key, text);
        }
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
        let text = obj.text ?? "";
        if (text) {
          text = text.replace(/[\*#`~]/g, "");
          appendThought(FINAL_JUDGE.key, text);
        }
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

  async function runPipelineForUrl(targetUrl) {
    setError(""); setResult(null); setLoading(true);
    setShowPanel(true);
    setJudgeStates(Object.fromEntries([...JUDGES, FINAL_JUDGE].map(j => [j.key, WAITING_STATE])));

    try {
      const { data: pipeline } = await axios.post(`${API}/pipeline`, { url: targetUrl, age: Number(age) });

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
      setStage("");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await runPipelineForUrl(url);
  }

  function handlePresetClick(presetUrl) {
    setUrl(presetUrl);
    runPipelineForUrl(presetUrl);
  }

  const specialists = JUDGES.map(j => judgeStates[j.key]);
  const allSpecialistsDone = specialists.every(s => s.status === "done" || s.status === "error");
  const isIdle = [...JUDGES, FINAL_JUDGE].every(j => judgeStates[j.key].status === "idle");
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
              {loading ? "Analyzing…" : "Analyze"}
            </button>
          </div>
        </form>
        {error && <div className="error">{error}</div>}
      </div>

      <div style={{ marginBottom: "2.5rem" }}>
        <p style={{ textAlign: "center", color: "#8b9eed", fontWeight: 800, fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "1.5rem" }}>
          Or try an example video
        </p>
        <div className="preset-carousel" style={{ display: "flex", gap: "1rem", overflowX: "auto", paddingBottom: "1rem" }}>
          {PRESET_VIDEOS.map((v, i) => (
             <div key={i} onClick={() => handlePresetClick(v.url)} style={{ cursor: "pointer", flex: "0 0 auto", width: "200px", borderRadius: "16px", overflow: "hidden", border: "2px solid #e8e2ff", background: "#fff", transition: "transform 0.15s, box-shadow 0.15s", boxShadow: "0 4px 12px rgba(100,70,200,0.05)" }} className="card-hover">
               <div style={{ background: "#f0eeff", backgroundImage: `url(${v.thumb})`, backgroundSize: "cover", backgroundPosition: "center", height: "112px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                 <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "rgba(98, 72, 212, 0.9)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", paddingLeft: "4px", backdropFilter: "blur(4px)" }}>
                   ▶
                 </div>
               </div>
               <div style={{ padding: "0.8rem", fontSize: "0.85rem", fontWeight: "800", color: "#3d3560", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                 {v.title}
               </div>
             </div>
          ))}
        </div>
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
              {isIdle
                ? "Ready to review your video"
                : isWaiting
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

          {/* Final judge appears once specialists are done, or initially in idle */}
          {(isIdle || allSpecialistsDone) && (
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
