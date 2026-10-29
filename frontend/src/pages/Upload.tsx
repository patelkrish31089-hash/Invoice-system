import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { UploadResponse } from "../api/types";
import { Icon } from "../components/Icons";
import { Badge, Card, InfoNote, PageHeader, StatusBadge, useToast } from "../components/UI";
import { bytes, dateTime } from "../utils/format";
import { uuid } from "../utils/id";

type UploadOutcome = UploadResponse & { filename: string; localError?: string };

const ACCEPTED = ["application/pdf", "image/png", "image/jpeg"];

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [outcomes, setOutcomes] = useState<UploadOutcome[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recent, setRecent] = useState<Array<Record<string, unknown>>>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const loadRecent = useCallback(() => {
    api.get<{ items: Array<Record<string, unknown>> }>("/documents?page_size=8")
      .then((res) => setRecent(res.items))
      .catch(() => undefined);
  }, []);

  useEffect(loadRecent, [loadRecent]);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const accepted: File[] = [];
    Array.from(incoming).forEach((file) => {
      if (!ACCEPTED.includes(file.type)) {
        toast.push(`${file.name}: only PDF, PNG and JPEG are accepted.`, "error");
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        toast.push(`${file.name}: exceeds the 15 MB limit.`, "error");
        return;
      }
      accepted.push(file);
    });
    setFiles((prev) => [...prev, ...accepted].slice(0, 10));
  };

  const uploadAll = async () => {
    if (files.length === 0) return;
    setUploading(true);
    for (const file of files) {
      const form = new FormData();
      form.append("file", file);
      try {
        const response = await api.upload<UploadResponse>("/documents/upload", form, uuid());
        setOutcomes((prev) => [{ ...response, filename: file.name }, ...prev]);
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Upload failed";
        setOutcomes((prev) => [{
          document_uid: "", status: "REJECTED", sha256: "", filename: file.name, size_bytes: file.size,
          page_count: 0, content_type: file.type, malware_status: "—", created_at: new Date().toISOString(),
          duplicate_of_document_uid: null, job_status: null, invoice_uid: null,
          retry_instructions: message, idempotent_replay: false, localError: message,
        }]);
        toast.push(`${file.name}: ${message}`, "error");
      }
    }
    setFiles([]);
    setUploading(false);
    loadRecent();
  };

  const pollDocument = async (uid: string) => {
    const response = await api.get<{ status: string; invoice_uid: string | null }>(`/documents/${uid}`);
    setOutcomes((prev) => prev.map((item) => item.document_uid === uid
      ? { ...item, status: response.status, invoice_uid: response.invoice_uid }
      : item));
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Intake"
        title="Upload centre"
        subtitle="Every file is validated (type, size, page count), hashed, scanned for malware and stored before a durable processing job is queued. Re-uploading the same bytes with the same idempotency key replays the original receipt."
        actions={<Link className="btn" to="/queue"><Icon name="queue" /> Processing queue</Link>}
      />

      <div className="split">
        <div className="stack">
          <Card title="Add invoices" subtitle="PDF (digital or scanned), PNG or JPEG · max 15 MB per file">
            <div
              className={`dropzone ${dragging ? "drag" : ""}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
            >
              <div className="icon"><Icon name="upload" size={20} /></div>
              <div className="strong">Drop invoice files here, or click to browse</div>
              <div className="tiny muted" style={{ marginTop: 4 }}>Up to 10 files per batch · processing starts automatically</div>
              <input
                ref={inputRef} type="file" hidden multiple accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => { addFiles(e.target.files); if (inputRef.current) inputRef.current.value = ""; }}
              />
            </div>

            {files.length > 0 && (
              <div className="stack" style={{ gap: 8, marginTop: 14 }}>
                {files.map((file, index) => (
                  <div className="file-row" key={`${file.name}-${index}`}>
                    <div className="thumb">{file.type === "application/pdf" ? "PDF" : "IMG"}</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="strong truncate">{file.name}</div>
                      <div className="tiny muted">{bytes(file.size)} · {file.type}</div>
                    </div>
                    <button className="icon-btn" style={{ marginLeft: "auto" }} onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))} aria-label={`Remove ${file.name}`}>
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                ))}
                <div className="row">
                  <button className="btn primary" onClick={uploadAll} disabled={uploading}>
                    <Icon name="upload" /> {uploading ? "Uploading…" : `Upload ${files.length} file${files.length === 1 ? "" : "s"}`}
                  </button>
                  <button className="btn ghost" onClick={() => setFiles([])} disabled={uploading}>Clear</button>
                </div>
              </div>
            )}
          </Card>

          {outcomes.length > 0 && (
            <Card title="This session" subtitle="Upload receipts returned by the API" tight>
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>File</th><th>Document</th><th>Status</th><th>Duplicate?</th><th>Action</th></tr></thead>
                  <tbody>
                    {outcomes.map((outcome, index) => (
                      <tr key={`${outcome.document_uid}-${index}`}>
                        <td>
                          <div className="cell-main truncate" style={{ maxWidth: 200 }}>{outcome.filename}</div>
                          <div className="cell-sub">{outcome.localError ? "Rejected" : bytes(outcome.size_bytes)}</div>
                        </td>
                        <td className="mono tiny">{outcome.document_uid ? `${outcome.document_uid.slice(0, 10)}…` : "—"}</td>
                        <td><StatusBadge status={outcome.status} /></td>
                        <td>{outcome.duplicate_of_document_uid ? <Badge tone="critical">Duplicate bytes</Badge> : outcome.idempotent_replay ? <Badge tone="info">Replay</Badge> : <span className="muted">—</span>}</td>
                        <td>
                          {outcome.document_uid && (
                            <div className="row" style={{ gap: 6 }}>
                              <button className="btn sm" onClick={() => pollDocument(outcome.document_uid)}><Icon name="refresh" /> Refresh</button>
                              {outcome.invoice_uid && <Link className="btn sm primary" to={`/invoices/${outcome.invoice_uid}`}>Open invoice</Link>}
                            </div>
                          )}
                          {outcome.localError && <span className="tiny" style={{ color: "var(--red)" }}>{outcome.localError}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Card title="Recent documents" subtitle="Newest documents in this workspace" tight
            actions={<Link className="link-btn" to="/queue">View queue</Link>}>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>File</th><th>Status</th><th>Pages</th><th>Processing</th><th>Received</th></tr></thead>
                <tbody>
                  {recent.map((doc) => (
                    <tr key={String(doc.uid)}>
                      <td>
                        <div className="cell-main truncate" style={{ maxWidth: 220 }}>{String(doc.filename)}</div>
                        <div className="cell-sub mono">{String(doc.sha256).slice(0, 12)}…</div>
                      </td>
                      <td><StatusBadge status={String(doc.status)} /></td>
                      <td className="tabular">{String(doc.page_count)}</td>
                      <td className="tabular">{doc.processing_ms ? `${Number(doc.processing_ms) / 1000}s` : "—"}</td>
                      <td className="tiny muted">{dateTime(String(doc.created_at))}</td>
                    </tr>
                  ))}
                  {recent.length === 0 && <tr><td colSpan={5}><div className="table-empty">No documents yet.</div></td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card title="What happens on upload">
            <div className="timeline">
              {[
                ["Validate", "Magic-byte type check, declared content-type match, size limit and PDF page cap. Archives, executables and SVG are rejected."],
                ["Fingerprint", "SHA-256 checksum, request hash and tenant-scoped idempotency key are stored. Identical bytes are flagged as a duplicate document."],
                ["Store", "Written to tenant-partitioned storage; malware scan result is recorded (disabled in this demo configuration)."],
                ["Queue", "A durable processing job is created. Retries use exponential backoff; exhausted jobs become dead letters."],
                ["Extract & match", "OCR or embedded text → fields with confidence and evidence → financial validation → three-way match → duplicate, rule and anomaly assessment → routing."],
              ].map(([title, text], index) => (
                <div className="timeline-item accent" key={title}>
                  <div className="timeline-title">{index + 1}. {title}</div>
                  <div className="timeline-body">{text}</div>
                </div>
              ))}
            </div>
          </Card>
          <InfoNote tone="warning">
            <strong>Synthetic demonstration.</strong> Files you upload here are stored locally for this workspace. Do not
            upload real invoices: the environment is a demo and not hardened for production data.
          </InfoNote>
          <Card title="Accepted formats">
            <div className="kv">
              <dt>PDF</dt><dd>Digital text or scanned · up to 25 pages</dd>
              <dt>PNG / JPEG</dt><dd>≥ 200 px · up to 60 megapixels</dd>
              <dt>Rejected</dt><dd>SVG, HTML, ZIP, executables, encrypted PDFs</dd>
              <dt>Max size</dt><dd>15 MB per file</dd>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
