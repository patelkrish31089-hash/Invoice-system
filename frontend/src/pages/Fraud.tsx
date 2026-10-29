import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { Finding } from "../api/types";
import { BarList } from "../components/Charts";
import { Icon } from "../components/Icons";
import {
  Badge, Card, Empty, ErrorState, Field, InfoNote, Loading, Modal, PageHeader, Pagination, SearchInput, Tabs, useToast, StatusBadge,
} from "../components/UI";
import { dateTime, money, percent, relative, titleize } from "../utils/format";

type Tab = "findings" | "benford" | "relationships" | "vendors";

interface BenfordResult {
  eligible: boolean;
  reason: string | null;
  sample_size: number;
  statistic: number | null;
  p_value: number | null;
  significant: boolean;
  alpha: number;
  observed: number[] | null;
  expected: number[] | null;
  interpretation: string | null;
  assumption_warnings: string[];
  limitations: string[];
}

interface RelationshipResponse {
  graph: { nodes?: number; edges: number; shared: { bank: number; tax: number; address: number }; vendors?: number };
  findings: Array<{ rule_id: string; title: string; severity: string; explanation: string; evidence: Record<string, unknown> }>;
  disclaimer: string;
}

export default function FraudPage() {
  const [tab, setTab] = useState<Tab>("findings");
  const [findings, setFindings] = useState<{ items: Finding[]; total: number; page: number; page_size: number } | null>(null);
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("OPEN");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [resolving, setResolving] = useState<Finding | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const [benford, setBenford] = useState<BenfordResult | null>(null);
  const [benfordBusy, setBenfordBusy] = useState(false);
  const [relationships, setRelationships] = useState<RelationshipResponse | null>(null);
  const [vendorRisk, setVendorRisk] = useState<{ items: Array<{ vendor_id: number; vendor_name: string; invoice_count: number; average_risk: number; maximum_risk: number; total_amount: string }> } | null>(null);

  const loadFindings = useCallback(() => {
    setFindings(null);
    const params = new URLSearchParams({ page: String(page), page_size: "25" });
    if (severity) params.set("severity", severity);
    if (status) params.set("status", status);
    api.get<typeof findings>(`/findings?${params.toString()}`)
      .then((res) => { setFindings(res); setError(null); })
      .catch((err) => setError(err.message));
  }, [page, severity, status]);

  useEffect(() => { if (tab === "findings") loadFindings(); }, [tab, loadFindings]);

  useEffect(() => {
    if (tab === "relationships" && !relationships) {
      api.get<RelationshipResponse>("/analytics/relationships").then(setRelationships).catch((err) => setError(err.message));
    }
    if (tab === "vendors" && !vendorRisk) {
      api.get<{ items: typeof vendorRisk extends null ? never : NonNullable<typeof vendorRisk>["items"] }>("/analytics/vendors/risk")
        .then((res) => setVendorRisk(res as never)).catch((err) => setError(err.message));
    }
  }, [tab, relationships, vendorRisk]);

  const runBenford = async () => {
    setBenfordBusy(true);
    try {
      const result = await api.post<BenfordResult>("/analytics/benford", { min_sample: 30 });
      setBenford(result);
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "Benford analysis failed", "error");
    } finally {
      setBenfordBusy(false);
    }
  };

  const resolve = async () => {
    if (!resolving) return;
    setBusy(true);
    try {
      await api.post(`/findings/${resolving.uid}/false-positive`, { reason });
      toast.push("Finding closed as a false positive.", "success");
      setResolving(null);
      setReason("");
      loadFindings();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "Could not resolve finding", "error");
    } finally {
      setBusy(false);
    }
  };

  const filtered = (findings?.items || []).filter((item) => {
    if (!search) return true;
    const haystack = `${item.rule_id} ${item.title} ${item.invoice_number || ""} ${item.vendor_name || ""}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Risk & compliance"
        title="Fraud centre"
        subtitle="Findings are evidence-backed signals for investigators. A high score or a statistical outlier is a reason to look, not a conclusion that fraud occurred."
        actions={<Link className="btn" to="/models"><Icon name="model" /> Model performance</Link>}
      />

      <InfoNote tone="info">
        <strong>Interpretation policy.</strong> Duplicate and three-way-match findings are deterministic. Anomaly scores and Benford results are statistical leads; they do not establish intent. Every finding must be resolved by a human with a written reason.
      </InfoNote>

      <Tabs<Tab>
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "findings", label: "Findings", count: findings?.total },
          { id: "benford", label: "Benford analysis" },
          { id: "relationships", label: "Vendor relationships" },
          { id: "vendors", label: "Vendor risk" },
        ]}
      />

      {tab === "findings" && (
        <Card
          title="Findings register"
          subtitle="Deterministic rules, duplicate matches, anomaly model output and statistical tests"
          tight
          actions={
            <div className="row" style={{ gap: 8 }}>
              <SearchInput value={search} onChange={setSearch} placeholder="Filter findings" width={220} />
              <select className="select" value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1); }} style={{ width: 140 }} aria-label="Severity">
                <option value="">All severities</option>
                {["critical", "high", "medium", "low"].map((s) => <option key={s} value={s}>{titleize(s)}</option>)}
              </select>
              <select className="select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} style={{ width: 140 }} aria-label="Status">
                {["OPEN", "FALSE_POSITIVE", "RESOLVED", ""].map((s) => <option key={s || "all"} value={s}>{s ? titleize(s) : "All statuses"}</option>)}
              </select>
            </div>
          }
        >
          {error && <ErrorState message={error} onRetry={loadFindings} />}
          {!findings ? <Loading label="Loading findings" /> : filtered.length === 0 ? (
            <Empty title="No findings match" message="Try widening the filters or clear the search." icon="shield-check" />
          ) : (
            <>
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Severity</th><th>Rule</th><th>Finding</th><th>Invoice</th><th className="num">Points</th><th>Status</th><th>Raised</th><th /></tr></thead>
                  <tbody>
                    {filtered.map((finding) => (
                      <tr key={finding.uid}>
                        <td><span className={`sev ${finding.severity}`}>{finding.severity}</span></td>
                        <td className="mono tiny">{finding.rule_id}</td>
                        <td style={{ maxWidth: 380 }}>
                          <div className="cell-main">{finding.title}</div>
                          <div className="cell-sub truncate" title={finding.explanation}>{finding.explanation}</div>
                        </td>
                        <td>
                          {finding.invoice_uid ? (
                            <Link to={`/invoices/${finding.invoice_uid}`} className="cell-main">
                              {finding.invoice_number || <span className="muted">No number · {String(finding.invoice_uid || "").slice(0, 8)}</span>}
                            </Link>
                          ) : <span className="muted">—</span>}
                          <div className="cell-sub truncate" style={{ maxWidth: 160 }}>{finding.vendor_name || ""}</div>
                        </td>
                        <td className="num tabular">{finding.evidence?.score_contribution ? String(finding.evidence.score_contribution) : "—"}</td>
                        <td><Badge tone={finding.status === "OPEN" ? "warning" : finding.status === "FALSE_POSITIVE" ? "neutral" : "success"}>{titleize(finding.status)}</Badge></td>
                        <td className="tiny muted">{relative(finding.created_at)}</td>
                        <td className="right">
                          {finding.status === "OPEN" && (
                            <button className="btn sm" onClick={() => { setResolving(finding); setReason(""); }}>
                              Resolve
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={findings.page} pageSize={findings.page_size} total={findings.total} onPage={setPage} />
            </>
          )}
        </Card>
      )}

      {tab === "benford" && (
        <div className="split">
          <div className="stack">
            <Card
              title="First-digit (Benford) analysis"
              subtitle="Chi-square test with Benjamini–Hochberg correction across vendors"
              actions={<button className="btn primary" onClick={runBenford} disabled={benfordBusy}><Icon name="play" /> {benfordBusy ? "Running…" : "Run analysis"}</button>}
            >
              {!benford ? (
                <Empty
                  title="No analysis in this session"
                  message="Runs on all non-failed invoices for the tenant (or one vendor). Requires at least 30 usable amounts; the result is recorded as a statistical finding."
                  icon="model"
                />
              ) : !benford.eligible ? (
                <InfoNote tone="warning"><strong>Not enough data.</strong> {benford.reason}</InfoNote>
              ) : (
                <div className="stack">
                  <div className="row wrap" style={{ gap: 18 }}>
                    <div><div className="tiny muted">Sample size</div><div className="strong">{benford.sample_size}</div></div>
                    <div><div className="tiny muted">Chi-square</div><div className="strong">{benford.statistic?.toFixed(2)}</div></div>
                    <div><div className="tiny muted">p-value</div><div className="strong">{benford.p_value !== null ? benford.p_value.toExponential(2) : "—"}</div></div>
                    <div><div className="tiny muted">Significant at α={benford.alpha}</div><div className="strong">{benford.significant ? "Yes" : "No"}</div></div>
                  </div>
                  <div className="divider" />
                  <div className="grid grid-2">
                    <div>
                      <div className="tiny muted" style={{ marginBottom: 6 }}>Observed first-digit share</div>
                      <BarList items={(benford.observed || []).map((value, index) => ({ label: `Digit ${index + 1}`, value: value * 100, hint: `${(value * 100).toFixed(1)}%` }))} max={35} labelWidth={64} />
                    </div>
                    <div>
                      <div className="tiny muted" style={{ marginBottom: 6 }}>Benford expected share</div>
                      <BarList items={(benford.expected || []).map((value, index) => ({ label: `Digit ${index + 1}`, value: value * 100, hint: `${(value * 100).toFixed(1)}%` }))} max={35} color="#0f766e" labelWidth={64} />
                    </div>
                  </div>
                  <div className="alert info">
                    <Icon name="info" />
                    <div>{benford.interpretation}</div>
                  </div>
                  {benford.assumption_warnings.length > 0 && (
                    <div className="alert warning"><Icon name="alert" /><div>{benford.assumption_warnings.join(" ")}</div></div>
                  )}
                </div>
              )}
            </Card>
            <Card title="Method notes" subtitle="Why a Benford deviation is only a lead">
              <ul className="small muted" style={{ paddingLeft: 18, margin: 0, lineHeight: 1.8 }}>
                <li>Benford's law applies to naturally occurring magnitudes spanning several orders of magnitude, not to fixed-price catalogs or small samples.</li>
                <li>The test is run at the amount level, with a minimum sample of 30 and a strict α of 0.01 to limit false alarms.</li>
                <li>Results are stored with their limitations and never modify an invoice's status without a human decision.</li>
              </ul>
              <div className="divider" />
              <div className="tiny muted">{benford?.limitations?.join(" ") || "Run the analysis to see the recorded limitations."}</div>
            </Card>
          </div>
          <div className="stack">
            <Card title="What would make this significant?">
              <p className="small muted">A p-value below 0.01 after correction indicates that the first-digit distribution is unlikely under Benford's law. That can be caused by pricing policy, invoice templates or fraud; an investigator must establish which.</p>
            </Card>
            <Card title="Data included">
              <div className="kv">
                <dt>Scope</dt><dd>All non-failed invoices in the tenant</dd>
                <dt>Measure</dt><dd>First significant digit of the invoice total</dd>
                <dt>Minimum</dt><dd>30 usable values</dd>
                <dt>Storage</dt><dd>StatisticalFinding record</dd>
                <dt>Audit</dt><dd><span className="mono tiny">statistics.benford_run</span></dd>
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "relationships" && (
        <div className="stack">
          {!relationships ? <Loading label="Loading relationship graph" /> : (
            <>
              <InfoNote tone="warning">{relationships.disclaimer}</InfoNote>
              <div className="grid grid-3">
                <Card><div className="stat-label">Shared bank accounts</div><div className="stat-value">{relationships.graph.shared.bank}</div><div className="stat-sub">groups of vendors</div></Card>
                <Card><div className="stat-label">Shared tax identifiers</div><div className="stat-value">{relationships.graph.shared.tax}</div><div className="stat-sub">groups of vendors</div></Card>
                <Card><div className="stat-label">Shared addresses</div><div className="stat-value">{relationships.graph.shared.address}</div><div className="stat-sub">groups of vendors</div></Card>
              </div>
              <Card title="Relationship findings" subtitle="Vendors that share identifiers, accounts or addresses" tight>
                {relationships.findings.length === 0 ? <Empty title="No shared attributes detected" message="No two active vendors share a bank account, tax ID or normalised address in this dataset." icon="shield-check" /> : (
                  <div className="table-wrap">
                    <table className="data">
                      <thead><tr><th>Rule</th><th>Severity</th><th>Finding</th><th>Evidence</th></tr></thead>
                      <tbody>
                        {relationships.findings.map((finding) => (
                          <tr key={finding.rule_id + finding.title}>
                            <td className="mono tiny">{finding.rule_id}</td>
                            <td><span className={`sev ${finding.severity}`}>{finding.severity}</span></td>
                            <td>
                              <div className="cell-main">{finding.title}</div>
                              <div className="cell-sub" style={{ maxWidth: 520 }}>{finding.explanation}</div>
                            </td>
                            <td className="tiny mono muted" style={{ maxWidth: 260 }}>{JSON.stringify(finding.evidence).slice(0, 160)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
              <div className="tiny muted">Graph summary: {relationships.graph.edges} vendor→invoice edges across {relationships.graph.vendors ?? "—"} vendors. Relationship analysis is a screening aid; shared attributes can be legitimate (group entities, shared registered office).</div>
            </>
          )}
        </div>
      )}

      {tab === "vendors" && (
        <Card title="Vendor risk concentration" subtitle="Average risk of the latest assessment per invoice" tight>
          {!vendorRisk ? <Loading label="Loading vendor risk" /> : vendorRisk.items.length === 0 ? <Empty title="No vendor data" /> : (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Vendor</th><th className="num">Invoices</th><th className="num">Average risk</th><th className="num">Maximum</th><th className="num">Total value</th><th>Distribution</th></tr></thead>
                <tbody>
                  {vendorRisk.items.map((row) => (
                    <tr key={row.vendor_id}>
                      <td className="cell-main">{row.vendor_name || `Vendor ${row.vendor_id}`}</td>
                      <td className="num tabular">{row.invoice_count}</td>
                      <td className="num tabular">{row.average_risk.toFixed(1)}</td>
                      <td className="num tabular">{row.maximum_risk}</td>
                      <td className="num tabular">{money(row.total_amount)}</td>
                      <td style={{ width: 180 }}>
                        <div className="conf-bar"><i style={{ width: `${Math.min(row.average_risk, 100)}%`, background: row.average_risk >= 50 ? "#e11d48" : row.average_risk >= 25 ? "#d97706" : "#16a34a" }} /></div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {resolving && (
        <Modal
          title="Resolve finding as false positive"
          subtitle={`${resolving.rule_id} · ${resolving.title}`}
          onClose={() => setResolving(null)}
          footer={
            <>
              <button className="btn" onClick={() => setResolving(null)}>Cancel</button>
              <button className="btn primary" onClick={resolve} disabled={busy || reason.trim().length < 5}>{busy ? "Saving…" : "Resolve"}</button>
            </>
          }
        >
          <div className="stack" style={{ gap: 12 }}>
            <p className="small" style={{ color: "var(--ink-2)" }}>{resolving.explanation}</p>
            <Field label="Reason (min 5 characters)" hint="Record what evidence confirmed this was a legitimate transaction.">
              <textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
            </Field>
            <div className="tiny muted">Resolving updates the finding status and writes an audit event with your identity and the reason. It does not silently alter historical risk assessments.</div>
          </div>
        </Modal>
      )}
      <div className="row tiny muted" style={{ gap: 12 }}>
        <span>Last refreshed {dateTime(new Date().toISOString())}</span>
        <span>·</span>
        <span>{findings ? `${findings.total} findings in current filter` : "—"}</span>
      </div>
    </div>
  );
}
