import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { InvoiceDetail, User } from "../api/types";
import { Icon } from "../components/Icons";
import { DocumentViewer } from "../components/invoice/DocumentViewer";
import { FieldTable } from "../components/invoice/FieldTable";
import { MatchPanel } from "../components/invoice/MatchPanel";
import { RiskPanel } from "../components/invoice/RiskPanel";
import { WorkflowPanel } from "../components/invoice/WorkflowPanel";
import {
  Badge, Card, Confidence, Empty, ErrorState, Field, InfoNote, Loading, Modal, PageHeader, RiskChip, StatusBadge, Tabs, useToast,
} from "../components/UI";
import { date, dateTime, money, percent, titleize } from "../utils/format";

type Tab = "overview" | "document" | "match" | "risk" | "workflow";
type ActionKind = "approve" | "reject" | "escalate" | "request-info" | "assign" | "note" | "correct";

const ACTION_TITLES: Record<ActionKind, string> = {
  approve: "Approve for payment staging", reject: "Reject invoice", escalate: "Escalate to fraud review",
  "request-info": "Request more information", assign: "Assign reviewer", note: "Add review note",
  correct: "Correct an extracted field",
};

const CORRECTABLE_FIELDS = [
  ["vendor_name", "text"], ["vendor_tax_id", "text"], ["invoice_number", "text"], ["invoice_date", "date"],
  ["due_date", "date"], ["po_number", "text"], ["currency", "text"], ["payment_terms", "text"],
  ["subtotal", "money"], ["tax_amount", "money"], ["discount_amount", "money"], ["shipping_amount", "money"],
  ["total_amount", "money"],
] as const;

export default function InvoiceDetailPage() {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [action, setAction] = useState<ActionKind | null>(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [reviewers, setReviewers] = useState<User[]>([]);
  const [assignee, setAssignee] = useState<string>("");
  const [correctionField, setCorrectionField] = useState("total_amount");
  const [correctionValue, setCorrectionValue] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    if (!uid) return;
    api.get<InvoiceDetail>(`/invoices/${uid}`)
      .then((res) => { setInvoice(res); setError(null); })
      .catch((err) => setError(err.message));
  }, [uid]);

  useEffect(load, [load]);
  useEffect(() => {
    api.get<{ items: User[] }>("/users").then((res) => setReviewers(res.items)).catch(() => undefined);
  }, []);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!invoice) return <Loading label="Loading invoice" />;

  const openAction = (kind: ActionKind) => {
    setAction(kind);
    setReason("");
    setNotes("");
    setAssignee(invoice.assigned_reviewer?.uid || "");
    setCorrectionValue("");
    if (kind === "correct") {
      const value = (invoice.extraction.field_evidence?.[correctionField]?.normalized ?? "") as string;
      setCorrectionValue(value ? String(value) : "");
    }
  };

  const submitAction = async () => {
    if (!action) return;
    setBusy(true);
    try {
      if (action === "assign") {
        const reviewer = reviewers.find((user) => user.uid === assignee);
        await api.post(`/invoices/${invoice.uid}/assign`, { reviewer_id: reviewer ? reviewer.id : null });
        toast.push(reviewer ? `Assigned to ${reviewer.full_name}.` : "Assignment cleared.", "success");
      } else if (action === "note") {
        await api.post(`/invoices/${invoice.uid}/notes`, { note: reason });
        toast.push("Note added.", "success");
      } else if (action === "correct") {
        await api.post(`/invoices/${invoice.uid}/corrections`, {
          field: correctionField, value: correctionValue, reason,
        });
        toast.push("Correction saved; invoice re-analysed.", "success");
      } else {
        await api.post(`/invoices/${invoice.uid}/${action}`, { reason, notes: notes || undefined });
        toast.push(`Invoice ${action === "request-info" ? "marked as awaiting information" : action + "d"}.`, "success");
      }
      setAction(null);
      load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "The action could not be completed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const reanalyze = async () => {
    setBusy(true);
    try {
      await api.post(`/invoices/${invoice.uid}/reanalyze`);
      toast.push("Invoice re-analysed with the current policy.", "success");
      load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "Reanalysis failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const minimumReason = action === "reject" || action === "escalate" || action === "request-info" ? 5 : action === "note" ? 2 : action === "correct" ? 5 : 3;
  const requiresReason = action !== "assign";
  const canSubmit = !requiresReason || reason.trim().length >= minimumReason;
  const isTerminal = ["APPROVED_FOR_PAYMENT_STAGE", "REJECTED"].includes(invoice.status);

  return (
    <div className="stack">
      <div className="row" style={{ gap: 6 }}>
        <Link to="/invoices" className="btn ghost sm"><Icon name="arrow-left" /> Invoice registry</Link>
        {invoice.document && (
          <Link to={`/invoices/${invoice.uid}/ocr`} className="btn ghost sm"><Icon name="scan" /> OCR evidence viewer</Link>
        )}
      </div>

      <PageHeader
        eyebrow={`${invoice.vendor?.name || invoice.vendor_name_raw || "Unmatched vendor"} · ${invoice.po_number || "no PO reference"}`}
        title={invoice.invoice_number || "Unnumbered invoice"}
        subtitle={
          <div className="row wrap" style={{ gap: 8, marginTop: 6 }}>
            <StatusBadge status={invoice.status} />
            <RiskChip category={invoice.risk_category} score={invoice.risk_score} />
            <StatusBadge status={invoice.reconciliation_status} />
            {invoice.is_duplicate && <Badge tone="critical">Confirmed duplicate</Badge>}
            <span className="tag">{titleize(invoice.review_queue)} queue</span>
            <span className="tag">Inv date {date(invoice.invoice_date)}</span>
          </div>
        }
        actions={
          <>
            <button className="btn" onClick={reanalyze} disabled={busy}><Icon name="refresh" /> Re-analyse</button>
            <button className="btn" onClick={() => openAction("note")}><Icon name="file" /> Add note</button>
            <button className="btn" onClick={() => openAction("assign")}><Icon name="users" /> Assign</button>
            {!isTerminal && (
              <>
                <button className="btn" onClick={() => openAction("request-info")}><Icon name="info" /> Request info</button>
                <button className="btn" onClick={() => openAction("escalate")}><Icon name="flag" /> Escalate</button>
                <button className="btn danger" onClick={() => openAction("reject")}><Icon name="circle-x" /> Reject</button>
                <button className="btn primary" onClick={() => openAction("approve")}><Icon name="circle-check" /> Approve</button>
              </>
            )}
          </>
        }
      />

      {invoice.is_duplicate && (
        <InfoNote tone="danger">
          <strong>Duplicate invoice.</strong> This document matches another invoice by checksum or business key. Approval is blocked until a fraud investigator resolves the duplicate finding.
        </InfoNote>
      )}
      {invoice.extraction.warnings.length > 0 && (
        <InfoNote tone="warning">
          <strong>Extraction notes</strong>
          <ul style={{ margin: "4px 0 0", paddingLeft: 16 }}>
            {invoice.extraction.warnings.map((warning) => <li key={warning} className="small">{warning}</li>)}
          </ul>
        </InfoNote>
      )}

      <div className="grid grid-4">
        <Card><div className="stat-label">Invoice total</div><div className="money lg" style={{ marginTop: 6 }}>{money(invoice.total_amount, invoice.currency || "INR")}</div><div className="tiny muted">Subtotal {money(invoice.subtotal)} · tax {money(invoice.tax_amount)}</div></Card>
        <Card><div className="stat-label">Risk score</div><div className="row" style={{ marginTop: 6, gap: 8 }}><span className="money lg">{invoice.risk_score}</span><span className="muted">/ 100</span></div><div className="tiny muted">{titleize(invoice.risk_category)} · engine v1</div></Card>
        <Card><div className="stat-label">Extraction confidence</div><div style={{ marginTop: 10 }}><Confidence value={invoice.extraction.confidence} /></div><div className="tiny muted" style={{ marginTop: 4 }}>{invoice.extraction.method} · {invoice.extraction.extractor_version || "unknown extractor"}</div></Card>
        <Card><div className="stat-label">Document</div><div className="row" style={{ marginTop: 6, gap: 6 }}><StatusBadge status={invoice.document?.status} /><span className="tag">{invoice.document?.page_count || 0}p</span></div><div className="tiny muted mono" style={{ marginTop: 4 }}>{invoice.document?.sha256.slice(0, 18)}…</div></Card>
      </div>

      <Tabs<Tab>
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "document", label: "Source document" },
          { id: "match", label: "3-way match", count: invoice.reconciliation?.discrepancies.length },
          { id: "risk", label: "Risk & findings", count: invoice.findings.length },
          { id: "workflow", label: "Workflow & audit" },
        ]}
      />

      {tab === "overview" && (
        <div className="split">
          <div className="stack">
            <Card
              title="Extracted fields"
              subtitle="Confidence, method and evidence location for every field"
              tight
              actions={<button className="btn sm" onClick={() => openAction("correct")}><Icon name="scan" /> Correct field</button>}
            >
              <FieldTable invoice={invoice} />
            </Card>

            <Card title={`Line items (${invoice.lines.length})`} subtitle="Quantity, price and arithmetic confidence per line" tight>
              <div className="table-wrap">
                <table className="data compact">
                  <thead><tr><th>#</th><th>Item</th><th>Description</th><th className="num">Qty</th><th className="num">Unit price</th><th className="num">Tax %</th><th className="num">Line total</th><th>Conf.</th></tr></thead>
                  <tbody>
                    {invoice.lines.map((line) => (
                      <tr key={line.id}>
                        <td className="muted">{line.line_no}</td>
                        <td className="mono tiny">{line.item_code || "—"}</td>
                        <td className="truncate" style={{ maxWidth: 260 }}>{line.description || "—"}</td>
                        <td className="num tabular">{line.quantity ?? "—"}</td>
                        <td className="num tabular">{money(line.unit_price)}</td>
                        <td className="num tabular">{line.tax_rate ?? "—"}</td>
                        <td className="num tabular money">{money(line.line_total)}</td>
                        <td><Confidence value={line.confidence} showLabel={false} /></td>
                      </tr>
                    ))}
                    {invoice.lines.length === 0 && <tr><td colSpan={8}><div className="table-empty">No line items were extracted.</div></td></tr>}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="Financial validation" subtitle="Decimal arithmetic checks recorded with the extraction" tight>
              <div style={{ padding: 16 }}>
                {Object.keys(invoice.extraction.validation || {}).length === 0 ? <Empty title="No validation record" icon="match" /> : (
                  <div className="kv">
                    {Object.entries(invoice.extraction.validation).map(([key, value]) => (
                      <div key={key} style={{ display: "contents" }}>
                        <dt>{titleize(key)}</dt>
                        <dd className="small" style={{ fontFamily: typeof value === "object" ? "var(--mono)" : undefined, fontSize: typeof value === "object" ? 11 : undefined }}>
                          {typeof value === "object" ? JSON.stringify(value) : String(value)}
                        </dd>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>

          <div className="stack">
            <Card title="Vendor & invoice">
              <div className="kv">
                <dt>Vendor</dt><dd>{invoice.vendor ? <Link to="/vendors">{invoice.vendor.name}</Link> : invoice.vendor_name_raw || "Unmatched"}</dd>
                <dt>Vendor code</dt><dd className="mono">{invoice.vendor?.code || "—"}</dd>
                <dt>Match score</dt><dd>{invoice.vendor_match_score !== null ? percent(invoice.vendor_match_score) : "—"}</dd>
                <dt>Tax ID</dt><dd className="mono tiny">{invoice.vendor_tax_id || "—"}</dd>
                <dt>Invoice date</dt><dd>{date(invoice.invoice_date)}</dd>
                <dt>Due date</dt><dd>{date(invoice.due_date)}</dd>
                <dt>Terms</dt><dd>{invoice.payment_terms || "—"}</dd>
                <dt>PO number</dt><dd className="mono">{invoice.po_number || "—"}</dd>
              </div>
              <div className="divider" />
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                <Badge tone="teal">{invoice.currency || "INR"}</Badge>
                <Badge tone="neutral">{invoice.extraction.method}</Badge>
                {invoice.reconciliation && <Badge tone="info">{invoice.reconciliation.engine_version}</Badge>}
                {invoice.risk?.model_version && <Badge tone="violet">{invoice.risk.model_version}</Badge>}
              </div>
            </Card>

            <Card title="Routing" subtitle="Why the workflow sent this invoice where it did">
              <div className="row" style={{ gap: 8 }}>
                <div className="stat-icon tone-indigo"><Icon name="match" size={14} /></div>
                <div>
                  <div className="strong small">{titleize(invoice.review_queue)} queue</div>
                  <div className="tiny muted">Priority from risk tier and matching outcome</div>
                </div>
              </div>
              <div className="divider" />
              <p className="small muted">{invoice.routing_reason || "No routing reason recorded."}</p>
              <div className="divider" />
              <div className="kv">
                <dt>Assigned reviewer</dt><dd>{invoice.assigned_reviewer?.full_name || "Unassigned"}</dd>
                <dt>Created</dt><dd>{dateTime(invoice.created_at)}</dd>
                <dt>Updated</dt><dd>{dateTime(invoice.updated_at)}</dd>
              </div>
            </Card>

            <Card title="Document provenance">
              {invoice.document ? (
                <div className="kv">
                  <dt>Filename</dt><dd className="truncate">{invoice.document.filename}</dd>
                  <dt>Content type</dt><dd>{invoice.document.content_type}</dd>
                  <dt>Pages</dt><dd>{invoice.document.page_count}</dd>
                  <dt>SHA-256</dt><dd className="mono tiny" style={{ wordBreak: "break-all" }}>{invoice.document.sha256}</dd>
                  <dt>Malware scan</dt><dd>{invoice.document.malware_status}</dd>
                  <dt>Processing</dt><dd>{invoice.document.processing_ms ? `${(invoice.document.processing_ms / 1000).toFixed(2)}s` : "—"}</dd>
                  <dt>Source</dt><dd>{invoice.document.source_channel}</dd>
                </div>
              ) : <Empty title="No document" icon="file" />}
            </Card>

            <Card title="Raw extracted text" tight>
              <div style={{ padding: 12 }}>
                <details>
                  <summary className="small muted" style={{ cursor: "pointer" }}>Show extracted text (first 20k characters)</summary>
                  <pre className="raw-text" style={{ marginTop: 8 }}>{invoice.extraction.raw_text || "No text recorded."}</pre>
                </details>
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "document" && (
        <div className="split">
          <Card title="Source document" subtitle="Served through an authenticated, tenant-scoped endpoint">
            <DocumentViewer document={invoice.document} />
          </Card>
          <div className="stack">
            <Card title="Evidence anchors">
              <p className="small muted">Every extracted field stores the page and bounding box from the OCR layer. Open the OCR evidence viewer to see boxes over the page and compare them with the values below.</p>
              <div className="divider" />
              <div className="stack" style={{ gap: 8 }}>
                {Object.entries(invoice.extraction.field_evidence || {}).slice(0, 8).map(([field, evidence]) => (
                  <div className="row" key={field} style={{ gap: 8 }}>
                    <span className="tiny muted" style={{ width: 100 }}>{titleize(field)}</span>
                    <span className="tag">p{evidence.page ?? "—"}</span>
                    <span className="tiny mono">{Array.isArray(evidence.bbox) ? evidence.bbox.map((n) => Math.round(Number(n))).join(", ") : "no box"}</span>
                    <span className="spacer" />
                    <Confidence value={evidence.confidence} showLabel={false} />
                  </div>
                ))}
              </div>
              <div className="divider" />
              <Link className="btn" to={`/invoices/${invoice.uid}/ocr`}><Icon name="scan" /> Open OCR evidence viewer</Link>
            </Card>
            <Card title="Immutability">
              <p className="small muted">The stored bytes are hashed at upload. Before processing, the checksum is recomputed; a mismatch aborts the job. Viewing the document writes an audit event.</p>
              <div className="divider" />
              <div className="tiny mono">{invoice.document?.sha256}</div>
            </Card>
          </div>
        </div>
      )}

      {tab === "match" && <MatchPanel invoice={invoice} />}
      {tab === "risk" && <RiskPanel invoice={invoice} onRefresh={load} />}
      {tab === "workflow" && <WorkflowPanel invoice={invoice} />}

      {action && (
        <Modal
          title={ACTION_TITLES[action]}
          subtitle={action === "approve" || action === "reject" ? "This decision is final for the current workflow state and is written to the immutable audit trail." : undefined}
          onClose={() => setAction(null)}
          footer={
            <>
              <button className="btn" onClick={() => setAction(null)}>Cancel</button>
              <button className={`btn ${action === "reject" ? "danger" : "primary"}`} disabled={!canSubmit || busy} onClick={submitAction}>
                {busy ? "Saving…" : ACTION_TITLES[action]}
              </button>
            </>
          }
        >
          <div className="stack" style={{ gap: 12 }}>
            {action === "assign" ? (
              <Field label="Reviewer" hint="Only users in this tenant are listed. Assigning yourself is allowed.">
                <select className="select" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                  <option value="">Unassigned</option>
                  {reviewers.map((user) => (
                    <option key={user.uid} value={user.uid}>{user.full_name} · {titleize(user.role)}</option>
                  ))}
                </select>
              </Field>
            ) : action === "correct" ? (
              <>
                <Field label="Field">
                  <select className="select" value={correctionField} onChange={(e) => {
                    setCorrectionField(e.target.value);
                    const value = invoice.extraction.field_evidence?.[e.target.value]?.normalized;
                    setCorrectionValue(value === null || value === undefined ? "" : String(value));
                  }}>
                    {CORRECTABLE_FIELDS.map(([field, kind]) => <option key={field} value={field}>{titleize(field)} ({kind})</option>)}
                  </select>
                </Field>
                <Field label="Corrected value" hint="Dates use YYYY-MM-DD · money uses dot decimals with up to 4 places · currency is ISO-4217.">
                  <input className="input" value={correctionValue} onChange={(e) => setCorrectionValue(e.target.value)} />
                </Field>
                <Field label="Reason (min 5 characters)">
                  <textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} />
                </Field>
                <InfoNote tone="info">Saving a correction re-runs matching and risk with the corrected value. The original extraction is preserved and the correction is audited.</InfoNote>
              </>
            ) : (
              <>
                <Field label={action === "note" ? "Note" : `Reason${minimumReason > 3 ? " (min 5 characters)" : " (min 3 characters)"}`}>
                  <textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
                </Field>
                {action !== "note" && (
                  <Field label="Additional notes (optional)">
                    <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </Field>
                )}
                {(action === "approve" || action === "reject") && (
                  <InfoNote tone={action === "reject" ? "warning" : "info"}>
                    {action === "approve"
                      ? "Approval stages the invoice for payment. It does not execute a payment, create a bank instruction, or contact any payment provider."
                      : "Rejection is terminal for this invoice. A subsequent invoice must be uploaded separately."}
                  </InfoNote>
                )}
                {action === "escalate" && <InfoNote tone="warning">Escalation routes the invoice to the fraud review queue for investigation by a fraud investigator.</InfoNote>}
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
