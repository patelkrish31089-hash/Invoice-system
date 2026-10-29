import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError, authenticatedBlob } from "../api/client";
import type { InvoiceDetail, OcrResponse } from "../api/types";
import { Icon } from "../components/Icons";
import { Badge, Card, ErrorState, Field, Loading, Modal, PageHeader, useToast } from "../components/UI";
import { bytes, dateTime, titleize } from "../utils/format";

const FIELD_LABELS: Record<string, string> = {
  vendor_name: "Vendor", vendor_tax_id: "Tax ID", invoice_number: "Invoice no.", invoice_date: "Invoice date",
  due_date: "Due date", po_number: "PO number", currency: "Currency", payment_terms: "Terms",
  subtotal: "Subtotal", tax_amount: "Tax", discount_amount: "Discount", shipping_amount: "Shipping",
  total_amount: "Total",
};

export default function OcrReviewPage() {
  const { uid } = useParams<{ uid: string }>();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [ocr, setOcr] = useState<OcrResponse | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeBox, setActiveBox] = useState<string | null>(null);
  const [showAllWords, setShowAllWords] = useState(true);
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgWidth, setImgWidth] = useState(0);
  const toast = useToast();

  const load = useCallback(() => {
    if (!uid) return;
    Promise.all([api.get<InvoiceDetail>(`/invoices/${uid}`)]).then(async ([detail]) => {
      setInvoice(detail);
      if (!detail.document) return;
      const [ocrData, blob] = await Promise.all([
        api.get<OcrResponse>(`/documents/${detail.document.uid}/ocr?include_words=true`),
        authenticatedBlob(`/documents/${detail.document.uid}/file`),
      ]);
      setOcr(ocrData);
      setUrl(URL.createObjectURL(blob));
      setError(null);
    }).catch((err) => setError(err.message));
  }, [uid]);

  useEffect(load, [load]);

  const page = ocr?.pages[pageIndex];
  const isImage = invoice?.document?.content_type !== "application/pdf";
  const scale = useMemo(() => {
    if (!page?.image_width || !imgWidth) return 1;
    return imgWidth / page.image_width;
  }, [page?.image_width, imgWidth]);

  const openCorrection = (field: string) => {
    const current = invoice?.extraction.field_evidence?.[field]?.normalized;
    setCorrecting(field);
    setValue(current === null || current === undefined ? "" : String(current));
    setReason("");
  };

  const submitCorrection = async () => {
    if (!correcting) return;
    setBusy(true);
    try {
      await api.post(`/invoices/${uid}/corrections`, { field: correcting, value, reason });
      toast.push("Field corrected and invoice re-analysed.", "success");
      setCorrecting(null);
      load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "Correction failed", "error");
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!invoice || !ocr) return <Loading label="Loading OCR evidence" />;

  const fields = Object.entries(invoice.extraction.field_evidence || {});
  const selectedField = activeBox ? fields.find(([name]) => name === activeBox) : null;

  return (
    <div className="stack">
      <div className="row">
        <Link to={`/invoices/${uid}`} className="btn ghost sm"><Icon name="arrow-left" /> Back to invoice</Link>
        <span className="muted small">{invoice.invoice_number || "Unnumbered invoice"} · {invoice.vendor?.name || "Unmatched vendor"}</span>
      </div>
      <PageHeader
        eyebrow="Extraction review"
        title="OCR evidence viewer"
        subtitle="Words, confidence and bounding boxes from the stored OCR result. Low-confidence tokens are highlighted; field boxes come from the extractor's evidence record."
        actions={
          <>
            {page && <Badge tone={page.method === "ocr" ? "warning" : "teal"}>{page.method === "ocr" ? "Tesseract OCR" : "Embedded PDF text"}</Badge>}
            <button className="btn" onClick={load}><Icon name="refresh" /> Reload</button>
          </>
        }
      />

      <div className="split-wide">
        <div className="stack">
          <Card title="Extracted fields" subtitle="Click a field to highlight its evidence box" tight>
            <div className="scroll-y">
              {fields.map(([field, evidence]) => (
                <div
                  key={field}
                  className={`row`}
                  style={{ padding: "9px 14px", borderBottom: "1px solid #eef1f5", cursor: "pointer", background: activeBox === field ? "var(--primary-soft)" : undefined }}
                  onClick={() => setActiveBox(activeBox === field ? null : field)}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="tiny muted">{FIELD_LABELS[field] || titleize(field)}</div>
                    <div className="small strong truncate">{String(evidence.normalized ?? evidence.value ?? "—")}</div>
                  </div>
                  <div className="right">
                    <div className="tiny mono">{Math.round(evidence.confidence * 100)}%</div>
                    <div className="tiny muted">p{evidence.page ?? "—"}</div>
                  </div>
                  <button className="icon-btn" onClick={(event) => { event.stopPropagation(); openCorrection(field); }} aria-label={`Correct ${field}`}>
                    <Icon name="scan" size={13} />
                  </button>
                </div>
              ))}
              {fields.length === 0 && <div className="table-empty">No field evidence stored.</div>}
            </div>
            <div className="card-foot tiny muted">Corrections are versioned and audited; the raw OCR output is never overwritten.</div>
          </Card>

          <Card title="Document" tight>
            {url && (isImage ? (
              <div className="doc-image-wrap" style={{ maxHeight: 720 }}>
                <img
                  ref={imgRef} src={url} alt="Scanned invoice" className="doc-image"
                  onLoad={() => setImgWidth(imgRef.current?.clientWidth || 0)}
                  style={{ width: "100%" }}
                />
                {showAllWords && page?.words?.map((word, index) => (
                  <span
                    key={`${word.text}-${index}`}
                    className="bbox"
                    title={`${word.text} · ${word.confidence !== null ? Math.round(word.confidence) + "%" : "n/a"}`}
                    style={{
                      left: word.x0 * scale, top: word.y0 * scale,
                      width: Math.max((word.x1 - word.x0) * scale, 2), height: Math.max((word.y1 - word.y0) * scale, 2),
                      borderColor: (word.confidence ?? 100) < 60 ? "rgba(220, 38, 38, 0.7)" : undefined,
                    }}
                  />
                ))}
                {Array.isArray(selectedField?.[1]?.bbox) && selectedField[1].page === page?.page_number && (
                  <span
                    className="bbox"
                    style={{
                      left: Number(selectedField[1].bbox![0]) * scale, top: Number(selectedField[1].bbox![1]) * scale,
                      width: Math.max((Number(selectedField[1].bbox![2]) - Number(selectedField[1].bbox![0])) * scale, 3),
                      height: Math.max((Number(selectedField[1].bbox![3]) - Number(selectedField[1].bbox![1])) * scale, 3),
                      borderColor: "#f59e0b", borderWidth: 2, background: "rgba(245, 158, 11, 0.18)",
                    }}
                  />
                )}
              </div>
            ) : (
              <iframe className="doc-frame" src={`${url}#page=${pageIndex + 1}`} title="Invoice PDF" />
            ))}
            <div className="card-foot row">
              <button className="btn sm" onClick={() => setPageIndex((i) => Math.max(0, i - 1))} disabled={pageIndex === 0}><Icon name="arrow-left" /> Previous</button>
              <span className="small muted">Page {pageIndex + 1} of {ocr.pages.length}</span>
              <button className="btn sm" onClick={() => setPageIndex((i) => Math.min(ocr.pages.length - 1, i + 1))} disabled={pageIndex >= ocr.pages.length - 1}>Next <Icon name="arrow-right" /></button>
              {isImage && <label className="row tiny muted" style={{ marginLeft: "auto", gap: 4 }}><input type="checkbox" checked={showAllWords} onChange={(e) => setShowAllWords(e.target.checked)} /> Show word boxes</label>}
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card title="OCR metadata" subtitle={`Page ${pageIndex + 1}`}>
            <div className="kv">
              <dt>Method</dt><dd>{titleize(page?.method)}</dd>
              <dt>Engine</dt><dd>{page?.engine || "—"}</dd>
              <dt>Mean confidence</dt><dd>{page?.mean_confidence !== null && page?.mean_confidence !== undefined ? `${Math.round(page.mean_confidence)}%` : "—"}</dd>
              <dt>Preprocessing</dt><dd className="tiny">{page?.preprocessing?.length ? page.preprocessing.join(", ") : "none"}</dd>
              <dt>Duration</dt><dd>{page ? `${page.duration_ms} ms` : "—"}</dd>
              <dt>Image</dt><dd>{page?.image_width ? `${page.image_width} × ${page.image_height}` : "—"}</dd>
              <dt>Document</dt><dd className="truncate">{invoice.document?.filename}</dd>
              <dt>Size</dt><dd>{invoice.document ? bytes(invoice.document.size_bytes) : "—"}</dd>
              <dt>Uploaded</dt><dd className="tiny">{dateTime(invoice.document?.created_at ?? null)}</dd>
            </div>
            {page?.warnings?.length ? (
              <div className="alert warning" style={{ marginTop: 12 }}>
                <Icon name="alert" />
                <div>{page.warnings.map((warning) => <div key={warning}>{warning}</div>)}</div>
              </div>
            ) : null}
          </Card>

          <Card title="Recognised text" subtitle="Raw engine output for this page" tight>
            <pre className="raw-text" style={{ margin: 12 }}>{page?.text?.trim() || "No text was recognised on this page."}</pre>
          </Card>

          <Card title="Low-confidence words" subtitle="Tokens below 60% engine confidence" tight>
            <div style={{ padding: 12 }}>
              <div className="row wrap" style={{ gap: 6 }}>
                {(page?.words || []).filter((word) => (word.confidence ?? 100) < 60).slice(0, 60).map((word, index) => (
                  <span className="tag" key={`${word.text}-${index}`} style={{ borderColor: "#f0c7c7", color: "var(--red)" }}>
                    {word.text} · {word.confidence !== null ? Math.round(word.confidence) : "?"}%
                  </span>
                ))}
                {(page?.words || []).filter((word) => (word.confidence ?? 100) < 60).length === 0 && <span className="small muted">No low-confidence tokens on this page.</span>}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {correcting && (
        <Modal
          title={`Correct ${FIELD_LABELS[correcting] || titleize(correcting)}`}
          subtitle="The extraction is preserved; the correction is audited and used for matching."
          onClose={() => setCorrecting(null)}
          footer={
            <>
              <button className="btn" onClick={() => setCorrecting(null)}>Cancel</button>
              <button className="btn primary" onClick={submitCorrection} disabled={busy || !value.trim() || reason.trim().length < 5}>
                {busy ? "Saving…" : "Save correction"}
              </button>
            </>
          }
        >
          <div className="stack" style={{ gap: 12 }}>
            <Field label="Corrected value">
              <input className="input" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
            </Field>
            <Field label="Reason (min 5 characters)" hint="e.g. OCR read 8 as 3; verified against the printed total.">
              <textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <div className="tiny muted">Evidence: {invoice.extraction.field_evidence?.[correcting]?.source_text || "no source text captured"}</div>
          </div>
        </Modal>
      )}
    </div>
  );
}
