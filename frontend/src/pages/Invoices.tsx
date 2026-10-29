import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { InvoiceListResponse, InvoiceSummary } from "../api/types";
import { Icon } from "../components/Icons";
import {
  Card, Confidence, Empty, ErrorState, Loading, PageHeader, Pagination, RiskChip, SearchInput, StatusBadge,
} from "../components/UI";
import { date, money, titleize } from "../utils/format";

const STATUS_OPTIONS = [
  "", "PROCESSING", "EXTRACTION_REVIEW", "MATCH_REVIEW", "DUPLICATE_REVIEW", "FRAUD_REVIEW",
  "PENDING_APPROVAL", "INFO_REQUESTED", "APPROVED_FOR_PAYMENT_STAGE", "REJECTED", "FAILED",
];
const RISK_OPTIONS = ["", "LOW", "MEDIUM", "HIGH", "CRITICAL"];
const RECON_OPTIONS = ["", "MATCHED", "MATCHED_WITHIN_TOLERANCE", "PARTIALLY_MATCHED", "MISMATCHED", "MISSING_PO", "MISSING_GRN", "INSUFFICIENT_DATA", "MANUAL_REVIEW_REQUIRED"];
const SORT_OPTIONS = [
  { value: "-created_at", label: "Newest first" },
  { value: "created_at", label: "Oldest first" },
  { value: "-risk_score", label: "Highest risk" },
  { value: "-total_amount", label: "Largest amount" },
  { value: "invoice_date", label: "Invoice date" },
];

function toCsv(rows: InvoiceSummary[]): string {
  const header = ["Invoice", "Vendor", "Invoice date", "PO number", "Amount", "Currency", "Reconciliation", "Risk score", "Risk category", "Status", "UID"];
  const lines = rows.map((row) => [
    row.invoice_number || "", row.vendor_name || "", row.invoice_date || "", row.po_number || "",
    row.total_amount || "", row.currency || "", row.reconciliation_status || "", String(row.risk_score),
    row.risk_category, row.status, row.uid,
  ].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","));
  return [header.join(","), ...lines].join("\n");
}

export default function InvoicesPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [data, setData] = useState<InvoiceListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState(params.get("q") || "");

  const query = useMemo(() => {
    const next = new URLSearchParams();
    ["q", "status", "queue", "risk_category", "reconciliation_status", "sort", "page"].forEach((key) => {
      const value = params.get(key);
      if (value) next.set(key, value);
    });
    if (!next.get("sort")) next.set("sort", "-created_at");
    next.set("page_size", "20");
    return next.toString();
  }, [params]);

  useEffect(() => {
    setData(null);
    api.get<InvoiceListResponse>(`/invoices?${query}`)
      .then((res) => { setData(res); setError(null); })
      .catch((err) => setError(err.message));
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const current = params.get("q") || "";
      if (searchDraft !== current) {
        const next = new URLSearchParams(params);
        if (searchDraft) next.set("q", searchDraft); else next.delete("q");
        next.delete("page");
        setParams(next);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchDraft, params, setParams]);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    next.delete("page");
    setParams(next);
  };

  const page = Number(params.get("page") || 1);

  if (error) return <ErrorState message={error} onRetry={() => setParams(new URLSearchParams(params))} />;

  const activeFilters = ["status", "queue", "risk_category", "reconciliation_status"].filter((key) => params.get(key));

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Invoice operations"
        title="Invoice registry"
        subtitle="Every invoice with its extraction, matching and risk state. Filters are applied server-side inside the tenant boundary."
        actions={
          <>
            <button
              className="btn"
              disabled={!data?.items.length}
              onClick={() => {
                const blob = new Blob([toCsv(data?.items || [])], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "invoiceguard-invoices.csv";
                link.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Icon name="download" /> Export page
            </button>
            <Link className="btn primary" to="/upload"><Icon name="upload" /> Upload</Link>
          </>
        }
      />

      <Card tight>
        <div className="row wrap" style={{ padding: 12, gap: 8, borderBottom: "1px solid var(--line)" }}>
          <SearchInput value={searchDraft} onChange={setSearchDraft} placeholder="Invoice number, vendor, PO…" width={280} />
          <select className="select" style={{ width: 160 }} value={params.get("status") || ""} onChange={(e) => setFilter("status", e.target.value)} aria-label="Status">
            {STATUS_OPTIONS.map((option) => <option key={option || "all"} value={option}>{option ? titleize(option) : "All statuses"}</option>)}
          </select>
          <select className="select" style={{ width: 150 }} value={params.get("risk_category") || ""} onChange={(e) => setFilter("risk_category", e.target.value)} aria-label="Risk">
            {RISK_OPTIONS.map((option) => <option key={option || "all"} value={option}>{option ? `${titleize(option)} risk` : "All risk tiers"}</option>)}
          </select>
          <select className="select" style={{ width: 180 }} value={params.get("reconciliation_status") || ""} onChange={(e) => setFilter("reconciliation_status", e.target.value)} aria-label="Reconciliation">
            {RECON_OPTIONS.map((option) => <option key={option || "all"} value={option}>{option ? titleize(option) : "All match states"}</option>)}
          </select>
          <select className="select" style={{ width: 150 }} value={params.get("sort") || "-created_at"} onChange={(e) => setFilter("sort", e.target.value)} aria-label="Sort">
            {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <div className="spacer" />
          {activeFilters.length > 0 && (
            <button className="btn ghost sm" onClick={() => { const next = new URLSearchParams(); if (params.get("q")) next.set("q", params.get("q")!); setParams(next); }}>
              <Icon name="x" /> Clear filters ({activeFilters.length})
            </button>
          )}
        </div>

        {!data ? <Loading label="Loading invoices" /> : data.items.length === 0 ? (
          <Empty title="No invoices match" message="Try a different search or clear the filters." icon="search" />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Invoice</th><th>Vendor</th><th>Dates</th><th>Amount</th>
                    <th>Matching</th><th>Risk</th><th>Workflow</th><th>Conf.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr key={row.uid} className="clickable" onClick={() => navigate(`/invoices/${row.uid}`)}>
                      <td>
                        <div className="cell-main">{row.invoice_number || "Unnumbered"}</div>
                        <div className="cell-sub mono">{row.uid.slice(0, 10)}…</div>
                      </td>
                      <td className="truncate" style={{ maxWidth: 200 }}>
                        <div>{row.vendor_name || <span className="muted">Unmatched vendor</span>}</div>
                        <div className="cell-sub">{row.po_number ? `PO ${row.po_number}` : "No PO reference"}</div>
                      </td>
                      <td className="tiny">
                        <div>Inv {date(row.invoice_date)}</div>
                        <div className="muted">Due {date(row.due_date)}</div>
                      </td>
                      <td className="num money">{money(row.total_amount, row.currency || "INR")}</td>
                      <td><StatusBadge status={row.reconciliation_status} />{row.is_duplicate && <div style={{ marginTop: 3 }}><StatusBadge status="DUPLICATE_REVIEW" /></div>}</td>
                      <td><RiskChip category={row.risk_category} score={row.risk_score} /></td>
                      <td><StatusBadge status={row.status} /><div className="cell-sub">{titleize(row.review_queue)}</div></td>
                      <td>{row.extraction_confidence !== undefined ? <Confidence value={row.extraction_confidence} showLabel={false} /> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={data.page} pageSize={data.page_size} total={data.total}
              onPage={(next) => { const p = new URLSearchParams(params); p.set("page", String(next)); setParams(p); }}
            />
          </>
        )}
      </Card>

      {data && (
        <div className="row wrap tiny muted" style={{ gap: 14 }}>
          <span>Facets:</span>
          {Object.entries(data.facets.by_status).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([key, count]) => (
            <button key={key} className="link-btn" onClick={() => setFilter("status", key)}>{titleize(key)} ({count})</button>
          ))}
        </div>
      )}
    </div>
  );
}
