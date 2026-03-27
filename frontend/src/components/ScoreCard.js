import React from "react";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";

const VERDICT_COLORS = {
  Enriching:     "#1fa870",
  "Mostly Fine": "#38bb80",
  Mixed:         "#c98a00",
  Concerning:    "#d96020",
  "Brain Rot":   "#d83030",
};

const FSM_COLORS = {
  safe:     "#1fa870",
  moderate: "#c98a00",
  high:     "#d83030",
  unknown:  "#a098cc",
};

function barColor(score) {
  if (score < 30) return "#6dd49a";
  if (score < 55) return "#ffc947";
  if (score < 75) return "#ff8c69";
  return "#d83030";
}

export function ScoreCard({ result }) {
  const { brainrot_score, verdict, summary, radar, meta, age_bracket, fsm_risk_level } = result;
  
  const cleanSummary = typeof summary === 'string' 
    ? summary.replace(/[\*`~]/g, "").replace(/\/\//g, "") 
    : summary;

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
        <div className="verdict" style={{ color: VERDICT_COLORS[verdict] || "#3d3560" }}>{verdict}</div>

        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginTop: "0.5rem", flexWrap: "wrap" }}>
          {age_bracket && (
            <span style={{
              fontSize: "0.75rem", padding: "0.25rem 0.7rem",
              background: "#f0eeff", borderRadius: "999px",
              color: "#8b80b0", fontWeight: 800,
            }}>
              ages {age_bracket}
            </span>
          )}
          {fsm_risk_level && (
            <span style={{
              fontSize: "0.75rem", padding: "0.25rem 0.7rem",
              background: "#f0eeff", borderRadius: "999px",
              color: FSM_COLORS[fsm_risk_level] || "#a098cc",
              fontWeight: 800,
            }}>
              pacing: {fsm_risk_level}
            </span>
          )}
        </div>

        <p className="summary">{cleanSummary}</p>
      </div>

      {radarData.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: "1rem" }}>Breakdown</div>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e8e2ff" />
              <PolarAngleAxis dataKey="axis" tick={{ fill: "#a098cc", fontSize: 12, fontWeight: 700 }} />
              <Radar dataKey="value" stroke="#6248d4" fill="#6248d4" fillOpacity={0.2} />
            </RadarChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
