import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { Vendor } from "../api/types";
import { Drawer, Badge, Card, Empty, ErrorState, Field, InfoNote, Loading, Modal, PageHeader, RiskChip, SearchInput, StatusBadge, useToast } from "../components/UI";
import { date, dateTime, money, titleize } from "../utils/format";
import { Icon } from "../components/Icons";

const EMPTY_FORM = {
  code: "", name: "", tax_id: "", email: "", address: "", bank_account_masked: "",
  payment_terms: "Net 30", default_currency: "INR",
};

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[] | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [selected, setSelected] = useState<Vendor | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Vendor>>({});
  const toast = useToast();

  const load = useCallback(() => {
    setVendors(null);
    api.get<{ items: Vendor[] }>(`/vendors?page_size=200${search ? `&q=${encodeURIComponent(search)}` : ""}${status ? `&status=${status}` : ""}`)
      .then((res) => { setVendors(res.items); setError(null); })
      .catch((err) => setError(err.message));
  }, [search, status]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const openVendor = async (vendor: Vendor) => {
    setSelected(vendor);
    setDetailLoading(true);
    try {
      const detail = await api.get<Vendor>(`/vendors/${vendor.uid}`);
      setSelected(detail);
      setEditForm(detail);
    } catch {
      /* keep list data */
    } finally {
      setDetailLoading(false);
    }
  };

  const createVendor = async () => {
    setBusy(true);
    try {
      await api.post("/vendors", form);
      toast.push("Vendor created.", "success");
      setCreating(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "Could not create vendor", "error");
    } finally {
      setBusy(false);
    }
  };

  const saveVendor = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await api.patch(`/vendors/${selected.uid}`, {
        name: editForm.name, tax_id: editForm.tax_id, email: editForm.email, address: editForm.address,
        bank_account_masked: editForm.bank_account_masked, payment_terms: editForm.payment_terms,
        default_currency: editForm.default_currency, status: editForm.status,
      });
      toast.push("Vendor master data updated.", "success");
      setEditing(false);
      load();
      openVendor(selected);
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "Could not update vendor", "error");
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Master data"
        title="Vendors"
        subtitle="Vendor master records used for fuzzy matching, tax validation, payment terms and bank-detail change detection."
        actions={<button className="btn primary" onClick={() => setCreating(true)}><Icon name="plus" /> Add vendor</button>}
      />

      <Card
        title="Vendor directory"
        subtitle={`${vendors?.length ?? 0} records`}
        tight
        actions={
          <div className="row" style={{ gap: 8 }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Name, code or tax ID" width={240} />
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 130 }} aria-label="Status">
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="">All</option>
            </select>
          </div>
        }
      >
        {!vendors ? <Loading label="Loading vendors" /> : vendors.length === 0 ? <Empty title="No vendors" message="Seed the demo dataset or create a vendor." icon="vendors" /> : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Vendor</th><th>Tax & terms</th><th>Bank account</th><th className="num">Invoices</th><th className="num">Spend</th><th>Status</th></tr></thead>
              <tbody>
                {vendors.map((vendor) => (
                  <tr key={vendor.uid} className="clickable" onClick={() => openVendor(vendor)}>
                    <td>
                      <div className="cell-main">{vendor.name}</div>
                      <div className="cell-sub mono">{vendor.code}{vendor.email ? ` · ${vendor.email}` : ""}</div>
                    </td>
                    <td className="small">
                      <div className="mono tiny">{vendor.tax_id || "no tax ID"}</div>
                      <div className="tiny muted">{vendor.payment_terms || "—"}</div>
                    </td>
                    <td className="mono tiny">{vendor.bank_account_masked || "—"}</td>
                    <td className="num tabular">{vendor.invoice_count ?? "—"}</td>
                    <td className="num tabular">{money(vendor.total_spend)}</td>
                    <td><StatusBadge status={vendor.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && (
        <Drawer
          title={selected.name}
          subtitle={`${selected.code} · ${selected.status}`}
          onClose={() => { setSelected(null); setEditing(false); }}
          footer={
            <>
              <button className="btn" onClick={() => setSelected(null)}>Close</button>
              {!editing ? <button className="btn primary" onClick={() => setEditing(true)}><Icon name="settings" /> Edit master data</button> : (
                <>
                  <button className="btn" onClick={() => { setEditing(false); setEditForm(selected); }}>Cancel</button>
                  <button className="btn primary" onClick={saveVendor} disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
                </>
              )}
            </>
          }
        >
          {detailLoading ? <Loading label="Loading vendor detail" /> : (
            <div className="stack">
              {editing ? (
                <div className="form-grid">
                  <Field label="Name"><input className="input" value={editForm.name || ""} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></Field>
                  <Field label="Tax ID"><input className="input" value={editForm.tax_id || ""} onChange={(e) => setEditForm({ ...editForm, tax_id: e.target.value })} /></Field>
                  <Field label="Email"><input className="input" value={editForm.email || ""} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></Field>
                  <Field label="Payment terms"><input className="input" value={editForm.payment_terms || ""} onChange={(e) => setEditForm({ ...editForm, payment_terms: e.target.value })} /></Field>
                  <Field label="Currency"><input className="input" maxLength={3} value={editForm.default_currency || ""} onChange={(e) => setEditForm({ ...editForm, default_currency: e.target.value.toUpperCase() })} /></Field>
                  <Field label="Status">
                    <select className="select" value={editForm.status || "ACTIVE"} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                      <option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option>
                    </select>
                  </Field>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <Field label="Address"><input className="input" value={editForm.address || ""} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} /></Field>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <Field label="Primary bank account (masked)" hint="Changing this records a new bank-account event and enables bank-detail-change checks for future invoices.">
                      <input className="input" value={editForm.bank_account_masked || ""} onChange={(e) => setEditForm({ ...editForm, bank_account_masked: e.target.value })} />
                    </Field>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-3">
                    <div className="card stat"><div className="stat-label">Invoices</div><div className="stat-value" style={{ fontSize: 20 }}>{selected.stats?.invoice_count ?? selected.invoice_count ?? "—"}</div></div>
                    <div className="card stat"><div className="stat-label">Total spend</div><div className="stat-value" style={{ fontSize: 20 }}>{money(selected.stats?.total_spend || selected.total_spend)}</div></div>
                    <div className="card stat"><div className="stat-label">Average risk</div><div className="stat-value" style={{ fontSize: 20 }}>{selected.stats?.average_risk ?? "—"}</div></div>
                  </div>
                  <div className="kv">
                    <dt>Vendor code</dt><dd className="mono">{selected.code}</dd>
                    <dt>Tax ID</dt><dd className="mono">{selected.tax_id || "—"}</dd>
                    <dt>Email</dt><dd>{selected.email || "—"}</dd>
                    <dt>Address</dt><dd>{selected.address || "—"}</dd>
                    <dt>Terms</dt><dd>{selected.payment_terms || "—"}</dd>
                    <dt>Currency</dt><dd>{selected.default_currency || "—"}</dd>
                    <dt>Created</dt><dd>{date(selected.created_at)}</dd>
                  </div>
                  <div className="divider" />
                  <h3>Bank accounts</h3>
                  {(selected.bank_accounts || []).length === 0 ? <div className="small muted">No bank accounts recorded.</div> : (
                    <div className="table-wrap">
                      <table className="data compact">
                        <thead><tr><th>Account</th><th>IFSC</th><th>Changed</th><th>Verified</th></tr></thead>
                        <tbody>
                          {(selected.bank_accounts || []).map((account) => (
                            <tr key={account.account_masked + String(account.changed_at)}>
                              <td className="mono tiny">{account.account_masked}</td>
                              <td className="mono tiny">{account.ifsc || "—"}</td>
                              <td className="tiny">{account.changed_at ? dateTime(account.changed_at) : "primary record"}</td>
                              <td>{account.verified ? <Badge tone="success">Verified</Badge> : <Badge tone="warning">Unverified</Badge>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {selected.risk_notes && <div className="mini-note">{selected.risk_notes}</div>}
                  <div className="divider" />
                  <h3>Recent invoices</h3>
                  {(selected.recent_invoices || []).length === 0 ? <div className="small muted">No invoices for this vendor.</div> : (
                    <div className="stack" style={{ gap: 6 }}>
                      {(selected.recent_invoices || []).slice(0, 10).map((invoice) => (
                        <Link key={invoice.uid} to={`/invoices/${invoice.uid}`} className="row" style={{ justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #eef1f5", color: "inherit" }}>
                          <div>
                            <div className="small strong">{invoice.invoice_number || "Unnumbered"}</div>
                            <div className="tiny muted">{date(invoice.invoice_date)} · {titleize(invoice.status)}</div>
                          </div>
                          <div className="right">
                            <div className="small tabular">{money(invoice.total_amount)}</div>
                            <RiskChip category={invoice.risk_category} score={invoice.risk_score} compact />
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                  <InfoNote tone="info">Vendor risk here is descriptive. The fraud centre applies relationship checks across vendors.</InfoNote>
                </>
              )}
            </div>
          )}
        </Drawer>
      )}

      {creating && (
        <Modal
          title="Add vendor"
          subtitle="Vendor codes must be unique within the tenant."
          onClose={() => setCreating(false)}
          wide
          footer={
            <>
              <button className="btn" onClick={() => setCreating(false)}>Cancel</button>
              <button className="btn primary" onClick={createVendor} disabled={busy || !form.code || !form.name}>{busy ? "Saving…" : "Create vendor"}</button>
            </>
          }
        >
          <div className="form-grid">
            <Field label="Vendor code"><input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></Field>
            <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Tax ID"><input className="input" value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} /></Field>
            <Field label="Email"><input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Payment terms"><input className="input" value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} /></Field>
            <Field label="Currency"><input className="input" maxLength={3} value={form.default_currency} onChange={(e) => setForm({ ...form, default_currency: e.target.value.toUpperCase() })} /></Field>
            <div style={{ gridColumn: "1 / -1" }}><Field label="Address"><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field></div>
            <div style={{ gridColumn: "1 / -1" }}><Field label="Bank account (masked)" hint="Stored masked only; never provide a full account number."><input className="input" value={form.bank_account_masked} onChange={(e) => setForm({ ...form, bank_account_masked: e.target.value })} /></Field></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
