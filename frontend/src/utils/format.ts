export function money(value: string | number | null | undefined, currency = "INR"): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "—";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${currency} ${num.toFixed(2)}`;
  }
}

export function compactMoney(value: string | number | null | undefined, currency = "INR"): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "—";
  if (Math.abs(num) >= 1_00_00_000) return `${currency} ${(num / 1_00_00_000).toFixed(2)} Cr`;
  if (Math.abs(num) >= 1_00_000) return `${currency} ${(num / 1_00_000).toFixed(2)} L`;
  if (Math.abs(num) >= 1_000) return `${currency} ${(num / 1_000).toFixed(1)}K`;
  return money(num, currency);
}

export function date(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value.endsWith("Z") || value.includes("+") ? value : `${value}Z`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function relative(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value.endsWith("Z") || value.includes("+") ? value : `${value}Z`);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (Number.isNaN(diff)) return "—";
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.round(diff / 86400)}d ago`;
  return date(value);
}

export function percent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function titleize(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function bytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

export function riskTone(category: string | null | undefined): "critical" | "high" | "medium" | "low" {
  const c = (category || "").toUpperCase();
  if (c === "CRITICAL") return "critical";
  if (c === "HIGH") return "high";
  if (c === "MEDIUM") return "medium";
  return "low";
}

export function statusTone(status: string | null | undefined): string {
  const s = (status || "").toUpperCase();
  if (["APPROVED_FOR_PAYMENT_STAGE", "APPROVED", "MATCHED", "RECEIVED", "COMPLETED", "CLEAN", "ACTIVE"].includes(s)) return "success";
  if (["REJECTED", "MISMATCHED", "FAILED", "INFECTED", "DEAD_LETTER", "LOCKED", "INACTIVE"].includes(s)) return "danger";
  if (["FRAUD_REVIEW", "DUPLICATE_REVIEW", "CRITICAL"].includes(s)) return "critical";
  if (["PENDING_APPROVAL", "HIGH", "RETRY_SCHEDULED", "OPEN", "PARTIALLY_MATCHED", "INFO_REQUESTED"].includes(s)) return "warning";
  if (["MATCH_REVIEW", "EXTRACTION_REVIEW", "MANUAL_REVIEW_REQUIRED", "PROCESSING", "QUEUED", "RUNNING", "PENDING"].includes(s)) return "info";
  if (["MATCHED_WITHIN_TOLERANCE", "APPROVED_FOR_PAYMENT_STAGE"].includes(s)) return "success";
  return "neutral";
}
