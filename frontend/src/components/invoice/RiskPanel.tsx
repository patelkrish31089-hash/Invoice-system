import { api, ApiError } from "../../api/client";
import type { InvoiceDetail } from "../../api/types";
import { BarList, RiskGauge } from "../Charts";
import { Icon } from "../Icons";
import { Badge, Card, Empty, InfoNote, Modal, useToast } from "../UI";
import { useState } from "react";
import { percent, titleize } from "../../utils/format";

const CAPS: Record<string, number> = {
  duplicate: 40, reconciliation: 35, rules: 30, anomaly: 25, extraction: 15, statistical: 8, relationship: 20,
};

const SIGNAL_LABELS: Record<string, string> = {
  duplicate: "Duplicate evidence", reconciliation: "Three-way matching", rules: "Business rules",
  anomaly: "Anomaly model", extraction: "Extraction quality", statistical: "Statistical tests",
  relationship: "Vendor relationships",
};

export function RiskPanel({ invoice, onRefresh }: { invoice: InvoiceDetail; onRefresh: () => void }) {
  const risk = invoice.risk;
  const toast = useToast();
  const [resolving, setResolving] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (!risk) {
    return <Empty title="No risk assessment" message="Risk is calculated after extraction and reconciliation." icon="shield" />;
  }

  const categories = Object.keys(CAPS).map((key) => ({
    label: SIGNAL_LABELS[key],
    value: Number(risk.category_scores[key] || 0),
    hint: `${Number(risk.category_scores[key] || 0).toFixed(0)} / ${CAPS[key]}`,
    color: Number(risk.category_scores[key] || 0) > 0 ? "#3d5afe" : "#cbd5e1",
  }));

  const submitFalsePositive = async () => {
    if (!resolving || reason.trim().length < 5) return;
    setBusy(true);
    try {
      await api.post(`/findings/${resolving}/false-positive`, { reason: reason.trim() });
      toast.push("Finding marked as a false positive and closed.", "success");
      setResolving(null);
      setReason("");
      onRefresh();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "Could not resolve the finding", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <InfoNote tone="info">
        <strong>Risk score, not a fraud verdict.</strong> {risk.explanation}
      </InfoNote>

      <div className="grid grid-3">
        <Card title="Overall risk">
          <div style={{ display: "grid", placeItems: "center" }}>
            <RiskGauge score={risk.score} size={168} />
          </div>
          <div className="center" style={{ marginTop: 2 }}>
            <Badge tone={risk.category === "CRITICAL" ? "critical" : risk.category === "HIGH" ? "danger" : risk.category === "MEDIUM" ? "warning" : "success"}>
              {risk.category}
            </Badge>
          </div>
          <div className="divider" />
          <div className="kv">
            <dt>Engine</dt><dd className="mono tiny">{risk.engine_version}</dd>
            <dt>Anomaly model</dt><dd>{risk.model_version || "Not applied"}</dd>
            <dt>Anomaly percentile</dt><dd>{risk.anomaly_percentile !== null ? percent(risk.anomaly_percentile) : "—"}</dd>
            <dt>Assessed</dt><dd className="tiny">{risk.assessed_at.replace("T", " ").slice(0, 19)}</dd>
          </div>
        </Card>
        <Card title="Category contributions" subtitle="Points are capped per category to prevent one signal dominating">
          <BarList items={categories} max={40} labelWidth={150} />
          <div className="divider" />
          <div className="tiny muted">Total is capped at 100. Tiers: LOW &lt; 25 · MEDIUM ≥ 25 · HIGH ≥ 50 · CRITICAL ≥ 75.</div>
        </Card>
        <Card title="Anomaly model input" subtitle="Feature snapshot at scoring time">
          {Object.keys(risk.feature_snapshot || {}).length === 0 ? (
            <Empty title="Model not applied" message="Train the Isolation Forest to enable anomaly features." icon="model" />
          ) : (
            <div className="kv" style={{ gridTemplateColumns: "1fr auto", maxHeight: 260, overflowY: "auto" }}>
              {Object.entries(risk.feature_snapshot).slice(0, 18).map(([key, value]) => (
                <div key={key} style={{ display: "contents" }}>
                  <dt className="tiny" style={{ fontFamily: "var(--mono)" }}>{key}</dt>
                  <dd className="tiny tabular">{value === null || value === undefined ? "—" : Number(value).toFixed(3)}</dd>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Risk signals" subtitle="Every point awarded is traceable to evidence" tight>
        {risk.signals.length === 0 ? (
          <Empty title="No risk signals" message="The invoice matched cleanly within tolerance." icon="shield-check" />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Category</th><th>Signal</th><th className="num">Points</th><th>Evidence</th></tr></thead>
              <tbody>
                {risk.signals.map((signal, index) => (
                  <tr key={`${signal.code || signal.signal || "signal"}-${index}`}>
                    <td><span className="tag">{titleize(String(signal.category || "signal"))}</span></td>
                    <td className="small" style={{ maxWidth: 480 }}>
                      {signal.code && <div className="tiny mono muted">{signal.code}</div>}
                      {signal.title && <div className="strong small">{signal.title}</div>}
                      <div className="muted">{signal.detail}</div>
                    </td>
                    <td className="num strong">{signal.points.toFixed(0)}</td>
                    <td className="tiny mono muted" style={{ maxWidth: 260 }}>
                      {signal.evidence ? JSON.stringify(signal.evidence).slice(0, 140) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title={`Findings (${invoice.findings.length})`} subtitle="Deterministic rules, duplicate checks, statistical tests and relationship leads" tight>
        {invoice.findings.length === 0 ? (
          <Empty title="No findings raised" icon="shield-check" />
        ) : (
          <div className="stack" style={{ gap: 12, padding: 16 }}>
            {invoice.findings.map((finding) => (
              <div key={finding.uid} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 14, background: finding.status === "OPEN" ? "#fff" : "var(--surface-2)" }}>
                <div className="row wrap" style={{ gap: 8 }}>
                  <span className={`sev ${finding.severity}`}>{finding.severity}</span>
                  <span className="mono tiny">{finding.rule_id}</span>
                  <span className="strong small">{finding.title}</span>
                  <span className="spacer" />
                  <Badge tone={finding.status === "OPEN" ? "warning" : finding.status === "FALSE_POSITIVE" ? "neutral" : "success"}>{titleize(finding.status)}</Badge>
                </div>
                <p className="small" style={{ marginTop: 6, color: "var(--ink-2)" }}>{finding.explanation}</p>
                {Object.keys(finding.evidence || {}).length > 0 && (
                  <div className="row" style={{ marginTop: 8, gap: 6, flexWrap: "wrap" }}>
                    {Object.entries(finding.evidence).slice(0, 6).map(([key, value]) => (
                      <span className="tag" key={key}>{key}: <b style={{ fontWeight: 600 }}>{typeof value === "object" ? JSON.stringify(value).slice(0, 40) : String(value).slice(0, 48)}</b></span>
                    ))}
                  </div>
                )}
                {finding.status === "OPEN" && (
                  <div className="row" style={{ marginTop: 10 }}>
                    <button className="btn sm" onClick={() => { setResolving(finding.uid); setReason(""); }}>
                      <Icon name="check" /> Mark false positive
                    </button>
                    <span className="tiny muted">Resolution requires a documented reason and is written to the audit trail.</span>
                  </div>
                )}
                {finding.resolution_note && <div className="mini-note" style={{ marginTop: 8 }}>{finding.resolution_note}</div>}
              </div>
            ))}
          </div>
        )}
      </Card>

      {resolving && (
        <Modal
          title="Mark finding as a false positive"
          subtitle="The finding is closed and excluded from future routing; the invoice's risk is recalculated on the next analysis."
          onClose={() => setResolving(null)}
          footer={
            <>
              <button className="btn" onClick={() => setResolving(null)}>Cancel</button>
              <button className="btn primary" disabled={busy || reason.trim().length < 5} onClick={submitFalsePositive}>
                {busy ? "Saving…" : "Resolve finding"}
              </button>
            </>
          }
        >
          <label className="field">
            <span className="tiny strong">Reason (min 5 characters)</span>
            <textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Confirmed with procurement: the vendor reissued the same invoice after a credit note." />
          </label>
        </Modal>
      )}
    </div>
  );
}
