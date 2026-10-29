export type Role = "ADMIN" | "AP_OPERATOR" | "PROCUREMENT_REVIEWER" | "FRAUD_INVESTIGATOR" | "APPROVER" | "AUDITOR";

export interface User {
  id: number;
  uid: string;
  email: string;
  full_name: string;
  role: Role;
  is_active?: boolean;
  last_login_at?: string | null;
  created_at?: string;
  tenant?: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_at: string;
  user: User;
}

export interface VendorBrief {
  id: number;
  uid: string;
  code: string;
  name: string;
  tax_id: string | null;
  payment_terms: string | null;
  default_currency: string | null;
  status: string;
  bank_account_masked: string | null;
}

export interface Vendor extends VendorBrief {
  email: string | null;
  address: string | null;
  normalized_address?: string | null;
  invoice_count?: number;
  open_findings?: number;
  average_risk?: number;
  created_at?: string;
  risk_notes?: string | null;
  bank_accounts?: BankAccount[];
  total_spend?: string;
  stats?: { invoice_count: number; total_spend: string; average_risk: number };
  recent_invoices?: Array<{ uid: string; invoice_number: string | null; invoice_date: string | null; total_amount: string | null; status: string; risk_score: number; risk_category: string }>;
}

export interface BankAccount {
  id?: number;
  account_masked: string;
  ifsc: string | null;
  is_primary?: boolean;
  verified: boolean;
  changed_at: string | null;
  source?: string | null;
}

export interface FieldEvidence {
  value: string | number | null;
  normalized: string | number | null;
  confidence: number;
  method: string;
  page: number | null;
  bbox: number[] | null;
  source_text: string | null;
}

export interface Finding {
  id: number;
  uid: string;
  type: string;
  rule_id: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  explanation: string;
  evidence: Record<string, unknown>;
  status: string;
  model_version: string | null;
  invoice_uid?: string | null;
  invoice_number?: string | null;
  vendor_name?: string | null;
  invoice_total?: string | null;
  resolution_note?: string | null;
  resolved_at?: string | null;
  created_at: string;
}

export interface InvoiceLine {
  id: number;
  line_no: number;
  description: string | null;
  item_code: string | null;
  quantity: string | null;
  unit: string | null;
  unit_price: string | null;
  tax_rate: string | null;
  line_total: string | null;
  confidence: number;
  po_line_id: number | null;
  source_text: string | null;
  page: number | null;
}

export interface Discrepancy {
  code: string;
  field?: string;
  severity: string;
  rule?: string;
  expected?: string;
  observed?: string;
  difference?: string | null;
  tolerance?: string | null;
  explanation: string;
  evidence?: Record<string, unknown>;
}

export interface Reconciliation {
  status: string;
  summary: string;
  discrepancies: Discrepancy[];
  line_results: Array<Record<string, unknown>>;
  price_variance_total: string;
  quantity_variance_total: string;
  tolerance_config: Record<string, number | boolean>;
  engine_version: string;
  financial_validation: Record<string, unknown>;
  purchase_order_id: number | null;
  grn_ids: number[];
  assessed_at: string;
}

export interface RiskSignal {
  /** Legacy field name kept for older payloads; prefer ``code``/``title``. */
  signal?: string;
  category?: string;
  code?: string;
  title?: string;
  points: number;
  detail: string;
  evidence?: Record<string, unknown>;
}

export interface RiskAssessment {
  score: number;
  category: string;
  signals: RiskSignal[];
  category_scores: Record<string, number>;
  anomaly_score: number | null;
  anomaly_percentile: number | null;
  model_version: string | null;
  feature_snapshot: Record<string, number | null>;
  engine_version: string;
  explanation: string;
  assessed_at: string;
}

export interface DocumentBrief {
  uid: string;
  filename: string;
  sha256: string;
  size_bytes: number;
  content_type: string;
  page_count: number;
  status: string;
  malware_status: string;
  source_channel: string;
  processing_ms: number | null;
  processed_at: string | null;
  failure_code: string | null;
  failure_reason: string | null;
  created_at: string | null;
}

export interface UploadResponse {
  document_uid: string;
  status: string;
  sha256: string;
  filename: string;
  size_bytes: number;
  page_count: number;
  content_type: string;
  malware_status: string;
  duplicate_of_document_uid: string | null;
  job_status: string | null;
  created_at: string;
  idempotent_replay: boolean;
  retry_instructions: string;
  invoice_uid: string | null;
}

export interface InvoiceSummary {
  uid: string;
  id: number;
  invoice_number: string | null;
  vendor_id: number | null;
  vendor_name: string | null;
  invoice_date: string | null;
  due_date?: string | null;
  total_amount: string | null;
  currency: string | null;
  status: string;
  review_queue: string | null;
  risk_score: number;
  risk_category: string;
  reconciliation_status: string | null;
  is_duplicate: boolean;
  extraction_confidence?: number;
  po_number?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface InvoiceDetail extends InvoiceSummary {
  invoice_number_normalized: string | null;
  vendor: VendorBrief | null;
  vendor_name_raw: string | null;
  vendor_match_score: number | null;
  vendor_tax_id: string | null;
  po_number: string | null;
  payment_terms: string | null;
  subtotal: string | null;
  tax_amount: string | null;
  discount_amount: string | null;
  shipping_amount: string | null;
  duplicate_of_invoice_id: number | null;
  extraction: {
    method: string;
    confidence: number;
    field_confidence: Record<string, number>;
    field_evidence: Record<string, FieldEvidence>;
    warnings: string[];
    validation: Record<string, unknown>;
    extractor_version: string | null;
    raw_text: string | null;
  };
  lines: InvoiceLine[];
  document: DocumentBrief | null;
  reconciliation: Reconciliation | null;
  risk: RiskAssessment | null;
  findings: Finding[];
  corrections: Array<{ id: number; field: string; original: string | null; corrected: string | null; reason: string; created_at: string }>;
  review_decisions: Array<{ id: number; action: string; reason: string; notes: string | null; previous_status: string | null; new_status: string | null; reviewer: User | null; created_at: string }>;
  notes: Array<{ id: number; note: string; author: User | null; created_at: string }>;
  assigned_reviewer: User | null;
  routing_reason: string | null;
  approved_at: string | null;
  final_decision_reason: string | null;
}

export interface InvoiceListResponse {
  items: InvoiceSummary[];
  total: number;
  page: number;
  page_size: number;
  facets: { by_status: Record<string, number>; by_queue: Record<string, number>; by_risk: Record<string, number> };
}

export interface DashboardMetrics {
  generated_at: string;
  scope?: "all" | "uploads";
  totals: {
    invoices: number;
    amount_processed: string;
    amount_under_review: string;
    pending_review: number;
    high_risk: number;
    critical_risk: number;
    matched: number;
    mismatched: number;
    confirmed_duplicates: number;
    potential_duplicates: number;
    ocr_failures: number;
    low_confidence_extractions: number;
    open_findings: number;
  };
  processing: { average_ms: number | null; median_ms: number | null; p95_ms: number | null; documents_measured: number };
  by_status: Record<string, number>;
  by_queue: Record<string, number>;
  by_risk_category: Record<string, number>;
  by_reconciliation: Record<string, number>;
  trend: Array<{ date: string; count: number; amount: number }>;
  evaluation: null | { name: string; type: string; dataset_size: number; metrics: Record<string, unknown>; created_at: string; is_synthetic: boolean; note: string };
}

export interface WorkspaceCounts {
  tenant_id: number;
  documents: { total: number; mine: number; others: number };
  invoices: { total: number };
  vendors: number;
  purchase_orders: number;
  goods_receipts: number;
  findings: number;
  empty: boolean;
}

export interface RecentUpload {
  document_uid: string;
  filename: string;
  document_status: string;
  job_status: string | null;
  uploaded_at: string | null;
  size_bytes: number;
  invoice_uid: string | null;
  invoice_number: string | null;
  invoice_status: string | null;
  risk_category: string | null;
}

export interface Worklist {
  highest_risk: Array<{ uid: string; invoice_number: string; vendor_name: string; risk_score: number; risk_category: string; status: string; total_amount: string | null }>;
  recent: Array<{ uid: string; invoice_number: string; vendor_name: string; status: string; risk_category: string; extraction_confidence: number; created_at: string }>;
  recent_findings: Array<{ id: number; rule_id: string; title: string; severity: string; invoice_id: number; created_at: string; invoice_uid?: string | null }>;
  recent_uploads?: RecentUpload[];
}

export interface PO {
  id: number;
  uid: string;
  po_number: string;
  vendor_id: number;
  vendor_name: string;
  status: string;
  currency: string;
  issue_date: string;
  expected_date: string | null;
  total_amount: string;
  line_count: number;
  source_system?: string;
}

export interface POLine {
  id: number;
  line_no: number;
  item_code: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  tax_rate: string;
  line_total: string;
  received_quantity: string;
}

export interface PODetail extends PO {
  notes: string | null;
  lines: POLine[];
  receipts: Array<{ id: number; uid: string; grn_number: string; received_date: string; status: string }>;
}

export interface GRN {
  id: number;
  uid: string;
  grn_number: string;
  purchase_order_id: number;
  po_number: string;
  po_uid?: string | null;
  received_date: string;
  status: string;
  line_count: number;
  received_by: string | null;
  notes?: string | null;
  source_system?: string;
  lines?: Array<{
    id: number;
    purchase_order_line_id: number;
    item_code: string;
    received_quantity: string;
    returned_quantity: string;
    unit?: string;
  }>;
}

export interface AuditEvent {
  id: number;
  event_type: string;
  entity_type: string;
  entity_id: string;
  invoice_id: number | null;
  actor_id: number | null;
  actor_email: string | null;
  actor_role: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  request_id: string | null;
  created_at: string;
}

export interface EvaluationRun {
  id: number;
  name: string;
  type: string;
  dataset: string;
  dataset_size: number;
  metrics: Record<string, unknown>;
  overall_score: number | null;
  is_synthetic: boolean;
  report_path: string | null;
  notes: string | null;
  created_at: string;
}

export interface ModelVersion {
  id: number;
  name: string;
  version: string;
  algorithm: string;
  purpose: string;
  training_rows: number | null;
  metrics: Record<string, unknown>;
  feature_names: string[] | null;
  is_active: boolean;
  notes: string | null;
  training_meta: Record<string, unknown> | null;
  trained_at: string | null;
}

export interface HealthReady {
  status: string;
  timestamp: string;
  checks: Record<string, Record<string, unknown>>;
}

export interface OCRPage {
  page: number;
  page_number: number;
  method: string;
  text: string;
  mean_confidence: number | null;
  engine: string;
  preprocessing: string[];
  duration_ms: number;
  image_width: number | null;
  image_height: number | null;
  words: Array<{ text: string; x0: number; y0: number; x1: number; y1: number; confidence: number | null }>;
  warnings: string[];
}

export interface OcrResponse {
  document_uid: string;
  pages: OCRPage[];
}

export interface ProcessingJob {
  uid: string;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  next_attempt_at: string | null;
  document_uid: string;
  filename: string;
  document_status: string;
  created_at: string;
}
