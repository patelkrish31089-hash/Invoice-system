import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { Role, User } from "../api/types";
import { Icon } from "../components/Icons";
import { Badge, Card, Empty, ErrorState, Field, InfoNote, Loading, Modal, PageHeader, StatusBadge, useToast } from "../components/UI";
import { dateTime, titleize } from "../utils/format";

const ROLES: Array<{ value: Role; description: string }> = [
  { value: "ADMIN", description: "Full access, including users and model training" },
  { value: "AP_OPERATOR", description: "Upload, correct and request information; cannot approve" },
  { value: "PROCUREMENT_REVIEWER", description: "Maintain POs, GRNs and vendor master data" },
  { value: "FRAUD_INVESTIGATOR", description: "Investigate findings, escalate and resolve false positives" },
  { value: "APPROVER", description: "Approve or reject matched invoices (subject to SoD)" },
  { value: "AUDITOR", description: "Read-only access to invoices, findings and the audit trail" },
];

const EMPTY = { email: "", full_name: "", role: "AP_OPERATOR" as Role, password: "" };

export default function UsersPage() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [editRole, setEditRole] = useState<Role>("AP_OPERATOR");
  const [editActive, setEditActive] = useState(true);
  const toast = useToast();

  const load = useCallback(() => {
    setUsers(null);
    api.get<{ items: User[] }>("/users")
      .then((res) => { setUsers(res.items); setError(null); })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(load, [load]);

  const create = async () => {
    setBusy(true);
    try {
      await api.post("/users", form);
      toast.push("User created.", "success");
      setCreating(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "Could not create the user", "error");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await api.patch(`/users/${editing.uid}`, { role: editRole, is_active: editActive });
      toast.push("User updated.", "success");
      setEditing(null);
      load();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : "Could not update the user", "error");
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Administration"
        title="Users & roles"
        subtitle="Role-based access control inside a single tenant. Sessions are server-validated; deactivation revokes access on the next request."
        actions={<button className="btn primary" onClick={() => setCreating(true)}><Icon name="plus" /> Invite user</button>}
      />

      <InfoNote tone="info">
        <strong>Separation of duties.</strong> The uploader of a document cannot approve the resulting invoice while it is in a review queue. This is enforced server-side and cannot be overridden from the interface.
      </InfoNote>

      <Card title="Workspace members" subtitle={`${users?.length ?? 0} users`} tight>
        {!users ? <Loading label="Loading users" /> : users.length === 0 ? <Empty title="No users" icon="users" /> : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last sign-in</th><th /></tr></thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.uid}>
                    <td>
                      <div className="row" style={{ gap: 8 }}>
                        <span className="avatar" style={{ width: 26, height: 26, fontSize: 10 }}>{user.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
                        <div>
                          <div className="cell-main">{user.full_name}</div>
                          <div className="cell-sub">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><Badge tone={user.role === "ADMIN" ? "violet" : "neutral"}>{titleize(user.role)}</Badge></td>
                    <td><StatusBadge status={user.is_active === false ? "INACTIVE" : "ACTIVE"} /></td>
                    <td className="tiny muted">{user.last_login_at ? dateTime(user.last_login_at) : "Never"}</td>
                    <td className="right"><button className="btn sm" onClick={() => { setEditing(user); setEditRole(user.role); setEditActive(user.is_active !== false); }}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Role permissions" subtitle="Granted at the API layer, not only in the interface" tight>
        <div className="table-wrap">
          <table className="data compact">
            <thead><tr><th>Role</th><th>Capabilities</th></tr></thead>
            <tbody>
              {ROLES.map((role) => (
                <tr key={role.value}>
                  <td className="strong small nowrap">{titleize(role.value)}</td>
                  <td className="small muted">{role.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {creating && (
        <Modal
          title="Invite a user"
          subtitle="The user is created directly with this password; no email is sent in the demo environment."
          onClose={() => setCreating(false)}
          footer={
            <>
              <button className="btn" onClick={() => setCreating(false)}>Cancel</button>
              <button className="btn primary" onClick={create} disabled={busy || !form.email || !form.full_name || form.password.length < 12}>
                {busy ? "Creating…" : "Create user"}
              </button>
            </>
          }
        >
          <div className="stack" style={{ gap: 12 }}>
            <Field label="Full name"><input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
            <Field label="Work email"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Role">
              <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                {ROLES.map((role) => <option key={role.value} value={role.value}>{titleize(role.value)}</option>)}
              </select>
            </Field>
            <Field label="Temporary password" hint="Minimum 12 characters, with upper, lower, digit and symbol.">
              <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal
          title={`Edit ${editing.full_name}`}
          subtitle={editing.email}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn primary" onClick={saveEdit} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
            </>
          }
        >
          <div className="stack" style={{ gap: 12 }}>
            <Field label="Role">
              <select className="select" value={editRole} onChange={(e) => setEditRole(e.target.value as Role)}>
                {ROLES.map((role) => <option key={role.value} value={role.value}>{titleize(role.value)}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className="select" value={editActive ? "active" : "inactive"} onChange={(e) => setEditActive(e.target.value === "active")}>
                <option value="active">Active</option><option value="inactive">Deactivated</option>
              </select>
            </Field>
            <InfoNote tone="warning">You cannot deactivate your own account. Existing sessions for a deactivated user stop working immediately.</InfoNote>
          </div>
        </Modal>
      )}
    </div>
  );
}
