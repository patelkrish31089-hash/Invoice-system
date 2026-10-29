import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { PODetail, PO, Vendor } from "../api/types";
import { Icon } from "../components/Icons";
import { Badge, Card, Drawer, Empty, ErrorState, Field, Loading, Modal, PageHeader, SearchInput, StatusBadge, useToast } from "../components/UI";
import { date, dateTime, money, titleize } from "../utils/format";

interface LineDraft { item_code: string; description: string; quantity: string; unit: string; unit_price: string; tax_rate: string }

const EMPTY_LINE: LineDraft = { item_code: "", description: "", quantity: "1", unit: "EA", unit_price: "0.00", tax_rate: "18" };

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PO[] | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<PODetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const [form, setForm] = useState({
    po_number: "", vendor_uid: "", currency: "INR", status: "APPROVED",
    issue_date: new Date().toISOString().slice(0, 10), expected_date: "", notes: "",
  });
  const [lines, setLines] = useState<LineDraft[]>([{ ...EMPTY_LINE }]);

  const load = useCallback(() => {
    setOrders(null);
    api.get<{ items: PO[] }>(`/purchase-orders?page_size=100${search ? `&q=${encodeURIComponent(search)}` : ""}${status ? `&status=${status}` : ""}`)
      .then((res) => { setOrders(res.items); setError(null); })
      .catch((err) => setError(err.message));
  }, [search, status]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    api.get<{ items: Vendor[] }>("/vendors?page_size=200&status=ACTIVE").then((res) => setVendors(res.items)).catch(() => undefined);
  }, []);

  const openPo = async (po: PO) => {
    setDetailLoading(true);
    try {
      setSelected(await api.get<PODetail>(`/purchase-orders/${po.uid}`));
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "Could not load PO", "error");
    } finally {
      setDetailLoading(false);
    }
  };

  const total = lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_price || 0), 0);

  const createPo = async () => {
    setBusy(true);
    try {
      await api.post("/purchase-orders", {
        ...form,
        expected_date: form.expected_date || null,
        notes: form.notes || null,
        lines: lines.map((line) => ({
          item_code: line.item_code, description: line.description, quantity: line.quantity,
          unit: line.unit, unit_price: line.unit_price, tax_rate: line.tax_rate,
        })),
      });
      toast.push("Purchase order created.", "success");
      setCreating(false);
      setLines([{ ...EMPTY_LINE }]);
      setForm({ ...form, po_number: "", notes: "" });
      load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "Could not create PO", "error");
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Master data"
        title="Purchase orders"
        subtitle="The authorised quantity and price for each item. Receipts and invoices are matched against these lines."
        actions={<button className="btn primary" onClick={() => setCreating(true)}><Icon name="plus" /> New purchase order</button>}
      />

      <Card
        title="Purchase orders"
        subtitle={`${orders?.length ?? 0} records`}
        tight
        actions={
          <div className="row" style={{ gap: 8 }}>
            <SearchInput value={search} onChange={setSearch} placeholder="PO number" width={220} />
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 150 }} aria-label="PO status">
              <option value="">All statuses</option>
              {["DRAFT", "OPEN", "APPROVED", "PARTIALLY_RECEIVED", "CLOSED", "CANCELLED"].map((s) => <option key={s} value={s}>{titleize(s)}</option>)}
            </select>
          </div>
        }
      >
        {!orders ? <Loading label="Loading purchase orders" /> : orders.length === 0 ? <Empty title="No purchase orders" icon="po" /> : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>PO number</th><th>Vendor</th><th>Issued</th><th>Expected</th><th className="num">Lines</th><th className="num">Total</th><th>Status</th></tr></thead>
              <tbody>
                {orders.map((po) => (
                  <tr key={po.uid} className="clickable" onClick={() => openPo(po)}>
                    <td className="cell-main mono">{po.po_number}</td>
                    <td className="truncate" style={{ maxWidth: 220 }}>{po.vendor_name}</td>
                    <td className="tiny">{date(po.issue_date)}</td>
                    <td className="tiny">{date(po.expected_date)}</td>
                    <td className="num tabular">{po.line_count}</td>
                    <td className="num tabular">{money(po.total_amount, po.currency)}</td>
                    <td><StatusBadge status={po.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && (
        <Drawer
          title={selected.po_number}
          subtitle={`${selected.vendor_name} · ${titleize(selected.status)}`}
          onClose={() => setSelected(null)}
          footer={<button className="btn" onClick={() => setSelected(null)}>Close</button>}
        >
          {detailLoading ? <Loading label="Loading purchase order" /> : (
            <div className="stack">
              <div className="kv">
                <dt>Vendor</dt><dd>{selected.vendor_name}</dd>
                <dt>Issued</dt><dd>{date(selected.issue_date)}</dd>
                <dt>Expected</dt><dd>{date(selected.expected_date)}</dd>
                <dt>Total</dt><dd className="money">{money(selected.total_amount, selected.currency)}</dd>
                <dt>Source</dt><dd>{selected.source_system || "—"}</dd>
                <dt>Notes</dt><dd>{selected.notes || "—"}</dd>
              </div>
              <div className="divider" />
              <h3>Lines</h3>
              <div className="table-wrap">
                <table className="data compact">
                  <thead><tr><th>#</th><th>Item</th><th className="num">Ordered</th><th className="num">Received</th><th className="num">Unit price</th><th className="num">Line total</th></tr></thead>
                  <tbody>
                    {selected.lines.map((line) => (
                      <tr key={line.id}>
                        <td className="muted">{line.line_no}</td>
                        <td><div className="small strong">{line.item_code}</div><div className="tiny muted truncate" style={{ maxWidth: 170 }}>{line.description}</div></td>
                        <td className="num tabular">{line.quantity}</td>
                        <td className="num tabular">{line.received_quantity}</td>
                        <td className="num tabular">{money(line.unit_price)}</td>
                        <td className="num tabular">{money(line.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="divider" />
              <h3>Goods receipts</h3>
              {selected.receipts.length === 0 ? <div className="small muted">No receipts recorded against this PO.</div> : (
                <div className="stack" style={{ gap: 6 }}>
                  {selected.receipts.map((receipt) => (
                    <div className="row" key={receipt.uid} style={{ justifyContent: "space-between" }}>
                      <span className="mono small">{receipt.grn_number}</span>
                      <span className="tiny muted">{date(receipt.received_date)}</span>
                      <StatusBadge status={receipt.status} />
                    </div>
                  ))}
                </div>
              )}
              <div className="mini-note">Received quantities are the sum of all non-cancelled receipts; returns reduce the effective received quantity.</div>
            </div>
          )}
        </Drawer>
      )}

      {creating && (
        <Modal
          title="Create purchase order"
          subtitle="Lines are the source of truth for three-way matching."
          onClose={() => setCreating(false)}
          wide
          footer={
            <>
              <span className="small muted" style={{ marginRight: "auto" }}>Computed total <b>{money(total, form.currency)}</b></span>
              <button className="btn" onClick={() => setCreating(false)}>Cancel</button>
              <button className="btn primary" onClick={createPo} disabled={busy || !form.po_number || !form.vendor_uid || lines.some((l) => !l.item_code || !l.description)}>
                {busy ? "Saving…" : "Create PO"}
              </button>
            </>
          }
        >
          <div className="stack" style={{ gap: 14 }}>
            <div className="form-grid">
              <Field label="PO number"><input className="input" value={form.po_number} onChange={(e) => setForm({ ...form, po_number: e.target.value.toUpperCase() })} placeholder="PO-2026-1234" /></Field>
              <Field label="Vendor">
                <select className="select" value={form.vendor_uid} onChange={(e) => setForm({ ...form, vendor_uid: e.target.value })}>
                  <option value="">Select vendor…</option>
                  {vendors.map((vendor) => <option key={vendor.uid} value={vendor.uid}>{vendor.name} ({vendor.code})</option>)}
                </select>
              </Field>
              <Field label="Issue date"><input className="input" type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} /></Field>
              <Field label="Expected date"><input className="input" type="date" value={form.expected_date} onChange={(e) => setForm({ ...form, expected_date: e.target.value })} /></Field>
              <Field label="Currency"><input className="input" maxLength={3} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></Field>
              <Field label="Status">
                <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {["DRAFT", "OPEN", "APPROVED"].map((s) => <option key={s} value={s}>{titleize(s)}</option>)}
                </select>
              </Field>
            </div>
            <div>
              <div className="row" style={{ marginBottom: 6 }}>
                <h3>Lines</h3>
                <button className="btn sm" style={{ marginLeft: "auto" }} onClick={() => setLines([...lines, { ...EMPTY_LINE }])}><Icon name="plus" /> Add line</button>
              </div>
              <div className="table-wrap">
                <table className="data compact">
                  <thead><tr><th>Item code</th><th>Description</th><th style={{ width: 80 }}>Qty</th><th style={{ width: 90 }}>Unit price</th><th style={{ width: 70 }}>Tax %</th><th /></tr></thead>
                  <tbody>
                    {lines.map((line, index) => (
                      <tr key={index}>
                        <td><input className="input" value={line.item_code} onChange={(e) => setLines(lines.map((l, i) => i === index ? { ...l, item_code: e.target.value } : l))} /></td>
                        <td><input className="input" value={line.description} onChange={(e) => setLines(lines.map((l, i) => i === index ? { ...l, description: e.target.value } : l))} /></td>
                        <td><input className="input" type="number" min="0" step="0.0001" value={line.quantity} onChange={(e) => setLines(lines.map((l, i) => i === index ? { ...l, quantity: e.target.value } : l))} /></td>
                        <td><input className="input" type="number" min="0" step="0.01" value={line.unit_price} onChange={(e) => setLines(lines.map((l, i) => i === index ? { ...l, unit_price: e.target.value } : l))} /></td>
                        <td><input className="input" type="number" min="0" max="100" value={line.tax_rate} onChange={(e) => setLines(lines.map((l, i) => i === index ? { ...l, tax_rate: e.target.value } : l))} /></td>
                        <td><button className="icon-btn" onClick={() => setLines(lines.filter((_, i) => i !== index))} disabled={lines.length === 1} aria-label="Remove line"><Icon name="x" size={13} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="tiny muted">Line totals are computed server-side with Decimal arithmetic. Invoice totals below the configured approval threshold route to normal approval; larger invoices require a second approver.</div>
          </div>
        </Modal>
      )}
    </div>
  );
}
