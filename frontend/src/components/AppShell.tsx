import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { DashboardMetrics } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Icon, type IconName } from "./Icons";
import { Badge } from "./UI";

interface NavEntry { to: string; label: string; icon: IconName; permission: string; badge?: number }

const GROUPS: Array<{ label: string; items: NavEntry[] }> = [
  {
    label: "Overview",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: "dashboard", permission: "dashboard:read" },
      { to: "/upload", label: "Upload centre", icon: "upload", permission: "invoice:upload" },
      { to: "/queue", label: "Processing queue", icon: "queue", permission: "invoice:read" },
    ],
  },
  {
    label: "Invoice operations",
    items: [
      { to: "/invoices", label: "Invoice registry", icon: "invoices", permission: "invoice:read" },
      { to: "/matching", label: "3-way matching", icon: "match", permission: "invoice:read" },
      { to: "/approvals", label: "Approval queue", icon: "approval", permission: "invoice:read" },
    ],
  },
  {
    label: "Risk & compliance",
    items: [
      { to: "/fraud", label: "Fraud centre", icon: "shield", permission: "invoice:read" },
      { to: "/audit", label: "Audit trail", icon: "audit", permission: "audit:read" },
    ],
  },
  {
    label: "Master data",
    items: [
      { to: "/vendors", label: "Vendors", icon: "vendors", permission: "vendor:read" },
      { to: "/purchase-orders", label: "Purchase orders", icon: "po", permission: "po:read" },
      { to: "/goods-receipts", label: "Goods receipts", icon: "grn", permission: "grn:read" },
    ],
  },
  {
    label: "Administration",
    items: [
      { to: "/models", label: "Model evaluation", icon: "model", permission: "evaluation:read" },
      { to: "/users", label: "Users & roles", icon: "users", permission: "user:write" },
      { to: "/settings", label: "Settings & health", icon: "settings", permission: "dashboard:read" },
    ],
  },
];

const TITLES: Record<string, string> = {
  dashboard: "Dashboard", upload: "Upload centre", queue: "Processing queue", invoices: "Invoice registry",
  matching: "3-way match workspace", approvals: "Approval queue", fraud: "Fraud centre", audit: "Audit trail",
  vendors: "Vendors", "purchase-orders": "Purchase orders", "goods-receipts": "Goods receipts",
  models: "Model evaluation", users: "Users & roles", settings: "Settings & health",
};

export function AppShell() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [counts, setCounts] = useState<DashboardMetrics | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = () => api.get<DashboardMetrics>("/dashboard/metrics")
      .then((data) => {
        if (active) setCounts((previous) => (JSON.stringify(previous) === JSON.stringify(data) ? previous : data));
      })
      .catch(() => undefined);
    load();
    const timer = setInterval(load, 60_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [user, location.pathname]);

  const breadcrumb = useMemo(() => {
    const segment = location.pathname.split("/")[1] || "dashboard";
    const root = TITLES[segment] || segment;
    const detail = location.pathname.split("/")[2];
    return { root, detail };
  }, [location.pathname]);

  if (!user) return null;

  const submitSearch = () => {
    if (search.trim()) navigate(`/invoices?q=${encodeURIComponent(search.trim())}`);
  };

  return (
    <div className="shell">
      <aside className={`sidebar ${navOpen ? "open" : ""}`}>
        <Link to="/dashboard" className="brand" style={{ textDecoration: "none" }}>
          <div className="brand-mark">IG</div>
          <div>
            <div className="brand-name">InvoiceGuard AI</div>
            <div className="brand-sub">AP control tower</div>
          </div>
        </Link>
        <nav className="nav-scroll" aria-label="Main navigation">
          {GROUPS.map((group) => {
            const entries = group.items.filter((item) => can(item.permission));
            if (entries.length === 0) return null;
            return (
              <div className="nav-group" key={group.label}>
                <div className="nav-label">{group.label}</div>
                {entries.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                    onClick={() => setNavOpen(false)}
                  >
                    <Icon name={item.icon} />
                    <span>{item.label}</span>
                    {item.to === "/queue" && counts?.totals.pending_review ? (
                      <span className="count">{counts.totals.pending_review}</span>
                    ) : item.to === "/fraud" && counts?.totals.high_risk ? (
                      <span className="count">{counts.totals.high_risk}</span>
                    ) : null}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <div><span className="dot" /> All processing online</div>
          <div style={{ marginTop: 4 }}>Synthetic demo data</div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn" onClick={() => setNavOpen((v) => !v)} aria-label="Toggle navigation" style={{ display: "none" }}>
            <Icon name="menu" />
          </button>
          <div className="crumbs">
            <Icon name="grid" size={13} />
            <span>{breadcrumb.root}</span>
            {breadcrumb.detail && <><span className="dot-sep">/</span><strong>{breadcrumb.detail.slice(0, 12)}…</strong></>}
          </div>
          {/* Sandboxed preview frames block native form submission; the search field
              submits from its key handler instead. */}
          <div className="topbar-search" role="search">
            <Icon name="search" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitSearch();
              }}
              placeholder="Search invoice, vendor, PO…"
              aria-label="Global search"
            />
          </div>
          <Badge tone="teal">Synthetic data</Badge>
          <div style={{ position: "relative" }}>
            <button className="user-chip" onClick={() => setMenuOpen((v) => !v)} aria-haspopup="menu" aria-expanded={menuOpen}>
              <span className="avatar">{user.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
              <span className="user-meta">
                <span className="user-name">{user.full_name}</span>
                <span className="user-role" style={{ display: "block" }}>{user.role.replaceAll("_", " ")}</span>
              </span>
              <Icon name="chevron-down" size={13} />
            </button>
            {menuOpen && (
              <div className="card" style={{ position: "absolute", right: 0, top: 42, width: 230, zIndex: 40, padding: 6 }} role="menu">
                <div style={{ padding: "8px 10px" }}>
                  <div className="small strong">{user.email}</div>
                  <div className="tiny muted">{user.tenant}</div>
                </div>
                <div className="divider" style={{ margin: "4px 0" }} />
                <button className="nav-item" style={{ color: "var(--ink-2)" }} onClick={() => { setMenuOpen(false); navigate("/settings"); }}>
                  <Icon name="settings" /> Workspace settings
                </button>
                <button className="nav-item" style={{ color: "var(--red)" }} onClick={() => logout()}>
                  <Icon name="logout" /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
