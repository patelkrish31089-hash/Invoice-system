import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { InvoiceDetail } from "../../api/types";
import { Icon } from "../Icons";
import { Badge, Card, Empty, StatusBadge } from "../UI";
import { dateTime, relative, titleize } from "../../utils/format";

interface AuditEvent {
  id: number;
  event_type: string;
  entity_type: string;
  entity_id: string;
  actor_email: string | null;
  actor_role: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  request_id: string | null;
  created_at: string;
}

export function WorkflowPanel({ invoice }: { invoice: InvoiceDetail }) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<{ events: AuditEvent[] }>(`/invoices/${invoice.uid}/audit`)
      .then((res) => setEvents(res.events))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [invoice.uid, invoice.updated_at]);

  return (
    <div className="split">
      <div className="stack">
        <Card title="Invoice audit trail" subtitle="Append-only events for this invoice, newest first" tight>
          {loading ? <div className="loading-block">Loading audit trail…</div> : events.length === 0 ? (
            <Empty title="No audit events" icon="audit" />
          ) : (
            <div className="timeline" style={{ padding: "18px 18px 4px 34px" }}>
              {[...events].reverse().map((event) => (
                <div className="timeline-item accent" key={event.id}>
                  <div className="timeline-title">
                    {titleize(event.event_type)}
                    <span className="tag" style={{ marginLeft: 8 }}>{event.actor_role || "system"}</span>
                  </div>
                  <div className="timeline-meta">
                    {event.actor_email || "system"} · {dateTime(event.created_at)} · {relative(event.created_at)}
                    {event.request_id && <> · <span className="mono">req {event.request_id.slice(0, 8)}</span></>}
                  </div>
                  {(event.before || event.after) && (
                    <div className="timeline-body">
                      <details>
                        <summary className="tiny muted" style={{ cursor: "pointer" }}>Before / after payload</summary>
                        <pre className="code-block" style={{ marginTop: 6 }}>{JSON.stringify({ before: event.before, after: event.after }, null, 2)}</pre>
                      </details>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      <div className="stack">
        <Card title="Review decisions" tight>
          {invoice.review_decisions.length === 0 ? <Empty title="No decisions yet" icon="approval" /> : (
            <div className="timeline" style={{ padding: "16px 16px 0 32px" }}>
              {[...invoice.review_decisions].reverse().map((decision) => (
                <div className="timeline-item" key={decision.id}>
                  <div className="timeline-title">{titleize(decision.action)} <StatusBadge status={decision.new_status} /></div>
                  <div className="timeline-meta">{decision.reviewer?.full_name || "Reviewer"} · {dateTime(decision.created_at)}</div>
                  <div className="timeline-body">{decision.reason}</div>
                  {decision.notes && <div className="mini-note" style={{ marginTop: 4 }}>{decision.notes}</div>}
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="Notes" tight>
          {invoice.notes.length === 0 ? <Empty title="No notes" icon="file" /> : (
            <div style={{ padding: 14 }} className="stack">
              {[...invoice.notes].reverse().map((note) => (
                <div key={note.id} style={{ borderLeft: "2px solid var(--line-strong)", paddingLeft: 10 }}>
                  <div className="tiny muted">{note.author?.full_name || "User"} · {relative(note.created_at)}</div>
                  <div className="small">{note.note}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="Extraction corrections" tight>
          {invoice.corrections.length === 0 ? <Empty title="No corrections" icon="scan" /> : (
            <div style={{ padding: 14 }} className="stack">
              {[...invoice.corrections].reverse().map((correction) => (
                <div key={correction.id}>
                  <div className="small"><span className="mono tiny">{correction.field}</span> <Icon name="arrow-right" size={11} /> <b>{correction.corrected}</b></div>
                  <div className="tiny muted">was “{correction.original ?? "empty"}” · {relative(correction.created_at)}</div>
                  <div className="tiny" style={{ color: "var(--ink-2)" }}>{correction.reason}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card title="Routing">
          <div className="kv">
            <dt>Queue</dt><dd>{titleize(invoice.review_queue)}</dd>
            <dt>Status</dt><dd><StatusBadge status={invoice.status} /></dd>
            <dt>Assigned to</dt><dd>{invoice.assigned_reviewer?.full_name || "Unassigned"}</dd>
            <dt>Approved</dt><dd>{invoice.approved_at ? dateTime(invoice.approved_at) : "—"}</dd>
          </div>
          <div className="divider" />
          <div className="tiny muted">{invoice.routing_reason || "No routing reason recorded."}</div>
          {invoice.final_decision_reason && <div className="mini-note" style={{ marginTop: 8 }}>{invoice.final_decision_reason}</div>}
        </Card>
      </div>
    </div>
  );
}
