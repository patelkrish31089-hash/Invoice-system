import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { InvoiceDetail, InvoiceListResponse } from "../api/types";
import { Icon } from "../components/Icons";
import { MatchPanel } from "../components/invoice/MatchPanel";
import { Card, Empty, ErrorState, Loading, PageHeader, RiskChip, SearchInput, StatusBadge } from "../components/UI";
import { money, relative } from "../utils/format";

const RECON_FILTERS = [
  { value: "MISMATCHED", label: "Mismatched" },
  { value: "PARTIALLY_MATCHED", label: "Partially matched" },
  { value: "MISSING_PO", label: "Missing PO" },
  { value: "MISSING_GRN", label: "Missing GRN" },
  { value: "INSUFFICIENT_DATA", label: "Insufficient data" },
];

export default function MatchingPage() {
  const [filter, setFilter] = useState("MISMATCHED");
  const [search, setSearch] = useState("");
  const [list, setList] = useState<InvoiceListResponse | null>(null);
  const [selected, setSelected] = useState<InvoiceDetail | null>(null);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(() => {
    setList(null);
    api.get<InvoiceListResponse>(`/invoices?reconciliation_status=${filter}&sort=-risk_score&page_size=40${search ? `&q=${encodeURIComponent(search)}` : ""}`)
      .then((res) => {
        setList(res);
        if (res.items.length > 0 && !res.items.some((item) => item.uid === selectedUid)) {
          setSelectedUid(res.items[0].uid);
        }
        setError(null);
      })
      .catch((err) => setError(err.message));
  }, [filter, search, selectedUid]);

  useEffect(() => { loadList(); }, [filter, search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedUid) { setSelected(null); return; }
    setLoadingDetail(true);
    api.get<InvoiceDetail>(`/invoices/${selectedUid}`)
      .then(setSelected)
      .catch(() => setSelected(null))
      .finally(() => setLoadingDetail(false));
  }, [selectedUid]);

  if (error) return <ErrorState message={error} onRetry={loadList} />;

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Invoice operations"
        title="3-way match workspace"
        subtitle="Compare invoice lines with the purchase order and goods receipts. Matching is deterministic; every variance cites the rule that produced it and the tolerance that was applied."
        actions={<Link className="btn" to="/settings"><Icon name="settings" /> Matching policy</Link>}
      />

      <div className="split-wide">
        <Card
          title="Match exceptions"
          subtitle={list ? `${list.total} invoices` : "Loading…"}
          tight
          actions={<div className="pill-nav">{RECON_FILTERS.map((option) => (
            <button key={option.value} className={filter === option.value ? "active" : ""} onClick={() => setFilter(option.value)}>{option.label}</button>
          ))}</div>}
        >
          <div style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Filter by invoice or vendor" />
          </div>
          {!list ? <Loading label="Loading exceptions" /> : list.items.length === 0 ? (
            <Empty title="Nothing to review" message="No invoices in this matching state." icon="match" />
          ) : (
            <div className="scroll-y" style={{ maxHeight: 680 }}>
              {list.items.map((item) => (
                <button
                  key={item.uid}
                  onClick={() => setSelectedUid(item.uid)}
                  style={{
                    display: "block", width: "100%", textAlign: "left", border: 0, borderBottom: "1px solid #eef1f5",
                    padding: "11px 14px", background: selectedUid === item.uid ? "var(--primary-soft)" : "transparent", cursor: "pointer",
                  }}
                >
                  <div className="row">
                    <span className="strong small">{item.invoice_number || "Unnumbered"}</span>
                    <span className="spacer" />
                    <RiskChip category={item.risk_category} score={item.risk_score} />
                  </div>
                  <div className="row" style={{ marginTop: 3 }}>
                    <span className="tiny muted truncate" style={{ maxWidth: 150 }}>{item.vendor_name || "Unmatched"}</span>
                    <span className="spacer" />
                    <span className="small tabular">{money(item.total_amount, item.currency || "INR")}</span>
                  </div>
                  <div className="row" style={{ marginTop: 5, gap: 5 }}>
                    <StatusBadge status={item.reconciliation_status} />
                    <span className="tiny muted">{item.po_number || "no PO"} · {relative(item.created_at)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <div className="stack">
          {loadingDetail ? <Loading label="Loading match detail" /> : selected ? (
            <>
              <Card
                title={`${selected.invoice_number || "Unnumbered invoice"} · ${selected.vendor?.name || "Unmatched vendor"}`}
                subtitle={`Invoice ${money(selected.total_amount, selected.currency || "INR")} · ${selected.po_number || "no PO reference"}`}
                actions={<Link className="btn sm primary" to={`/invoices/${selected.uid}`}>Open full invoice <Icon name="arrow-right" /></Link>}
              >
                <div className="row wrap" style={{ gap: 8 }}>
                  <StatusBadge status={selected.status} />
                  <StatusBadge status={selected.reconciliation_status} />
                  <RiskChip category={selected.risk_category} score={selected.risk_score} />
                  <span className="tag">{selected.lines.length} invoice lines</span>
                  <span className="tag">confidence {Math.round(selected.extraction.confidence * 100)}%</span>
                </div>
              </Card>
              <MatchPanel invoice={selected} />
            </>
          ) : (
            <Card><Empty title="Select an invoice" message="Choose an exception on the left to compare it with the purchase order and receipts." icon="match" /></Card>
          )}
        </div>
      </div>
    </div>
  );
}
