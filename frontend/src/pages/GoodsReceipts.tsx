import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { GRN, PODetail, PO } from "../api/types";
import { Icon } from "../components/Icons";
import { Card, Drawer, Empty, ErrorState, Field, Loading, Modal, PageHeader, SearchInput, StatusBadge, useToast } from "../components/UI";
import { date, money, titleize } from "../utils/format";

interface ReceiptLine { po_line_id: number; received_quantity: string; returned_quantity: string }

export default function GoodsReceiptsPage() {
  const [grns, setGrns] = useState<GRN[] | null>(null);
  const [orders, setOrders] = useState<PO[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<GRN | null>(null);
  const [form, setForm] = useState({ grn_number: "", po_uid: "", received_date: new Date().toISOString().slice(0, 10), received_by: "", notes: "" });
  const [poDetail, setPoDetail] = useState<PODetail | null>(null);
  const [lines, setLines] = useState<ReceiptLine[]>([]);
  const toast = useToast();

  const load = useCallback(() => {
    setGrns(null);
    api.get<{ items: GRN[] }>(`/goods-receipts?page_size=100${search ? `&q=${encodeURIComponent(search)}` : ""}`)
      .then((res) => { setGrns(res.items); setError(null); })
      .catch((err) => setError(err.message));
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    api.get<{ items: PO[] }>("/purchase-orders?page_size=200").then((res) => setOrders(res.items)).catch(() => undefined);
  }, []);

  const choosePo = async (uid: string) => {
    setForm({ ...form, po_uid: uid });
    if (!uid) { setPoDetail(null); setLines([]); return; }
    const detail = await api.get<PODetail>(`/purchase-orders/${uid}`);
    setPoDetail(detail);
    setLines(detail.lines.map((line) => ({ po_line_id: line.id, received_quantity: line.quantity, returned_quantity: "0" })));
    setForm((prev) => ({ ...prev, grn_number: prev.grn_number || `GRN-${detail.po_number}` }));
  };

  const openGrn = async (grn: GRN) => {
    setSelected(grn);
    try {
      setSelected(await api.get(`/goods-receipts/${grn.uid}`));
    } catch {
      /* keep list entry */
    }
  };

  const createGrn = async () => {
    setBusy(true);
    try {
      await api.post("/goods-receipts", {
        grn_number: form.grn_number, po_uid: form.po_uid, received_date: form.received_date,
        received_by: form.received_by || null, notes: form.notes || null,
        lines: lines.map((line) => ({
          purchase_order_line_id: line.po_line_id,
          received_quantity: line.received_quantity,
          returned_quantity: line.returned_quantity || "0",
        })),
      });
      toast.push("Goods receipt recorded.", "success");
      setCreating(false);
      setPoDetail(null);
      setForm({ grn_number: "", po_uid: "", received_date: new Date().toISOString().slice(0, 10), received_by: "", notes: "" });
      load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "Could not create receipt", "error");
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Master data"
        title="Goods receipts"
        subtitle="Evidence that ordered goods actually arrived. Received quantities feed three-way matching; returns reduce the effective received quantity."
        actions={<button className="btn primary" onClick={() => setCreating(true)}><Icon name="plus" /> Record receipt</button>}
      />

      <Card
        title="Receipt register"
        subtitle={`${grns?.length ?? 0} records`}
        tight
        actions={<SearchInput value={search} onChange={setSearch} placeholder="GRN or PO number" width={240} />}
      >
        {!grns ? <Loading label="Loading goods receipts" /> : grns.length === 0 ? <Empty title="No goods receipts" icon="grn" /> : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>GRN</th><th>Purchase order</th><th>Received</th><th className="num">Lines</th><th>Received by</th><th>Status</th></tr></thead>
              <tbody>
                {grns.map((grn) => (
                  <tr key={grn.uid} className="clickable" onClick={() => openGrn(grn)}>
                    <td className="cell-main mono">{grn.grn_number}</td>
                    <td className="mono tiny">{grn.po_number}</td>
                    <td className="tiny">{date(grn.received_date)}</td>
                    <td className="num tabular">{grn.line_count}</td>
                    <td className="small">{grn.received_by || "—"}</td>
                    <td><StatusBadge status={grn.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && (
        <Drawer
          title={selected.grn_number}
          subtitle={`PO ${selected.po_number} · ${titleize(selected.status)}`}
          onClose={() => setSelected(null)}
          footer={<button className="btn" onClick={() => setSelected(null)}>Close</button>}
        >
          <div className="stack">
            <div className="kv">
              <dt>PO number</dt><dd className="mono">{selected.po_number}</dd>
              <dt>Received date</dt><dd>{date(selected.received_date)}</dd>
              <dt>Received by</dt><dd>{selected.received_by || "—"}</dd>
              <dt>Notes</dt><dd>{selected.notes || "—"}</dd>
              <dt>Status</dt><dd><StatusBadge status={selected.status} /></dd>
            </div>
            <div className="divider" />
            <h3>Received lines</h3>
            {selected.lines?.length ? (
              <div className="table-wrap">
                <table className="data compact">
                  <thead><tr><th>Item</th><th className="num">Received</th><th className="num">Returned</th></tr></thead>
                  <tbody>
                    {selected.lines.map((line) => (
                      <tr key={line.id}>
                        <td className="mono tiny">{line.item_code}</td>
                        <td className="num tabular">{line.received_quantity}</td>
                        <td className="num tabular">{line.returned_quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="small muted">Loading lines…</div>}
            <div className="mini-note">A receipt cannot exceed the ordered quantity. Cancelled receipts are excluded from matching.</div>
          </div>
        </Drawer>
      )}

      {creating && (
        <Modal
          title="Record goods receipt"
          subtitle="Received quantities default to the full ordered quantity."
          onClose={() => setCreating(false)}
          wide
          footer={
            <>
              <button className="btn" onClick={() => setCreating(false)}>Cancel</button>
              <button className="btn primary" disabled={busy || !form.grn_number || !form.po_uid || lines.length === 0} onClick={createGrn}>
                {busy ? "Saving…" : "Record receipt"}
              </button>
            </>
          }
        >
          <div className="stack" style={{ gap: 14 }}>
            <div className="form-grid">
              <Field label="GRN number"><input className="input" value={form.grn_number} onChange={(e) => setForm({ ...form, grn_number: e.target.value.toUpperCase() })} /></Field>
              <Field label="Purchase order">
                <select className="select" value={form.po_uid} onChange={(e) => choosePo(e.target.value)}>
                  <option value="">Select PO…</option>
                  {orders.map((po) => <option key={po.uid} value={po.uid}>{po.po_number} · {po.vendor_name}</option>)}
                </select>
              </Field>
              <Field label="Received date"><input className="input" type="date" value={form.received_date} onChange={(e) => setForm({ ...form, received_date: e.target.value })} /></Field>
              <Field label="Received by"><input className="input" value={form.received_by} onChange={(e) => setForm({ ...form, received_by: e.target.value })} placeholder="Warehouse / name" /></Field>
            </div>
            {poDetail && (
              <div>
                <div className="row" style={{ marginBottom: 6 }}>
                  <h3>{poDetail.po_number} lines</h3>
                  <span className="tag" style={{ marginLeft: 8 }}>{money(poDetail.total_amount, poDetail.currency)}</span>
                </div>
                <div className="table-wrap">
                  <table className="data compact">
                    <thead><tr><th>Item</th><th>Description</th><th className="num">Ordered</th><th style={{ width: 110 }}>Received</th><th style={{ width: 100 }}>Returned</th></tr></thead>
                    <tbody>
                      {poDetail.lines.map((line, index) => (
                        <tr key={line.id}>
                          <td className="mono tiny">{line.item_code}</td>
                          <td className="small truncate" style={{ maxWidth: 220 }}>{line.description}</td>
                          <td className="num tabular">{line.quantity}</td>
                          <td><input className="input" type="number" min="0" step="0.0001" value={lines[index]?.received_quantity ?? ""} onChange={(e) => setLines(lines.map((l, i) => i === index ? { ...l, received_quantity: e.target.value } : l))} /></td>
                          <td><input className="input" type="number" min="0" step="0.0001" value={lines[index]?.returned_quantity ?? "0"} onChange={(e) => setLines(lines.map((l, i) => i === index ? { ...l, returned_quantity: e.target.value } : l))} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <Field label="Notes (optional)"><input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            <div className="tiny muted">The server rejects a receipt that exceeds the ordered quantity or references a PO line from another order.</div>
          </div>
        </Modal>
      )}
    </div>
  );
}
