import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { Icon } from "../components/Icons";
import { Badge, Card, Empty, ErrorState, Loading, PageHeader, StatusBadge, useToast } from "../components/UI";
import { dateTime, relative, titleize } from "../utils/format";

interface Job {
  uid: string;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  error_code: string | null;
  stage: string | null;
  next_attempt_at: string | null;
  locked_by: string | null;
  finished_at: string | null;
  document_uid: string | null;
  filename: string | null;
  document_status: string | null;
  processing_ms: number | null;
  created_at: string;
}

const STATUSES = ["", "PENDING", "RUNNING", "RETRY_SCHEDULED", "SUCCEEDED", "FAILED", "DEAD_LETTER"];
const IN_FLIGHT = ["PENDING", "RUNNING", "RETRY_SCHEDULED"];

export default function QueuePage() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") || "";
  const [data, setData] = useState<{ counts: Record<string, number>; items: Job[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  const lastSeen = useRef<string>("");

  const load = useCallback((silent = false) => {
    if (!silent) setData(null);
    api.get<{ counts: Record<string, number>; items: Job[] }>(`/documents/jobs${status ? `?status=${status}` : ""}`)
      .then((res) => {
        const key = JSON.stringify(res);
        if (key !== lastSeen.current) {
          lastSeen.current = key;
          setData(res);
        }
        setError(null);
      })
      .catch((err) => setError(err.message));
  }, [status]);

  useEffect(() => { load(); }, [load]);

  // Poll only while a job is still in flight; a settled queue stays still until the user acts.
  const inFlight = (data?.items || []).some((job) => IN_FLIGHT.includes(job.status));
  useEffect(() => {
    if (!inFlight) return;
    const timer = setInterval(() => load(true), 5000);
    return () => clearInterval(timer);
  }, [inFlight, load]);

  const retry = async (uid: string) => {
    setBusy(uid);
    try {
      await api.post(`/documents/${uid}/retry`);
      toast.push("Document re-queued for processing.", "success");
      load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "Retry failed", "error");
    } finally {
      setBusy(null);
    }
  };

  if (error) return <ErrorState message={error} onRetry={() => load()} />;
  if (!data) return <Loading label="Loading processing jobs" />;

  const total = Object.values(data.counts).reduce((a, b) => a + b, 0);

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Pipeline"
        title="Processing queue"
        subtitle="Durable jobs claimed by the worker with SKIP LOCKED semantics. Stale RUNNING jobs are recovered automatically after five minutes; failed jobs retry with exponential backoff."
        actions={<><button className="btn" onClick={() => load()}><Icon name="refresh" /> Refresh</button><Link className="btn primary" to="/upload"><Icon name="upload" /> Upload</Link></>}
      />

      <div className="grid grid-5">
        {["PENDING", "RUNNING", "RETRY_SCHEDULED", "SUCCEEDED", "FAILED"].map((key) => (
          <button key={key} className={`card stat ${status === key ? "is-active" : ""}`} onClick={() => setParams(key ? { status: key } : {})} style={{ textAlign: "left", borderColor: status === key ? "var(--primary)" : undefined }}>
            <div className="stat-label">{titleize(key)}</div>
            <div className="stat-value" style={{ fontSize: 21 }}>{data.counts[key] || 0}</div>
            <div className="stat-sub">{key === "FAILED" ? `${data.counts.DEAD_LETTER || 0} dead letter` : "jobs"}</div>
          </button>
        ))}
      </div>

      <Card
        title="Jobs"
        subtitle={`${total} jobs in the ledger${status ? ` · filtered to ${titleize(status)}` : ""}`}
        tight
        actions={
          <div className="pill-nav">
            {STATUSES.map((s) => (
              <button key={s || "ALL"} className={status === s ? "active" : ""} onClick={() => setParams(s ? { status: s } : {})}>{s ? titleize(s) : "All"}</button>
            ))}
          </div>
        }
      >
        {data.items.length === 0 ? (
          <Empty title="No jobs in this state" message="Upload a document to create a processing job." icon="queue" />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Document</th><th>Job status</th><th>Document status</th><th>Attempts</th><th>Duration</th><th>Created</th><th /></tr>
              </thead>
              <tbody>
                {data.items.map((job) => (
                  <tr key={job.uid}>
                    <td>
                      <div className="cell-main truncate" style={{ maxWidth: 240 }}>{job.filename || "—"}</div>
                      <div className="cell-sub mono">{job.document_uid?.slice(0, 12)}…</div>
                    </td>
                    <td>
                      <StatusBadge status={job.status} />
                      {job.last_error && <div className="tiny" style={{ color: "var(--red)", maxWidth: 260, marginTop: 3 }}>{job.last_error.slice(0, 120)}</div>}
                    </td>
                    <td><StatusBadge status={job.document_status} /></td>
                    <td className="tabular">{job.attempts} / {job.max_attempts}</td>
                    <td className="tabular">{job.processing_ms ? (job.processing_ms < 1000 ? `${Math.round(job.processing_ms)} ms` : `${(job.processing_ms / 1000).toFixed(1)}s`) : "—"}</td>
                    <td className="tiny muted">{relative(job.created_at)}</td>
                    <td className="right">
                      {["FAILED", "DEAD_LETTER"].includes(job.status) && job.document_uid && (
                        <button className="btn sm" onClick={() => retry(job.document_uid!)} disabled={busy === job.document_uid}>
                          <Icon name="refresh" /> Retry
                        </button>
                      )}
                      {job.status === "SUCCEEDED" && job.document_uid && (
                        <Link className="btn sm" to={`/queue?status=SUCCEEDED`} onClick={(e) => e.preventDefault()}>
                          <span className="muted">Done {dateTime(job.finished_at)}</span>
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid grid-3">
        <Card title="Worker model">
          <p className="small muted">Jobs are rows in <span className="mono">processing_jobs</span>. The worker claims one at a time in a short transaction, so multiple workers can share the queue safely on PostgreSQL.</p>
        </Card>
        <Card title="Retry policy">
          <p className="small muted">Retriable failures are re-scheduled with <span className="mono">min(300s, 10·2^(attempt−1))</span> backoff. Non-retriable validation failures fail immediately. After the third attempt the job becomes a dead letter.</p>
        </Card>
        <Card title="Crash recovery">
          <p className="small muted">A job left RUNNING for more than five minutes is reclaimed on the next worker loop. The document checksum is re-verified before any processing starts.</p>
        </Card>
      </div>
    </div>
  );
}
