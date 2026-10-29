import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { InvoiceListResponse, InvoiceSummary } from "../api/types";
import { Icon } from "../components/Icons";
import { Card, Empty, ErrorState, Field, InfoNote, Loading, Modal, PageHeader, RiskChip, StatusBadge, useToast } from "../components/UI";
import { date, money, titleize } from "../utils/format";

type Decision = "approve" | "reject";

export default function ApprovalsPage() {
  const [data, setData] = useState<InvoiceListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<{ invoice: InvoiceSummary; kind: Decision } | null>(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    setData(null);
    api.get<InvoiceListResponse>("/invoices?status=PENDING_APPROVAL&sort=-risk_score&page_size=100")
      .then((res) => { setData(res); setError(null); })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(load, [load]);

  const submit = async () => {
    if (!decision) return;
    setBusy(true);
    try {
      await api.post(`/invoices/${decision.invoice.uid}/${decision.kind}`, { reason, notes: notes || undefined });
      toast.push(decision.kind === "approve" ? "Invoice approved for payment staging." : "Invoice rejected.", "success");
      setDecision(null);
      setReason("");
      setNotes("");
      load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "Decision failed", "error");
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;

  const total = (data?.items || []).reduce((sum, row) => sum + Number(row.total_amount || 0), 0);

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Invoice operations"
        title="Approval queue"
        subtitle="Matched invoices awaiting a human decision. Separation of duties blocks the uploader from approving their own invoice, and duplicates cannot be approved."
        actions={<button className="btn" onClick={load}><Icon name="refresh" /> Refresh</button>}
      />

      <div className="grid grid-3">
        <Card><div className="stat-label">Awaiting approval</div><div className="stat-value">{data?.total ?? "—"}</div><div className="stat-sub">invoices in PENDING_APPROVAL</div></Card>
        <Card><div className="stat-label">Value pending</div><div className="stat-value" style={{ fontSize: 21 }}>{money(total)}</div><div className="stat-sub">sum of the queue</div></Card>
        <Card><div className="stat-label">High risk in queue</div><div className="stat-value">{(data?.items || []).filter((row) => ["HIGH", "CRITICAL"].includes(row.risk_category)).length}</div><div className="stat-sub">review carefully before approving</div></Card>
      </div>

      <InfoNote tone="info">
        <strong>Approval stages, it does not pay.</strong> A decision records the reviewer, the reason and a timestamp in the audit trail. No payment file, bank instruction or external call is produced by this system.
      </InfoNote>

      <Card title="Pending decisions" subtitle="Sorted by risk score" tight>
        {!data ? <Loading label="Loading approvals" /> : data.items.length === 0 ? (
          <Empty title="Nothing awaiting approval" message="Matched invoices will appear here once they pass matching and fraud checks." icon="approval" />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Invoice</th><th>Vendor</th><th>Invoice date</th><th>Matching</th><th className="num">Amount</th><th>Risk</th><th /></tr></thead>
              <tbody>
                {data.items.map((invoice) => (
                  <tr key={invoice.uid}>
                    <td>
                      <Link to={`/invoices/${invoice.uid}`} className="cell-main">{invoice.invoice_number || "Unnumbered"}</Link>
                      <div className="cell-sub">{invoice.po_number || "no PO"}</div>
                    </td>
                    <td className="truncate" style={{ maxWidth: 220 }}>{invoice.vendor_name || "Unmatched vendor"}</td>
                    <td className="tiny">{date(invoice.invoice_date)}</td>
                    <td><StatusBadge status={invoice.reconciliation_status} /></td>
                    <td className="num money">{money(invoice.total_amount, invoice.currency || "INR")}</td>
                    <td><RiskChip category={invoice.risk_category} score={invoice.risk_score} /></td>
                    <td className="right">
                      <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
                        <button className="btn sm" onClick={() => { setDecision({ invoice, kind: "reject" }); setReason(""); }}>
                          <Icon name="circle-x" /> Reject
                        </button>
                        <button className="btn sm primary" onClick={() => { setDecision({ invoice, kind: "approve" }); setReason(""); }}>
                          <Icon name="circle-check" /> Approve
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Separation of duties" subtitle="Rules enforced by the server, not the interface">
        <div className="grid grid-2">
          <div>
            <div className="small strong">Uploader ≠ approver</div>
            <p className="small muted">The server compares the uploader's user id with the acting approver for every review-queue decision and rejects self-approval with HTTP 403.</p>
          </div>
          <div>
            <div className="small strong">Duplicates are blocked</div>
            <p className="small muted">An invoice flagged as a confirmed duplicate cannot be approved; a fraud investigator must resolve the duplicate finding first, and the resolution is audited.</p>
          </div>
        </div>
      </Card>

      {decision && (
        <Modal
          title={decision.kind === "approve" ? "Approve for payment staging" : "Reject invoice"}
          subtitle={`${decision.invoice.invoice_number || "Unnumbered"} · ${money(decision.invoice.total_amount, decision.invoice.currency || "INR")}`}
          onClose={() => setDecision(null)}
          footer={
            <>
              <button className="btn" onClick={() => setDecision(null)}>Cancel</button>
              <button className={`btn ${decision.kind === "reject" ? "danger" : "primary"}`} onClick={submit} disabled={busy || reason.trim().length < (decision.kind === "approve" ? 3 : 5)}>
                {busy ? "Saving…" : decision.kind === "approve" ? "Approve" : "Reject"}
              </button>
            </>
          }
        >
          <div className="stack" style={{ gap: 12 }}>
            <div className="row wrap" style={{ gap: 8 }}>
              <RiskChip category={decision.invoice.risk_category} score={decision.invoice.risk_score} />
              <StatusBadge status={decision.invoice.reconciliation_status} />
              <span className="tag">{titleize(decision.invoice.review_queue)}</span>
            </div>
            <Field label={`Reason (min ${decision.kind === "approve" ? 3 : 5} characters)`}>
              <textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
            </Field>
            <Field label="Notes (optional)"><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            <InfoNote tone="warning">
              {decision.kind === "approve"
                ? "Approval is a control decision, not a payment instruction. Confirming records your identity against this decision permanently."
                : "Rejection is terminal; this invoice cannot be re-approved. A corrected invoice must be uploaded as a new document."}
            </InfoNote>
          </div>
        </Modal>
      )}
    </div>
  );
}
