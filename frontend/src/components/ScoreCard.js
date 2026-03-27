import React from "react";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";

const VERDICT_COLORS = {
  Enriching: "#34d399",
  "Mostly Fine": "#86efac",
  Mixed: "#fbbf24",
  Concerning: "#fb923c",
  "Brain Rot": "#f87171",
};

const FSM_COLORS = {
  safe: "#34d399",
  moderate: "#fbbf24",
  high: "#f87171",
  unknown: "#9090b0",
};

function barColor(score) {
  if (score < 30) return "#34d399";
  if (score < 55) return "#fbbf24";
  if (score < 75) return "#fb923c";
  return "#f87171";
}

export function ScoreCard({ result }) {
  const { brainrot_score, verdict, summary, radar, meta, age_bracket, fsm_risk_level } = result;
  const radarData = Object.entries(radar || {}).map(([key, val]) => ({
    axis: key.replace(/_/g, " "),
    value: val,
  }));

  return (
    <div className="card">
      {meta?.thumbnail && (
        <div className="meta-row">
          <img src={meta.thumbnail} alt="thumb" />
          <div>
            <div className="meta-title">{meta.title}</div>
            <div className="meta-channel">{meta.channel}</div>
          </div>
        </div>
      )}

      <div className="gauge-wrap">
        <div className="gauge-score">{brainrot_score}</div>
        <div className="gauge-bar-bg">
          <div className="gauge-bar" style={{ width: `${brainrot_score}%`, background: barColor(brainrot_score) }} />
        </div>
        <div className="verdict" style={{ color: VERDICT_COLORS[verdict] || "#e8e8f0" }}>{verdict}</div>

        {/* Age bracket + FSM risk badges */}
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginTop: "0.5rem", flexWrap: "wrap" }}>
          {age_bracket && (
            <span style={{
              fontSize: "0.75rem", padding: "0.2rem 0.6rem",
              background: "#2a2a3a", borderRadius: "999px", color: "#9090b0",
            }}>
              ages {age_bracket}
            </span>
          )}
          {fsm_risk_level && (
            <span style={{
              fontSize: "0.75rem", padding: "0.2rem 0.6rem",
              background: "#2a2a3a", borderRadius: "999px",
              color: FSM_COLORS[fsm_risk_level] || "#9090b0",
            }}>
              pacing: {fsm_risk_level}
            </span>
          )}
        </div>

        <p className="summary">{summary}</p>
      </div>

      {radarData.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: "1rem" }}>Breakdown</div>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#2a2a3a" />
              <PolarAngleAxis dataKey="axis" tick={{ fill: "#9090b0", fontSize: 12 }} />
              <Radar dataKey="value" stroke="#c084fc" fill="#c084fc" fillOpacity={0.25} />
            </RadarChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
