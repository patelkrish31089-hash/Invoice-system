import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { DashboardMetrics, RecentUpload, WorkspaceCounts, Worklist } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Donut, RiskGauge, TrendChart } from "../components/Charts";
import { Icon } from "../components/Icons";
import { Card, Empty, ErrorState, InfoNote, Loading, PageHeader, RiskChip, Stat, StatusBadge } from "../components/UI";
import { bytes, compactMoney, dateTime, money, relative, titleize } from "../utils/format";
import { safeStorage } from "../utils/storage";

type Scope = "all" | "uploads";

function formatMs(value: number): string {
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(1)}s`;
}

/** Pipeline stage of an upload, as a percentage, for the live progress bar. */
function progressOf(upload: RecentUpload): number {
  const document = (upload.document_status || "").toUpperCase();
  const job = (upload.job_status || "").toUpperCase();
  if (document === "COMPLETED") return 100;
  if (document === "FAILED" || job === "DEAD_LETTER") return 100;
  if (invoiceJob(job)) return 70;
  if (job === "RUNNING" || document === "PROCESSING") return 45;
  if (job === "PENDING" || job === "RETRY_SCHEDULED" || document === "QUEUED") return 20;
  return 10;
}

function invoiceJob(job: string): boolean {
  return job === "SUCCEEDED";
}

function uploadTone(upload: RecentUpload): string {
  const document = (upload.document_status || "").toUpperCase();
  const job = (upload.job_status || "").toUpperCase();
  if (document === "COMPLETED") return "green";
  if (document === "FAILED" || job === "DEAD_LETTER") return "red";
  if (job === "RUNNING" || document === "PROCESSING") return "indigo";
  return "amber";
}

function uploadLabel(upload: RecentUpload): string {
  const document = (upload.document_status || "").toUpperCase();
  const job = (upload.job_status || "").toUpperCase();
  if (document === "COMPLETED") return "Processed";
  if (document === "FAILED") return "Failed";
  if (job === "DEAD_LETTER") return "Dead letter";
  if (job === "RUNNING" || document === "PROCESSING") return "Processing";
  if (job === "RETRY_SCHEDULED") return "Retry scheduled";
  if (job === "PENDING" || document === "QUEUED") return "Queued";
  return titleize(document || job || "Received");
}

export default function DashboardPage() {
  const { user, can } = useAuth();
  const [scope, setScope] = useState<Scope>(() =>
    (safeStorage.get("ig_dashboard_scope") as Scope) === "uploads" ? "uploads" : "all");
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [worklist, setWorklist] = useState<Worklist | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceCounts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const lastSeen = useRef<string>("");

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    Promise.all([
      api.get<DashboardMetrics>(`/dashboard/metrics?scope=${scope}`),
      api.get<Worklist>(`/dashboard/worklist?limit=6&scope=${scope}`),
      api.get<WorkspaceCounts>("/system/workspace"),
    ])
      .then(([m, w, ws]) => {
        // Replace state only when something changed, so an unchanged poll does not re-render the page.
        const key = JSON.stringify([m, w, ws]);
        if (key !== lastSeen.current) {
          lastSeen.current = key;
          setMetrics(m);
          setWorklist(w);
          setWorkspace(ws);
        }
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    safeStorage.set("ig_dashboard_scope", scope);
  }, [scope]);

  useEffect(() => {
    load();
    // No background polling: the figures load when the page opens or the scope changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  // Poll only while an upload is still being processed, so it appears here as soon as it settles.
  const uploadsInFlight = (worklist?.recent_uploads || []).some((u) => progressOf(u) < 100);
  useEffect(() => {
    if (!uploadsInFlight) return;
    const timer = window.setInterval(() => load(true), 5000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadsInFlight, scope]);

  const pendingUploads = useMemo(
    () => (worklist?.recent_uploads || []).filter((u) => progressOf(u) < 100).length,
    [worklist?.recent_uploads],
  );

  const clearDemoData = async () => {
    const message = "Delete every processed invoice and document in this workspace so only your own " +
      "uploads are shown?\n\nMaster data (vendors, purchase orders, goods receipts) is kept. This cannot be undone.";
    if (!window.confirm(message)) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = await api.post<{ deleted: Record<string, number> }>("/system/workspace/clear", { mode: "documents" });
      const documents = result.deleted.documents || 0;
      setNotice(`Removed ${documents} document${documents === 1 ? "" : "s"} and their invoices. ` +
        "The dashboard now reflects only the data that remains.");
      load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not clear the workspace.");
    } finally {
      setBusy(false);
    }
  };

  if (loading && !metrics) return <Loading label="Loading dashboard" />;
  if (error) return <ErrorState message={error} onRetry={() => load()} />;
  if (!metrics) return null;

  const { totals, processing } = metrics;
  const automationRate = totals.invoices > 0 ? Math.round((totals.matched / totals.invoices) * 100) : 0;
  const queues = Object.entries(metrics.by_queue).sort((a, b) => b[1] - a[1]);
  const riskSegments = [
    { label: "low", value: metrics.by_risk_category.LOW || 0, tone: "low" },
    { label: "medium", value: metrics.by_risk_category.MEDIUM || 0, tone: "medium" },
    { label: "high", value: metrics.by_risk_category.HIGH || 0, tone: "high" },
    { label: "critical", value: metrics.by_risk_category.CRITICAL || 0, tone: "critical" },
  ];
  const uploads = worklist?.recent_uploads || [];

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Accounts payable control tower"
        title="Invoice risk dashboard"
        subtitle="Live aggregates from persisted invoice, matching and risk records. Figures are read from the database when the page opens."
        actions={
          <>
            <div className="seg" role="group" aria-label="Data scope">
              <button
                type="button"
                className={scope === "all" ? "is-on" : ""}
                onClick={() => setScope("all")}
                aria-pressed={scope === "all"}
                title="Every document in this workspace, including the synthetic demo corpus"
              >
                All
              </button>
              <button
                type="button"
                className={scope === "uploads" ? "is-on" : ""}
                onClick={() => setScope("uploads")}
                aria-pressed={scope === "uploads"}
                title="Only documents uploaded by you"
              >
                Mine{workspace ? ` (${workspace.documents.mine})` : ""}
              </button>
            </div>
            <Link className="btn" to="/queue"><Icon name="queue" /> Processing queue</Link>
            <Link className="btn primary" to="/upload"><Icon name="upload" /> Upload invoices</Link>
          </>
        }
      />

      {notice && <InfoNote tone="success">{notice}</InfoNote>}

      {scope === "uploads" && uploads.length === 0 && (
        <InfoNote tone="info">
          <strong>You have not uploaded anything yet.</strong> Drop a PDF or photo into{" "}
          <Link to="/upload">Upload centre</Link> and it appears here within seconds, with its live
          processing status.
        </InfoNote>
      )}

      {pendingUploads > 0 && (
        <InfoNote tone="info">
          <span className="row" style={{ gap: 8, alignItems: "center" }}>
            <span className="live-dot" aria-hidden />
            <span>
              <strong>{pendingUploads} file{pendingUploads === 1 ? "" : "s"} in the pipeline.</strong>{" "}
              Figures update when you open the page, and again while a file is still processing.
            </span>
          </span>
        </InfoNote>
      )}

      {totals.invoices === 0 && (
        <InfoNote tone="warning">
          <strong>{scope === "uploads" ? "No processed invoices from your uploads yet." : "The workspace is empty."}</strong>{" "}
          Upload an invoice to begin, or seed the synthetic dataset with
          <span className="mono"> python scripts/seed_demo.py --reset --count 120</span>.
        </InfoNote>
      )}

      <div className="grid grid-4">
        <Stat
          label="Invoices processed" icon="invoices" tone="indigo"
          value={totals.invoices.toLocaleString("en-IN")}
          sub={<>{money(totals.amount_processed)} total value</>}
        />
        <Stat
          label="Awaiting review" icon="clock" tone="amber"
          value={totals.pending_review.toLocaleString("en-IN")}
          sub={<>{compactMoney(totals.amount_under_review)} under review</>}
        />
        <Stat
          label="High or critical risk" icon="shield" tone="red"
          value={totals.high_risk.toLocaleString("en-IN")}
          sub={<>{totals.critical_risk} critical · {totals.open_findings} open findings</>}
        />
        <Stat
          label="Matched to PO &amp; GRN" icon="match" tone="green"
          value={`${automationRate}%`}
          sub={<>{totals.matched} matched · {totals.mismatched} mismatched</>}
        />
      </div>

      <div className="grid grid-4">
        <Stat label="Confirmed duplicates" value={totals.confirmed_duplicates} icon="copy" tone="violet" sub={`${totals.potential_duplicates} potential near-duplicates`} />
        <Stat label="Low-confidence extractions" value={totals.low_confidence_extractions} icon="scan" tone="amber" sub="Below 60% field confidence" />
        <Stat label="Processing failures" value={totals.ocr_failures} icon="alert" tone="red" sub="Documents in FAILED state" />
        <Stat
          label="Median processing time" value={processing.median_ms !== null ? formatMs(processing.median_ms) : "—"}
          icon="clock" tone="teal" sub={processing.p95_ms !== null ? `p95 ${formatMs(processing.p95_ms)} · ${processing.documents_measured} documents` : "No documents processed"}
        />
      </div>

      <div className="split">
        <div className="stack">
          {(scope === "uploads" || pendingUploads > 0) && (
          <Card
            title="Recent uploads"
            subtitle={pendingUploads > 0 ? `Live — ${pendingUploads} file(s) still processing` : "Newest documents first"}
            actions={
              <>
                {pendingUploads > 0 && <span className="live-dot" aria-label="live" />}
                <Link className="link-btn" to="/upload">Upload another</Link>
              </>
            }
            tight
          >
            {uploads.length === 0 ? (
              <Empty
                title="Nothing uploaded yet"
                message="Accepted formats: PDF, PNG, JPEG. A new upload shows its queue state here until processing completes."
                icon="upload"
                action={<Link className="btn primary sm" to="/upload">Upload an invoice</Link>}
              />
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>File</th><th>Uploaded</th><th>Stage</th>
                      <th className="num">Invoice</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploads.slice(0, 6).map((upload) => (
                      <tr key={upload.document_uid}>
                        <td>
                          <div className="cell-main truncate" style={{ maxWidth: 210 }} title={upload.filename}>
                            {upload.filename}
                          </div>
                          <div className="tiny muted">{bytes(upload.size_bytes)}</div>
                        </td>
                        <td className="tiny muted upload-row-status">{relative(upload.uploaded_at)}</td>
                        <td style={{ minWidth: 120 }}>
                          <div className="row" style={{ gap: 6 }}>
                            <span className={`badge ${uploadTone(upload)}`}>{uploadLabel(upload)}</span>
                          </div>
                          <div className="upload-progress" style={{ marginTop: 6 }}>
                            <span style={{ width: `${progressOf(upload)}%` }} />
                          </div>
                        </td>
                        <td className="num">
                          {upload.invoice_uid ? (
                            <Link to={`/invoices/${upload.invoice_uid}`} className="cell-main">
                              {upload.invoice_number || "Open"}
                            </Link>
                          ) : <span className="tiny muted">—</span>}
                        </td>
                        <td>
                          {upload.invoice_status
                            ? <StatusBadge status={upload.invoice_status} />
                            : <span className="tiny muted">{uploadLabel(upload)}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          )}

          <Card
            title="Invoice intake — by invoice date"
            subtitle={`Last 30 active days of invoice dates${scope === "uploads" ? " (your uploads)" : " (all documents synthetic)"}`}
            actions={<span className="tag">{metrics.generated_at ? `generated ${dateTime(metrics.generated_at)}` : ""}</span>}
          >
            <TrendChart data={metrics.trend} />
            <div className="row" style={{ marginTop: 10, gap: 20 }}>
              <div><div className="tiny muted">Peak day</div><div className="strong">{metrics.trend.length ? Math.max(...metrics.trend.map((t) => t.count)) : 0} invoices</div></div>
              <div><div className="tiny muted">Days with activity</div><div className="strong">{metrics.trend.length}</div></div>
              <div><div className="tiny muted">Average / active day</div><div className="strong">{metrics.trend.length ? Math.round(metrics.trend.reduce((a, b) => a + b.count, 0) / metrics.trend.length) : 0}</div></div>
            </div>
          </Card>

          <Card title="Risk tiers" subtitle="Distribution of the latest risk assessment per invoice">
            <Donut segments={riskSegments} centerLabel="invoices" />
          </Card>

          <Card title="Highest-risk invoices" subtitle="Ranked by the explainable risk score" actions={<Link className="link-btn" to="/invoices?sort=-risk_score">View all</Link>} tight>
            {worklist && worklist.highest_risk.length > 0 ? (
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Invoice</th><th>Vendor</th><th>Status</th><th className="num">Amount</th><th>Risk</th></tr></thead>
                  <tbody>
                    {worklist.highest_risk.map((row) => (
                      <tr key={row.uid}>
                        <td><Link to={`/invoices/${row.uid}`} className="cell-main">{row.invoice_number || "—"}</Link></td>
                        <td className="truncate" style={{ maxWidth: 170 }}>{row.vendor_name || "Unmatched"}</td>
                        <td><StatusBadge status={row.status} /></td>
                        <td className="num">{money(row.total_amount)}</td>
                        <td><RiskChip category={row.risk_category} score={row.risk_score} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Empty title="No risk signals yet" message="Process an invoice to populate the worklist." />}
          </Card>
        </div>

        <div className="stack">
          <Card title="Review queues" subtitle="Work routed by the risk engine" tight>
            {queues.length === 0 && <Empty title="Queues are clear" icon="circle-check" />}
            {queues.map(([queue, count]) => (
              <Link key={queue} to={`/queue?queue=${queue}`} className="row" style={{ padding: "11px 16px", borderBottom: "1px solid #eef1f5", color: "inherit" }}>
                <div className={`stat-icon tone-${queue === "FRAUD" ? "red" : queue === "APPROVAL" ? "indigo" : queue === "DUPLICATE" ? "violet" : "teal"}`}><Icon name="queue" size={14} /></div>
                <div>
                  <div className="strong small">{titleize(queue)}</div>
                  <div className="tiny muted">{count} item{count === 1 ? "" : "s"} waiting</div>
                </div>
                <div style={{ marginLeft: "auto" }} className="strong">{count}</div>
              </Link>
            ))}
          </Card>

          <Card title="Risk score composition" subtitle="How the current portfolio scores">
            <div style={{ display: "grid", placeItems: "center" }}>
              <RiskGauge score={totals.invoices ? Math.round((metrics.by_risk_category.HIGH || 0) + (metrics.by_risk_category.CRITICAL || 0)) : 0} />
            </div>
            <div className="tiny muted center" style={{ marginTop: -4 }}>
              {totals.high_risk} of {totals.invoices} invoices need priority review
            </div>
            <div className="divider" />
            <div className="kv">
              <dt>Matched</dt><dd>{totals.matched}</dd>
              <dt>Mismatched</dt><dd>{totals.mismatched}</dd>
              <dt>Duplicates</dt><dd>{totals.confirmed_duplicates}</dd>
              <dt>Failed documents</dt><dd>{totals.ocr_failures}</dd>
            </div>
          </Card>

          <Card title="Recent findings" subtitle="Deterministic rules, duplicates and anomalies" tight>
            {worklist?.recent_findings.length ? (
              <div className="timeline" style={{ padding: "14px 16px 0 30px" }}>
                {worklist.recent_findings.slice(0, 6).map((finding) => (
                  <div className="timeline-item" key={finding.id}>
                    <div className="timeline-title">
                      {finding.invoice_uid ? <Link to={`/invoices/${finding.invoice_uid}`}>{finding.rule_id}</Link> : finding.rule_id}
                      <span className={`sev ${finding.severity}`} style={{ marginLeft: 8 }}>{finding.severity}</span>
                    </div>
                    <div className="timeline-meta">{finding.title} · {relative(finding.created_at)}</div>
                  </div>
                ))}
              </div>
            ) : <Empty title="No open findings" icon="shield-check" />}
          </Card>

          <Card title="Model evaluation" subtitle="Latest offline evaluation run" tight>
            {metrics.evaluation ? (
              <div style={{ padding: 16 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div className="strong">{metrics.evaluation.name}</div>
                  <span className="tag">{metrics.evaluation.type}</span>
                </div>
                <div className="tiny muted" style={{ marginTop: 4 }}>
                  {metrics.evaluation.dataset_size} labelled documents · {dateTime(metrics.evaluation.created_at)}
                </div>
                <div className="divider" />
                <div className="kv">
                  {Object.entries(metrics.evaluation.metrics).slice(0, 4).map(([key, value]) => (
                    <><dt key={`${key}-k`}>{titleize(key)}</dt><dd key={`${key}-v`}>{typeof value === "number" ? value.toFixed(3) : String(value)}</dd></>
                  ))}
                </div>
                <div className="mini-note" style={{ marginTop: 10 }}>{metrics.evaluation.note}</div>
                <Link className="btn sm" to="/models" style={{ marginTop: 10 }}>Open evaluation reports</Link>
              </div>
            ) : <Empty title="No evaluation run yet" message="Run python -m ml.evaluation.run to produce the offline evaluation report." />}
          </Card>
        </div>
      </div>
    </div>
  );
}
