# Sensitive Data Classification, Privacy, Retention & Training Governance Policy (`docs/DATA_PRIVACY_AND_RETENTION_POLICY.md`)

**Authoritative Machine-Readable Endpoint:** `GET /api/v1/privacy/data-inventory` (`security_auditability`).

---

## 1. 8-Category Sensitive Data Inventory

| Category | Classification | Encryption & Storage Control | Log / Export Redaction | Statutory Retention | Deletable When Unheld? | ML Training Use |
|---|---|---|---|---:|---|---|
| `uploaded_invoice_documents` | `CONFIDENTIAL_FINANCIAL_DOCUMENT` | Safe random non-exec storage + SHA-256 hash | Never log raw bytes or full OCR text | 2,555 days (7 yr) | Yes (after retention & no legal hold) | Prohibited without opt-in + redaction |
| `extracted_supplier_customer_identifiers` | `RESTRICTED_BUSINESS_PII` | Tenant-isolated SQL | Mask personal contact names/phones | 2,555 days | Yes (after retention) | Redacted only with opt-in |
| `bank_remittance_details` | `CRITICAL_FINANCIAL_SECRET` | Field-level AES-256-GCM envelope keyring | Mask to `****6789`; zero plaintext in logs | 2,555 days | **No** (financial audit trail) | **Strictly Prohibited** |
| `tax_ids` | `RESTRICTED_STATUTORY_IDENTIFIER` | Tenant-isolated SQL | Mask middle characters (`27AAB****1ZM`) | 2,920 days (8 yr) | **No** (tax compliance) | Synthetic replacement only |
| `email_contact_metadata` | `CONFIDENTIAL_PII` | Tenant-isolated SQL | Mask local-part (`b***@supplier.com`) | 1,095 days (3 yr) | Yes (after retention) | **Strictly Prohibited** |
| `reviewer_notes` | `CONFIDENTIAL_INTERNAL_CONTROL` | Append-only SQL | Scrub embedded bank/email strings | 2,555 days | **No** (SOX/ICFR control record) | Redacted only with opt-in |
| `audit_records` | `IMMUTABLE_COMPLIANCE_LEDGER` | Keyed HMAC-SHA256 + DB immutability triggers | Redacted references only | 3,650 days (10 yr) | **Never** (`MANDATORY_RETENTION_PROTECTED`) | Not Applicable |
| `ml_evaluation_datasets` | `GOVERNED_ANALYTICS_DATASET` | Versioned manifest + SHA-256 provenance | De-identified & PII-redacted | 730 days (2 yr) | Yes | Opt-in governed only |

---

## 2. Legal Hold & Deletion Safety Rules

1. **Active Legal Hold Precedence (`409 LEGAL_HOLD_ACTIVE`):** Any active legal hold placed via `POST /api/v1/privacy/legal-holds` immediately blocks archival deletion for that entity.
2. **Mandatory Audit & Financial Record Preservation (`409 MANDATORY_RETENTION_PROTECTED`):** Deleting or expiring an uploaded document **never** deletes `audit_records`, `bank_remittance_details` lineage references, `tax_ids` statutory summaries, or `reviewer_notes`.
3. **Training Data Governance Gate (`403 TRAINING_CONSENT_AND_REDACTION_REQUIRED`):** Customer documents and human corrections cannot be exported into training corpora unless `customer_opt_in_verified=true`, `pii_and_bank_redacted=true`, and a valid `governance_ticket_id` is supplied.
