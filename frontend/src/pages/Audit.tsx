import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { Icon } from "../components/Icons";
import { Badge, Card, Drawer, Empty, ErrorState, Loading, PageHeader, Pagination, SearchInput } from "../components/UI";
import { dateTime, relative, titleize } from "../utils/format";
import type { AuditEvent } from "../api/types";

interface AuditPage {
  items: AuditEvent[];
  total: number;
  page: number;
  page_size: number;
}

export default function AuditPage() {
  const [events, setEvents] = useState<AuditPage | null>(null);
  const [types, setTypes] = useState<Array<{ type: string; count: number }>>([]);
  const [eventType, setEventType] = useState("");
  const [actor, setActor] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setEvents(null);
    const params = new URLSearchParams({ page: String(page), page_size: "50" });
    if (eventType) params.set("event_type", eventType);
    if (actor) params.set("actor_email", actor);
    api.get<AuditPage>(`/audit?${params.toString()}`)
      .then((res) => { setEvents(res); setError(null); })
      .catch((err) => setError(err.message));
  }, [page, eventType, actor]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get<{ event_types: Array<{ type: string; count: number }> }>("/audit/event-types")
      .then((res) => setTypes(res.event_types)).catch(() => undefined);
  }, []);

  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Risk & compliance"
        title="Audit trail"
        subtitle="Append-only events across ingest, extraction, matching, risk, workflow and administration. Records include the actor, role and request id."
        actions={<button className="btn" onClick={load}><Icon name="refresh" /> Refresh</button>}
      />

      <Card
        title="Event stream"
        subtitle={events ? `${events.total} events · page ${events.page}` : "Loading…"}
        tight
        actions={
          <div className="row" style={{ gap: 8 }}>
            <SearchInput value={actor} onChange={(value) => { setActor(value); setPage(1); }} placeholder="Actor email" width={210} />
            <select className="select" value={eventType} onChange={(e) => { setEventType(e.target.value); setPage(1); }} style={{ width: 220 }} aria-label="Event type">
              <option value="">All event types</option>
              {types.map((type) => <option key={type.type} value={type.type}>{type.type} ({type.count})</option>)}
            </select>
          </div>
        }
      >
        {!events ? <Loading label="Loading audit events" /> : events.items.length === 0 ? <Empty title="No matching events" icon="audit" /> : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Time</th><th>Event</th><th>Entity</th><th>Actor</th><th>Request</th><th /></tr></thead>
                <tbody>
                  {events.items.map((event) => (
                    <tr key={event.id} className="clickable" onClick={() => setSelected(event)}>
                      <td className="tiny nowrap">
                        <div>{dateTime(event.created_at)}</div>
                        <div className="muted">{relative(event.created_at)}</div>
                      </td>
                      <td><Badge tone={event.event_type.includes("reject") ? "danger" : event.event_type.includes("approved") ? "success" : "neutral"}>{event.event_type}</Badge></td>
                      <td>
                        <div className="small">{titleize(event.entity_type)}</div>
                        <div className="tiny mono muted">{String(event.entity_id).slice(0, 16)}</div>
                      </td>
                      <td className="small">
                        <div>{event.actor_email || "system"}</div>
                        <div className="tiny muted">{titleize(event.actor_role || "")}</div>
                      </td>
                      <td className="mono tiny">{event.request_id ? `${event.request_id.slice(0, 10)}…` : "—"}</td>
                      <td className="right"><Icon name="chevron-right" size={13} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={events.page} pageSize={events.page_size} total={events.total} onPage={setPage} />
          </>
        )}
      </Card>

      <div className="grid grid-3">
        <Card title="Immutability"><p className="small muted">Events are insert-only; the API exposes no update or delete route. Each row carries the actor, role, before/after payload and the originating request id.</p></Card>
        <Card title="What is recorded"><p className="small muted">Uploads, extraction, corrections, matching results, risk assessments, routing, decisions, notes, assignments, vendor and policy changes, logins and model training.</p></Card>
        <Card title="Retention"><p className="small muted">The audit table is never purged by application code. Production deployments should apply a legal-hold-aware retention policy at the database level.</p></Card>
      </div>

      {selected && (
        <Drawer
          title={selected.event_type}
          subtitle={`${dateTime(selected.created_at)} · ${selected.actor_email || "system"}`}
          onClose={() => setSelected(null)}
          footer={<button className="btn" onClick={() => setSelected(null)}>Close</button>}
        >
          <div className="kv">
            <dt>Event id</dt><dd className="mono tiny">{selected.id}</dd>
            <dt>Entity</dt><dd>{titleize(selected.entity_type)} · <span className="mono tiny">{selected.entity_id}</span></dd>
            <dt>Invoice id</dt><dd>{selected.invoice_id ?? "—"}</dd>
            <dt>Actor</dt><dd>{selected.actor_email || "system"} ({titleize(selected.actor_role || "")})</dd>
            <dt>Request</dt><dd className="mono tiny">{selected.request_id || "—"}</dd>
          </div>
          <div className="divider" />
          <h3>Payload</h3>
          <pre className="code-block" style={{ marginTop: 8 }}>{JSON.stringify({ before: selected.before, after: selected.after }, null, 2)}</pre>
        </Drawer>
      )}
    </div>
  );
}
