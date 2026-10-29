import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { Icon } from "../components/Icons";
import { Badge, Card, Empty, ErrorState, Field, InfoNote, Loading, PageHeader, Tabs, useToast } from "../components/UI";
import { useAuth } from "../auth/AuthContext";
import { dateTime, titleize } from "../utils/format";

interface Policy {
  price_tolerance_pct: number;
  price_tolerance_abs: number;
  quantity_tolerance_pct: number;
  amount_rounding_tolerance: number;
  require_grn: boolean;
  allow_partial_receipts: boolean;
  approval_threshold: number;
}

interface SettingsResponse {
  policy: Policy;
  risk_weights: Record<string, unknown>;
  features: Record<string, string | number | boolean>;
  integrations: Record<string, { status: string; note?: string }>;
}

interface WorkspaceCounts {
  documents: { total: number; mine: number; others: number };
  invoices: { total: number };
  vendors: number;
  purchase_orders: number;
  goods_receipts: number;
  findings: number;
  empty: boolean;
}

interface Dependency {
  status: string;
  [key: string]: unknown;
}

export default function SettingsPage() {
  const [tab, setTab] = useState<"policy" | "health" | "integrations" | "security">("policy");
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [dependencies, setDependencies] = useState<Record<string, Dependency> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceCounts | null>(null);
  const toast = useToast();
  const { can } = useAuth();

  const load = useCallback(() => {
    api.get<SettingsResponse>("/system/settings")
      .then((res) => { setData(res); setPolicy(res.policy); setError(null); })
      .catch((err) => setError(err.message));
    api.get<Record<string, Dependency>>("/health/dependencies")
      .then(setDependencies)
      .catch(() => undefined);
    api.get<WorkspaceCounts>("/system/workspace").then(setWorkspace).catch(() => undefined);
  }, []);

  useEffect(load, [load]);

  const clearDemoData = async () => {
    const message = "Delete every processed invoice and document in this workspace so the dashboard " +
      "shows only your own uploads?\n\nVendors, purchase orders and goods receipts are kept so new " +
      "invoices can still be matched. This cannot be undone.";
    if (!window.confirm(message)) return;
    setBusy(true);
    try {
      const result = await api.post<{ deleted: Record<string, number> }>("/system/workspace/clear", { mode: "documents" });
      toast.push(`Removed ${result.deleted.documents || 0} document(s) from the workspace.`, "success");
      load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "Could not clear the workspace", "error");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!policy) return;
    setBusy(true);
    try {
      await api.patch("/system/policy", policy);
      toast.push("Matching policy updated for this tenant.", "success");
      setDirty(false);
      load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "Could not save the policy", "error");
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data || !policy) return <Loading label="Loading workspace settings" />;

  const set = <K extends keyof Policy,>(key: K, value: Policy[K]) => {
    setPolicy({ ...policy, [key]: value });
    setDirty(true);
  };

  const healthIcon = (status: string) => {
    const tone = status === "ok" ? "ok" : status === "error" ? "error" : status === "degraded" ? "degraded" : "disabled";
    return <span className={`health-dot ${tone}`} />;
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Administration"
        title="Settings & health"
        subtitle="Tenant-scoped matching policy, live dependency checks, integration status and the security posture of this deployment."
        actions={<button className="btn" onClick={load}><Icon name="refresh" /> Refresh</button>}
      />

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "policy", label: "Matching policy" },
          { id: "health", label: "Health & dependencies" },
          { id: "integrations", label: "Integrations" },
          { id: "security", label: "Security posture" },
        ]}
      />

      {tab === "policy" && (
        <div className="split">
          <div className="stack">
            <Card
              title="Three-way matching tolerances"
              subtitle="Applied at the next analysis; existing assessments are not rewritten retroactively"
              actions={dirty ? <Badge tone="warning">Unsaved changes</Badge> : <Badge tone="success">Saved</Badge>}
            >
              <div className="form-grid">
                <Field label="Price tolerance (%)" hint="Allowed percentage variance between invoice and PO unit price.">
                  <input className="input" type="number" min="0" max="100" step="0.1" value={policy.price_tolerance_pct} onChange={(e) => set("price_tolerance_pct", Number(e.target.value))} />
                </Field>
                <Field label="Price tolerance (absolute)" hint="Also accept a variance no greater than this amount.">
                  <input className="input" type="number" min="0" step="0.01" value={policy.price_tolerance_abs} onChange={(e) => set("price_tolerance_abs", Number(e.target.value))} />
                </Field>
                <Field label="Quantity tolerance (%)" hint="Over-invoiced quantity beyond this percentage is a blocking variance.">
                  <input className="input" type="number" min="0" max="100" step="0.1" value={policy.quantity_tolerance_pct} onChange={(e) => set("quantity_tolerance_pct", Number(e.target.value))} />
                </Field>
                <Field label="Rounding tolerance" hint="Absolute difference allowed in arithmetic checks.">
                  <input className="input" type="number" min="0" step="0.01" value={policy.amount_rounding_tolerance} onChange={(e) => set("amount_rounding_tolerance", Number(e.target.value))} />
                </Field>
                <Field label="Approval threshold" hint="Invoices at or above this amount require explicit approval.">
                  <input className="input" type="number" min="0" step="1000" value={policy.approval_threshold} onChange={(e) => set("approval_threshold", Number(e.target.value))} />
                </Field>
                <div className="stack" style={{ gap: 10, justifyContent: "end" }}>
                  <label className="row" style={{ gap: 8 }}>
                    <input type="checkbox" checked={policy.require_grn} onChange={(e) => set("require_grn", e.target.checked)} />
                    <span className="small">Require a goods receipt for matching</span>
                  </label>
                  <label className="row" style={{ gap: 8 }}>
                    <input type="checkbox" checked={policy.allow_partial_receipts} onChange={(e) => set("allow_partial_receipts", e.target.checked)} />
                    <span className="small">Allow partial receipts</span>
                  </label>
                </div>
              </div>
              <div className="divider" />
              <div className="row">
                <button className="btn primary" onClick={save} disabled={busy || !dirty}>{busy ? "Saving…" : "Save policy"}</button>
                <button className="btn" onClick={() => { setPolicy(data.policy); setDirty(false); }} disabled={!dirty}>Discard</button>
                <span className="tiny muted" style={{ marginLeft: "auto" }}>Policy changes are audited with before/after values.</span>
              </div>
            </Card>
            <Card title="Risk engine weights" subtitle="Versioned configuration stored with every assessment">
              <pre className="code-block">{JSON.stringify(data.risk_weights, null, 2)}</pre>
            </Card>
          </div>
          <div className="stack">
            <Card title="Why tolerances matter">
              <p className="small muted">A zero-tolerance policy produces false positives on freight rounding and unit-of-measure conversions. A loose policy lets real over-billing through. These values are tenant-configurable so a finance team can calibrate them against its own invoice population.</p>
            </Card>
            <Card title="Current effect">
              <div className="kv">
                <dt>Price variance</dt><dd>{policy.price_tolerance_pct}% or {policy.price_tolerance_abs}</dd>
                <dt>Quantity</dt><dd>{policy.quantity_tolerance_pct}%</dd>
                <dt>Rounding</dt><dd>{policy.amount_rounding_tolerance}</dd>
                <dt>Approval gate</dt><dd>{policy.approval_threshold.toLocaleString("en-IN")}</dd>
                <dt>GRN</dt><dd>{policy.require_grn ? "Required" : "Optional"}</dd>
              </div>
            </Card>
            <InfoNote tone="info">Only administrators can change policy. The change is recorded in the audit trail and takes effect on the next analysis or re-analysis.</InfoNote>
          </div>
        </div>
      )}

      {tab === "health" && (
        <div className="stack">
          <Card title="Workspace data" subtitle="What this dashboard is aggregating and how to reset it">
            {!workspace ? <Loading label="Reading workspace" /> : (
              <>
                <div className="kv">
                  <dt>Documents</dt><dd>{workspace.documents.total.toLocaleString("en-IN")}</dd>
                  <dt>Uploaded by you</dt><dd>{workspace.documents.mine.toLocaleString("en-IN")}</dd>
                  <dt>Demonstration corpus</dt><dd>{workspace.documents.others.toLocaleString("en-IN")}</dd>
                  <dt>Invoices</dt><dd>{workspace.invoices.total.toLocaleString("en-IN")}</dd>
                  <dt>Vendors / POs / GRNs</dt>
                  <dd>{workspace.vendors} / {workspace.purchase_orders} / {workspace.goods_receipts}</dd>
                  <dt>Open findings</dt><dd>{workspace.findings.toLocaleString("en-IN")}</dd>
                </div>
                <div className="divider" />
                <p className="small muted">
                  Documents marked as demonstration data were generated by
                  <span className="mono"> scripts/seed_demo.py</span> and carry no uploader, so they never
                  appear under the dashboard&apos;s <em>Mine</em> scope. Clearing them keeps master
                  data and the matching policy, records a single audit event with the deletion counts, and
                  makes every figure come from files uploaded here.
                </p>
                {can("user:write") ? (
                  <button className="btn danger sm" onClick={clearDemoData} disabled={busy || workspace.empty}>
                    <Icon name="database" /> {busy ? "Clearing…" : "Clear processed invoices and documents"}
                  </button>
                ) : (
                  <InfoNote tone="info">An administrator can reset the workspace; your role is read-only here.</InfoNote>
                )}
              </>
            )}
          </Card>

          <Card title="Dependency checks" subtitle="Live probes executed by the API against its own dependencies" actions={<span className="tag">checked {dateTime(new Date().toISOString())}</span>}>
            {!dependencies ? <Loading label="Probing dependencies" /> : (
              <div>
                {Object.entries(dependencies).map(([name, check]) => (
                  <div className="health-check" key={name}>
                    {healthIcon(String(check.status))}
                    <div>
                      <div className="strong small">{titleize(name)}</div>
                      <div className="tiny muted">
                        {Object.entries(check).filter(([key]) => key !== "status").map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`).join(" · ")}
                      </div>
                    </div>
                    <div style={{ marginLeft: "auto" }}><Badge tone={check.status === "ok" ? "success" : check.status === "error" ? "danger" : "neutral"}>{String(check.status)}</Badge></div>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <div className="grid grid-2">
            <Card title="Runtime features" subtitle="Configuration of this deployment">
              <div className="kv">
                {Object.entries(data.features).map(([key, value]) => (
                  <div key={key} style={{ display: "contents" }}>
                    <dt>{titleize(key)}</dt>
                    <dd className="mono tiny">{typeof value === "boolean" ? (value ? "true" : "false") : String(value)}</dd>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Health endpoints">
              <div className="kv">
                <dt>Liveness</dt><dd className="mono">/api/v1/health/live</dd>
                <dt>Readiness</dt><dd className="mono">/api/v1/health/ready</dd>
                <dt>Dependencies</dt><dd className="mono">/api/v1/health/dependencies</dd>
              </div>
              <div className="divider" />
              <p className="small muted">Readiness returns 503 when the database or storage is unavailable. OCR availability is reported but does not fail readiness, because text-layer PDFs can still be processed.</p>
            </Card>
          </div>
          <InfoNote tone="warning">
            <strong>Embedded worker.</strong> This demo runs the job worker inside the API process. For production, disable <span className="mono">IG_EMBEDDED_WORKER</span> and run dedicated worker replicas against the same database.
          </InfoNote>
        </div>
      )}

      {tab === "integrations" && (
        <div className="grid grid-2">
          {Object.entries(data.integrations).map(([name, integration]) => (
            <Card key={name} title={titleize(name)} subtitle="Configured status is reported honestly, not simulated">
              <div className="row" style={{ gap: 8 }}>
                <Badge tone={integration.status === "ok" || integration.status === "disabled" ? "neutral" : integration.status === "NOT_CONFIGURED" ? "warning" : "info"}>{integration.status.replaceAll("_", " ")}</Badge>
              </div>
              <p className="small muted" style={{ marginTop: 10 }}>{integration.note || "No additional detail."}</p>
            </Card>
          ))}
          <Card title="Payment execution">
            <Badge tone="danger">Out of scope by design</Badge>
            <p className="small muted" style={{ marginTop: 10 }}>InvoiceGuard AI stops at approval for the payment stage. It does not create bank files, call payment APIs or hold payment credentials. Any payment integration must be built separately with its own controls.</p>
          </Card>
          <Card title="Email ingestion">
            <Badge tone="neutral">Not configured</Badge>
            <p className="small muted" style={{ marginTop: 10 }}>Manual upload is the only verified intake channel. An email connector needs provider credentials, authenticated webhooks and attachment sanitation before it can be enabled.</p>
          </Card>
        </div>
      )}

      {tab === "security" && (
        <div className="stack">
          <div className="grid grid-2">
            <Card title="Authentication">
              <ul className="small muted" style={{ paddingLeft: 18, margin: 0, lineHeight: 1.9 }}>
                <li>Passwords hashed with bcrypt; never stored or logged in plain text.</li>
                <li>Short-lived signed JWTs bound to a server-side session row; logout invalidates the session.</li>
                <li>Five failed logins lock the account for 15 minutes; lockout is audited.</li>
                <li>Login attempts are rate limited per IP and email address.</li>
              </ul>
            </Card>
            <Card title="Tenant isolation">
              <ul className="small muted" style={{ paddingLeft: 18, margin: 0, lineHeight: 1.9 }}>
                <li>Every scoped query filters on the tenant from the verified token.</li>
                <li>Object access resolves by tenant-scoped UID, never by guessable identifiers alone.</li>
                <li>Storage keys are partitioned by tenant id and content hash.</li>
                <li>Cross-tenant access returns 404 rather than leaking existence.</li>
              </ul>
            </Card>
            <Card title="Upload hardening">
              <ul className="small muted" style={{ paddingLeft: 18, margin: 0, lineHeight: 1.9 }}>
                <li>Magic-byte validation, declared-type agreement, size and page limits.</li>
                <li>SVG, HTML, archives and executables are rejected.</li>
                <li>SHA-256 checksum stored and re-verified before processing.</li>
                <li>Optional ClamAV scan; fail-closed mode available for production.</li>
              </ul>
            </Card>
            <Card title="Known limitations">
              <ul className="small muted" style={{ paddingLeft: 18, margin: 0, lineHeight: 1.9 }}>
                <li>Rate limiting is in-process and therefore single-node.</li>
                <li>ClamAV is disabled in this demo configuration.</li>
                <li>Secret management is environment-based; rotate the signing key before any shared deployment.</li>
                <li>No SSO, MFA or SCIM provisioning is implemented.</li>
              </ul>
            </Card>
          </div>
          <InfoNote tone="danger">
            <strong>Do not deploy this demo as-is.</strong> Set a strong <span className="mono">IG_SECRET_KEY</span>, disable demo seeding, run PostgreSQL with backups, terminate TLS at a proxy, and enable the malware scanner. See <span className="mono">docs/SECURITY.md</span>.
          </InfoNote>
        </div>
      )}
    </div>
  );
}
