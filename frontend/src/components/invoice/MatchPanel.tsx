import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { InvoiceDetail, PODetail } from "../../api/types";
import { Icon } from "../Icons";
import { Badge, Card, Empty, InfoNote, StatusBadge } from "../UI";
import { money, titleize } from "../../utils/format";

export function MatchPanel({ invoice }: { invoice: InvoiceDetail }) {
  const [po, setPo] = useState<PODetail | null>(null);
  const [loading, setLoading] = useState(false);
  const recon = invoice.reconciliation;

  useEffect(() => {
    if (!invoice.po_number) { setPo(null); return; }
    setLoading(true);
    api.get<{ items: Array<{ uid: string }> }>(`/purchase-orders?q=${encodeURIComponent(invoice.po_number)}&page_size=1`)
      .then((res) => {
        const uid = res.items[0]?.uid;
        if (!uid) return null;
        return api.get<PODetail>(`/purchase-orders/${uid}`);
      })
      .then((detail) => setPo(detail))
      .catch(() => setPo(null))
      .finally(() => setLoading(false));
  }, [invoice.po_number]);

  if (!recon) {
    return <Empty title="No matching result" message="This invoice has not completed reconciliation yet." icon="match" />;
  }

  const poLineById = new Map((po?.lines || []).map((line) => [line.id, line]));
  const tol = recon.tolerance_config || {};

  return (
    <div className="stack">
      <div className="grid grid-3">
        <Card title="Matching outcome">
          <div className="row" style={{ gap: 10 }}>
            <StatusBadge status={recon.status} />
            <span className="tag">{recon.engine_version}</span>
          </div>
          <p className="small muted" style={{ marginTop: 8 }}>{recon.summary}</p>
          <div className="divider" />
          <div className="kv">
            <dt>Price variance</dt><dd>{money(recon.price_variance_total)}</dd>
            <dt>Quantity variance</dt><dd>{money(recon.quantity_variance_total)}</dd>
            <dt>Purchase order</dt><dd>{po?.po_number || invoice.po_number || "Not found"}</dd>
            <dt>Goods receipts</dt><dd>{(recon.grn_ids || []).length}</dd>
          </div>
        </Card>
        <Card title="Tolerances applied">
          <div className="kv">
            <dt>Price tolerance</dt><dd>{String(tol.price_tolerance_pct ?? "—")}% or {money(String(tol.price_tolerance_abs ?? 0))}</dd>
            <dt>Quantity tolerance</dt><dd>{String(tol.quantity_tolerance_pct ?? 0)}%</dd>
            <dt>Rounding</dt><dd>{money(String(tol.amount_rounding_tolerance ?? 0))}</dd>
            <dt>GRN required</dt><dd>{tol.require_grn ? "Yes" : "No"}</dd>
            <dt>Partial receipts</dt><dd>{tol.allow_partial_receipts ? "Allowed" : "Not allowed"}</dd>
          </div>
        </Card>
        <Card title="Document totals">
          <div className="kv">
            <dt>Subtotal</dt><dd>{money(invoice.subtotal, invoice.currency || "INR")}</dd>
            <dt>Tax</dt><dd>{money(invoice.tax_amount, invoice.currency || "INR")}</dd>
            <dt>Discount</dt><dd>{money(invoice.discount_amount, invoice.currency || "INR")}</dd>
            <dt>Shipping</dt><dd>{money(invoice.shipping_amount, invoice.currency || "INR")}</dd>
            <dt>Invoice total</dt><dd className="money">{money(invoice.total_amount, invoice.currency || "INR")}</dd>
          </div>
          <div className="divider" />
          <div className="tiny muted">Financial checks recompute line and document totals with Decimal arithmetic; a mismatch appears as a discrepancy below.</div>
        </Card>
      </div>

      {recon.discrepancies.length > 0 ? (
        <Card title={`Discrepancies (${recon.discrepancies.length})`} subtitle="Each finding cites a stable rule id and the expected vs observed values" tight>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Rule</th><th>Code</th><th>Severity</th><th>Expected</th><th>Observed</th><th>Difference</th><th>Explanation</th></tr></thead>
              <tbody>
                {recon.discrepancies.map((item, index) => (
                  <tr key={`${item.code}-${index}`}>
                    <td className="mono tiny">{item.rule || "—"}</td>
                    <td className="cell-main tiny">{item.code}</td>
                    <td><span className={`sev ${item.severity}`}>{item.severity}</span></td>
                    <td className="small">{item.expected ?? "—"}</td>
                    <td className="small">{item.observed ?? "—"}</td>
                    <td className="small tabular">{item.difference ?? "—"}</td>
                    <td className="small muted" style={{ maxWidth: 380 }}>{item.explanation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <InfoNote tone="success"><strong>No discrepancies.</strong> Invoice, purchase order and goods receipts agree within the configured tolerances.</InfoNote>
      )}

      <Card
        title="Line-level comparison"
        subtitle="Invoice lines mapped to purchase-order lines; received quantity is summed across goods receipts"
        tight
        actions={loading ? <span className="tiny muted">Loading PO…</span> : po ? <Badge tone="info">PO {po.po_number}</Badge> : <Badge tone="neutral">PO not in master data</Badge>}
      >
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr><th>#</th><th>Item</th><th>Description</th><th className="num">Invoiced qty</th><th className="num">PO qty</th><th className="num">Received</th><th className="num">Unit price</th><th className="num">Line total</th><th>Match</th></tr>
            </thead>
            <tbody>
              {invoice.lines.map((line) => {
                const poLine = line.po_line_id ? poLineById.get(line.po_line_id) : undefined;
                const qtySwing = poLine ? Number(line.quantity) - Number(poLine.quantity) : null;
                return (
                  <tr key={line.id}>
                    <td className="muted">{line.line_no}</td>
                    <td className="mono tiny">{line.item_code || "—"}</td>
                    <td className="truncate" style={{ maxWidth: 240 }}>{line.description || "—"}</td>
                    <td className="num tabular">{line.quantity ?? "—"}</td>
                    <td className="num tabular">{poLine?.quantity ?? "—"}</td>
                    <td className="num tabular">{poLine?.received_quantity ?? "—"}</td>
                    <td className="num tabular">{money(line.unit_price)}</td>
                    <td className="num tabular">{money(line.line_total)}</td>
                    <td>{poLine ? (Math.abs(qtySwing || 0) < 0.0001 ? <Badge tone="success">Matched</Badge> : <Badge tone="warning">Variance {qtySwing! > 0 ? "+" : ""}{qtySwing}</Badge>) : <Badge tone="warning">Unmatched</Badge>}</td>
                  </tr>
                );
              })}
              {invoice.lines.length === 0 && <tr><td colSpan={9}><div className="table-empty">No line items extracted.</div></td></tr>}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={7} className="right strong">Invoice total</td>
                <td className="num money">{money(invoice.total_amount, invoice.currency || "INR")}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <div className="grid grid-2">
        <Card title="Purchase order" subtitle={po ? `${po.lines.length} lines · ${po.status}` : invoice.po_number ? `PO ${invoice.po_number} not found in master data` : "No PO reference on the invoice"}>
          {po ? (
            <>
              <div className="kv">
                <dt>PO number</dt><dd className="mono">{po.po_number}</dd>
                <dt>Vendor</dt><dd>{po.vendor_name}</dd>
                <dt>Issued</dt><dd>{po.issue_date}</dd>
                <dt>Expected</dt><dd>{po.expected_date || "—"}</dd>
                <dt>Total</dt><dd>{money(po.total_amount, po.currency)}</dd>
                <dt>Status</dt><dd>{titleize(po.status)}</dd>
              </div>
              <div className="divider" />
              <div className="tiny muted">Goods receipts linked: {po.receipts.length ? po.receipts.map((r) => r.grn_number).join(", ") : "none"}</div>
            </>
          ) : (
            <Empty title="No purchase order" message="This invoice cites a PO that is not present in the local procurement master data." icon="po" />
          )}
        </Card>
        <Card title="How this was computed">
          <ol className="small" style={{ paddingLeft: 18, margin: 0, color: "var(--muted)", lineHeight: 1.8 }}>
            <li>Extraction produced line items with quantity, unit price and tax.</li>
            <li>Lines were matched to PO lines by item code first, then description similarity.</li>
            <li>Received quantity sums every non-cancelled goods receipt, subtracting returns.</li>
            <li>Price and quantity variances were compared against tenant tolerances.</li>
            <li>Prior invoices against the same PO lines were excluded when checking over-billing.</li>
            <li>Financial totals were re-derived to detect arithmetic tampering.</li>
          </ol>
          <div className="mini-note" style={{ marginTop: 12 }}>
            Matching is deterministic and versioned ({recon.engine_version}); it never calls an LLM and does not execute payment.
          </div>
        </Card>
      </div>
    </div>
  );
}
