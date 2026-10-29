import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { RegisterForm } from "../auth/AuthContext";
import { Icon } from "../components/Icons";
import { Field, Spinner } from "../components/UI";
import { safeStorage } from "../utils/storage";

const DEMO_USERS = [
  ["admin@invoiceguard.ai", "Administrator"],
  ["analyst@invoiceguard.ai", "AP operator"],
  ["approver@invoiceguard.ai", "Approver"],
  ["fraud@invoiceguard.ai", "Fraud investigator"],
  ["auditor@invoiceguard.ai", "Auditor"],
] as const;

export default function LoginPage() {
  const { user, login, register, loading, notice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <div className="loading-block"><Spinner large /></div>;
  if (user) return <Navigate to={location.state?.from || "/dashboard"} replace />;

  const switchMode = (next: "signin" | "signup") => {
    setError(null);
    setMode(next);
    if (next === "signup") {
      setEmail("");
      setPassword("");
    } else {
      setEmail("");
      setPassword("");
    }
  };

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const form: RegisterForm = {
          email: email.trim(),
          full_name: fullName.trim(),
          workspace_name: workspaceName.trim(),
          password,
        };
        await register(form);
      } else {
        await login(email.trim(), password);
      }
      navigate(location.state?.from || "/dashboard", { replace: true });
    } catch (err) {
      const message = err instanceof ApiError
        ? err.message
        : "Cannot reach the API. Check that the backend is running, then try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-wrap">
      <section className="login-hero">
        <div>
          <div className="row" style={{ gap: 10 }}>
            <div className="brand-mark">IG</div>
            <div>
              <div className="brand-name" style={{ fontSize: 15 }}>InvoiceGuard AI</div>
              <div className="brand-sub">Accounts payable intelligence</div>
            </div>
          </div>
          <div style={{ marginTop: 56 }}>
            <h1>Three-way matching, anomaly detection, and a review trail you can defend.</h1>
            <p>
              Ingest invoices, verify them against purchase orders and goods receipts, surface duplicates and
              suspicious patterns, and route every decision through an auditable human workflow.
            </p>
            <div className="hero-points">
              {[
                "Deterministic matching with Decimal arithmetic and explicit tolerances",
                "OCR with field-level confidence and page/box evidence for every value",
                "Explainable 0–100 risk score — prioritisation, never a fraud verdict",
                "Immutable audit trail with role-based separation of duties",
              ].map((point) => (
                <div className="hero-point" key={point}>
                  <span className="tick"><Icon name="check" size={11} /></span>
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="tiny" style={{ color: "#69788f", lineHeight: 1.6 }}>
          Demonstration environment. Every vendor, purchase order, receipt and invoice in this workspace is
          synthetic. Risk scores are review-priority signals, not proof of fraud, and the system never executes
          payments.
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <h2>{mode === "signup" ? "Create your workspace" : "Sign in to the workspace"}</h2>
          <div className="sub">
            {mode === "signup"
              ? "Use any email address. You become the admin of a new, empty workspace that only you can see."
              : "Sign in with your email address, or try a demo role."}
          </div>
          {!safeStorage.persistent && (
            <div
              role="note"
              style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "#fff7e6", color: "#7a4b00", fontSize: 13, lineHeight: 1.5 }}
            >
              This embedded preview cannot keep your session across a page refresh, so you may need to sign in again after reloading.
              Open the app in its own browser tab to stay signed in.
            </div>
          )}
          {/* A <form> cannot submit inside a sandboxed preview iframe (no allow-forms),
              so the flow is driven by an explicit handler instead of native submission. */}
          <div
            className="stack"
            role="form"
            aria-label="Sign in"
            style={{ gap: 12 }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !submitting) {
                event.preventDefault();
                void submit();
              }
            }}
          >
            {notice && !error && <div className="form-error" role="alert">{notice}</div>}
            {error && <div className="form-error" role="alert">{error}</div>}
            {mode === "signup" && (
              <Field label="Full name">
                <input
                  className="input"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  aria-label="Full name"
                />
              </Field>
            )}
            <Field label="Email address">
              <input
                className="input"
                type="email"
                autoComplete={mode === "signup" ? "email" : "username"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-label="Email"
              />
            </Field>
            {mode === "signup" && (
              <Field label="Workspace name">
                <input
                  className="input"
                  type="text"
                  autoComplete="organization"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="e.g. Priya Traders"
                  required
                  aria-label="Workspace name"
                />
              </Field>
            )}
            <Field label="Password">
              <input
                className="input"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-label="Password"
              />
            </Field>
            {mode === "signup" && (
              <div className="tiny muted">
                At least 10 characters, with an uppercase letter, a lowercase letter and a digit.
              </div>
            )}
            <button className="btn primary wide lg" type="button" disabled={submitting}
              onClick={() => void submit()} aria-label={mode === "signup" ? "Create workspace" : "Sign in"}>
              {submitting
                ? <><Spinner /> {mode === "signup" ? "Creating workspace…" : "Signing in…"}</>
                : <>{mode === "signup" ? "Create workspace" : "Sign in"} <Icon name="arrow-right" /></>}
            </button>
            <div className="tiny muted" style={{ textAlign: "center" }}>
              {mode === "signin" ? (
                <>New here? <button type="button" className="link-btn" onClick={() => switchMode("signup")}>Create a workspace with your email</button></>
              ) : (
                <>Already have an account? <button type="button" className="link-btn" onClick={() => switchMode("signin")}>Sign in</button></>
              )}
            </div>
          </div>
          {mode === "signin" && (
            <div className="demo-box">
              <b>Demo accounts</b> · click a role to fill its email, then enter the demo password from your setup notes
              <div className="demo-users">
                {DEMO_USERS.map(([account, role]) => (
                  <div
                    key={account}
                    className="demo-user"
                    role="button"
                    tabIndex={0}
                    onClick={() => setEmail(account)}
                    onKeyDown={(e) => e.key === "Enter" && setEmail(account)}
                  >
                    <span>{account}</span><span>{role}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="tiny muted" style={{ marginTop: 16, lineHeight: 1.6 }}>
            Sessions are signed JWTs validated against the server-side session table. Five failed attempts lock
            the account for 15 minutes. Demo credentials are for this synthetic workspace only.
          </p>
        </div>
      </section>
    </div>
  );
}
