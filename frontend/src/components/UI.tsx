import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";
import { Icon, type IconName } from "./Icons";
import { riskTone, statusTone, titleize } from "../utils/format";

export function PageHeader({ title, subtitle, actions, eyebrow }: {
  title: string; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: string;
}) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <div className="tiny muted" style={{ letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 650, marginBottom: 4 }}>{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <div className="sub">{subtitle}</div>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Card({ title, subtitle, actions, children, tight, foot, className = "" }: {
  title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode;
  tight?: boolean; foot?: ReactNode; className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          <div style={{ minWidth: 0 }}>
            {title && <h2>{title}</h2>}
            {subtitle && <div className="sub">{subtitle}</div>}
          </div>
          {actions && <div className="row" style={{ marginLeft: "auto" }}>{actions}</div>}
        </div>
      )}
      <div className={`card-body ${tight ? "tight" : ""}`}>{children}</div>
      {foot && <div className="card-foot">{foot}</div>}
    </section>
  );
}

export function Stat({ label, value, sub, icon, tone = "indigo" }: {
  label: string; value: ReactNode; sub?: ReactNode; icon?: IconName; tone?: string;
}) {
  return (
    <div className="card stat">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="stat-label">{label}</div>
        {icon && <div className={`stat-icon tone-${tone}`}><Icon name={icon} size={15} /></div>}
      </div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function Badge({ children, tone = "neutral", dot }: { children: ReactNode; tone?: string; dot?: boolean }) {
  return <span className={`badge ${tone}`}>{dot && <span className="dot" />}{children}</span>;
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  return <Badge tone={statusTone(status)}>{titleize(status)}</Badge>;
}

export function RiskChip({ category, score, compact }: { category: string | null | undefined; score?: number | null; compact?: boolean }) {
  const tone = riskTone(category);
  if (compact) {
    return <span className={`risk-chip ${tone}`}><span className="risk-dot" style={{ background: "currentColor" }} />{score ?? "—"}</span>;
  }
  return (
    <span className={`risk-chip ${tone}`}>
      <span className="risk-dot" style={{ background: "currentColor" }} />
      {score !== undefined && score !== null ? `${score} · ` : ""}{titleize(category || "low")}
    </span>
  );
}

export function Confidence({ value, showLabel = true }: { value: number | null | undefined; showLabel?: boolean }) {
  const pct = Math.round((value ?? 0) * 100);
  const tone = pct >= 85 ? "#16a34a" : pct >= 65 ? "#d97706" : "#dc2626";
  return (
    <span className="conf" title={`Extraction confidence ${pct}%`}>
      {showLabel && <span>Conf</span>}
      <span className="conf-bar" style={{ width: 58 }}><i style={{ width: `${Math.min(pct, 100)}%`, background: tone }} /></span>
      <b>{pct}%</b>
    </span>
  );
}

export function Spinner({ large }: { large?: boolean }) {
  return <div className={`spinner ${large ? "lg" : ""}`} role="status" aria-label="Loading" />;
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return <div className="loading-block"><div className="row"><Spinner /><span className="muted small">{label}…</span></div></div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="empty">
      <div className="icon"><Icon name="alert" size={20} /></div>
      <h3>Something went wrong</h3>
      <p className="small" style={{ maxWidth: 480, margin: "0 auto 12px" }}>{message}</p>
      {onRetry && <button className="btn" onClick={onRetry}><Icon name="refresh" /> Retry</button>}
    </div>
  );
}

export function Empty({ title, message, icon = "inbox" as IconName, action }: {
  title: string; message?: string; icon?: IconName; action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="icon"><Icon name={icon} size={20} /></div>
      <h3>{title}</h3>
      {message && <p className="small" style={{ maxWidth: 440, margin: "0 auto 12px" }}>{message}</p>}
      {action}
    </div>
  );
}

export function Modal({ title, subtitle, children, onClose, footer, wide }: {
  title: string; subtitle?: string; children: ReactNode; onClose: () => void; footer?: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "wide" : ""}`}>
        <div className="modal-head">
          <div className="row">
            <div>
              <h2>{title}</h2>
              {subtitle && <div className="tiny muted" style={{ marginTop: 3 }}>{subtitle}</div>}
            </div>
            <button className="icon-btn" style={{ marginLeft: "auto" }} onClick={onClose} aria-label="Close"><Icon name="x" /></button>
          </div>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ title, subtitle, children, onClose, footer }: {
  title: string; subtitle?: string; children: ReactNode; onClose: () => void; footer?: ReactNode;
}) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer">
        <div className="drawer-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <div className="tiny muted" style={{ marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button className="icon-btn" style={{ marginLeft: "auto" }} onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, active, onChange }: {
  tabs: Array<{ id: T; label: string; count?: number }>; active: T; onChange: (id: T) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button key={tab.id} role="tab" aria-selected={active === tab.id} className={`tab ${active === tab.id ? "active" : ""}`} onClick={() => onChange(tab.id)}>
          {tab.label}{tab.count !== undefined && <span className="tag" style={{ marginLeft: 6 }}>{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPage }: {
  page: number; pageSize: number; total: number; onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const numbers: number[] = [];
  const from = Math.max(1, Math.min(page - 2, pages - 4));
  for (let i = from; i <= Math.min(pages, from + 4); i += 1) numbers.push(i);
  return (
    <div className="table-foot">
      <span>{start}–{end} of {total}</span>
      <div className="pager">
        <button onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">‹</button>
        {numbers.map((n) => (
          <button key={n} className={n === page ? "active" : ""} onClick={() => onPage(n)}>{n}</button>
        ))}
        <button onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page">›</button>
      </div>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search", width }: {
  value: string; onChange: (v: string) => void; placeholder?: string; width?: number;
}) {
  return (
    <div className="search" style={{ width }}>
      <Icon name="search" />
      <input className="input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-label={placeholder} />
    </div>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {error && <span className="tiny" style={{ color: "var(--red)" }}>{error}</span>}
      {hint && !error && <span className="hint">{hint}</span>}
    </div>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
    >
      <Icon name={copied ? "check" : "copy"} /> {copied ? "Copied" : label}
    </button>
  );
}

/* toast system */
interface ToastItem { id: number; text: string; tone: "info" | "success" | "error" }
const ToastContext = createContext<{ push: (text: string, tone?: ToastItem["tone"]) => void }>({ push: () => undefined });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const push = useCallback((text: string, tone: ToastItem["tone"] = "info") => {
    counter.current += 1;
    const id = counter.current;
    setItems((prev) => [...prev, { id, text, tone }]);
    setTimeout(() => setItems((prev) => prev.filter((item) => item.id !== id)), 4200);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={`toast ${item.tone}`}>
            <Icon name={item.tone === "error" ? "alert" : item.tone === "success" ? "circle-check" : "info"} size={15} />
            <span>{item.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

export function InfoNote({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" | "danger" | "success" }) {
  return (
    <div className={`alert ${tone}`}>
      <Icon name={tone === "success" ? "circle-check" : tone === "info" ? "info" : "alert"} />
      <div>{children}</div>
    </div>
  );
}

export function DataTable({ children }: { children: ReactNode }) {
  return <div className="table-wrap"><table className="data">{children}</table></div>;
}
