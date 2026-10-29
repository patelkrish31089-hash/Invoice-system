import { useId } from "react";

export function TrendChart({ data, height = 180 }: { data: Array<{ date: string; count: number }>; height?: number }) {
  const id = useId().replace(/:/g, "");
  const width = 640;
  const pad = { l: 30, r: 8, t: 10, b: 22 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  if (data.length === 0) {
    return <div className="empty" style={{ padding: 24 }}><span className="small">No activity in this period.</span></div>;
  }
  const max = Math.max(1, ...data.map((d) => d.count));
  const step = data.length > 1 ? innerW / (data.length - 1) : 0;
  const points = data.map((d, i) => {
    const x = pad.l + i * step;
    const y = pad.t + innerH - (d.count / max) * innerH;
    return [x, y] as const;
  });
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${(pad.l + (data.length - 1) * step).toFixed(1)},${pad.t + innerH} L${pad.l},${pad.t + innerH} Z`;
  const ticks = [0, Math.ceil(max / 2), max];
  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Invoice volume trend">
      <defs>
        <linearGradient id={`areaGradient-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#3d5afe" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#3d5afe" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {ticks.map((t) => {
        const y = pad.t + innerH - (t / max) * innerH;
        return (
          <g key={t}>
            <line className="axis" x1={pad.l} x2={width - pad.r} y1={y} y2={y} />
            <text x={pad.l - 6} y={y + 3} textAnchor="end">{t}</text>
          </g>
        );
      })}
      <path d={area} fill={`url(#areaGradient-${id})`} />
      <path d={line} className="line" />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.4} fill="#3d5afe" stroke="#fff" strokeWidth={1.4} />
      ))}
      {data.map((d, i) => {
        if (data.length > 10 && i % Math.ceil(data.length / 6) !== 0 && i !== data.length - 1) return null;
        const [x] = points[i];
        return <text key={d.date} x={x} y={height - 6} textAnchor="middle">{d.date.slice(5)}</text>;
      })}
    </svg>
  );
}

const PALETTE: Record<string, string> = {
  low: "#16a34a", medium: "#d97706", high: "#e11d48", critical: "#9d174d",
  MATCHED: "#16a34a", MATCHED_WITHIN_TOLERANCE: "#4d7c0f", PARTIALLY_MATCHED: "#d97706",
  MISMATCHED: "#e11d48", MISSING_PO: "#7c3aed", MISSING_GRN: "#a855f7",
  INSUFFICIENT_DATA: "#64748b", MANUAL_REVIEW_REQUIRED: "#0ea5e9",
  APPROVAL: "#3d5afe", MATCHING: "#0ea5e9", FRAUD: "#e11d48", EXTRACTION: "#8b5cf6", DUPLICATE: "#9d174d",
};

export function Donut({ segments, total, centerLabel, size = 150 }: {
  segments: Array<{ label: string; value: number; tone?: string }>;
  total?: number; centerLabel?: string; size?: number;
}) {
  const sum = total ?? segments.reduce((acc, s) => acc + s.value, 0);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox="0 0 140 140" role="img" aria-label="Distribution">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#eef1f6" strokeWidth="16" />
        {sum > 0 && segments.map((seg) => {
          const fraction = seg.value / sum;
          const dash = fraction * circumference;
          const el = (
            <circle
              key={seg.label}
              cx="70" cy="70" r={radius} fill="none"
              stroke={PALETTE[seg.tone || seg.label] || "#64748b"}
              strokeWidth="16"
              strokeDasharray={`${Math.max(dash - 2, 0)} ${circumference - Math.max(dash - 2, 0)}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
              strokeLinecap="butt"
            />
          );
          offset += dash;
          return el;
        })}
        <text x="70" y="66" textAnchor="middle" className="donut-center">{sum}</text>
        {centerLabel && <text x="70" y="83" textAnchor="middle" style={{ fontSize: 9.5 }}>{centerLabel}</text>}
      </svg>
      <div className="legend" style={{ flexDirection: "column", gap: 6 }}>
        {segments.filter((s) => s.value > 0).map((seg) => (
          <span key={seg.label}>
            <i style={{ background: PALETTE[seg.tone || seg.label] || "#64748b" }} />
            <span style={{ minWidth: 96 }}>{seg.label.replaceAll("_", " ").toLowerCase()}</span>
            <b className="tabular" style={{ color: "var(--ink-2)" }}>{seg.value}</b>
          </span>
        ))}
        {segments.every((s) => s.value === 0) && <span className="muted">No data yet</span>}
      </div>
    </div>
  );
}

export function BarList({ items, max, color = "#3d5afe", labelWidth = 130 }: {
  items: Array<{ label: string; value: number; hint?: string; color?: string }>;
  max?: number; color?: string; labelWidth?: number;
}) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <div>
      {items.map((item) => (
        <div className="bar-row" key={item.label} style={{ gridTemplateColumns: `${labelWidth}px 1fr 52px` }}>
          <span className="truncate" title={item.label}>{item.label}</span>
          <span className="bar-track"><span className="bar-fill" style={{ width: `${(item.value / top) * 100}%`, background: item.color || color }} /></span>
          <span className="tabular right" style={{ color: "var(--ink-2)", fontWeight: 600 }}>{item.hint ?? item.value}</span>
        </div>
      ))}
      {items.length === 0 && <div className="muted small">No data to chart.</div>}
    </div>
  );
}

export function RiskGauge({ score, size = 132 }: { score: number; size?: number }) {
  const pct = Math.max(0, Math.min(score, 100));
  const radius = 52;
  const circumference = Math.PI * radius;
  const filled = (pct / 100) * circumference;
  const color = pct >= 75 ? "#9d174d" : pct >= 50 ? "#e11d48" : pct >= 25 ? "#d97706" : "#16a34a";
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 140 86" role="img" aria-label={`Risk score ${score} of 100`}>
      <path d="M18 74 A52 52 0 0 1 122 74" fill="none" stroke="#eef1f6" strokeWidth="12" strokeLinecap="round" />
      <path
        d="M18 74 A52 52 0 0 1 122 74" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
      />
      <text x="70" y="66" textAnchor="middle" style={{ fontSize: 26, fontWeight: 650, fill: "var(--ink)" }}>{score}</text>
      <text x="70" y="82" textAnchor="middle" style={{ fontSize: 9, letterSpacing: "0.08em" }}>RISK / 100</text>
    </svg>
  );
}
