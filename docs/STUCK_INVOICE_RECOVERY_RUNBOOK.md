# Stuck-Invoice & Exception Recovery Runbook (`docs/STUCK_INVOICE_RECOVERY_RUNBOOK.md`)

**Scope:** Non-ERP Canonical 22-State Invoice Lifecycle (`approval_workflow/app/services/lifecycle_state_machine.py`).  
**ERP & Payment Boundary:** `ERP_OUTBOUND_WRITES_ENABLED=false` and `PAYMENT_EXECUTION_ENABLED=false` remain strictly preserved. Terminal non-ERP state is `COMPLETED` (`completed_non_erp`).

---

## 1. Canonical 22-State Model & Legacy Mapping

| Canonical State | Legacy Workflow Status | Category | Terminal? |
|---|---|---|---|
| `RECEIVED` | `received` | Intake | No |
| `VALIDATING_DOCUMENT` | `validating_document` | Intake Quality | No |
| `EXTRACTION_PENDING` | `extraction_pending` | OCR / Extraction | No |
| `EXTRACTION_IN_PROGRESS` | `extraction_in_progress` | OCR / Extraction | No |
| `EXTRACTION_REVIEW_REQUIRED` | `pending_extraction_review` | HITL Review | No |
| `EXTRACTION_COMPLETED` | `extraction_completed` | OCR / Extraction | No |
| `VALIDATION_PENDING` | `validation_pending` | Financial Math / Schema | No |
| `VALIDATION_FAILED` | `held_by_controls` | Exception Hold | No |
| `MATCHING_PENDING` | `matching_pending` | 3-Way Match | No |
| `MATCHING_COMPLETED` | `matched` | 3-Way Match | No |
| `MATCH_EXCEPTION` | `held_by_controls` | Exception Hold | No |
| `FRAUD_REVIEW_REQUIRED` | `held_by_controls` | Risk Hold | No |
| `DUPLICATE_REVIEW_REQUIRED` | `held_by_controls` | Risk Hold | No |
| `HUMAN_REVIEW_REQUIRED` | `in_human_review` | HITL Workbench | No |
| `APPROVAL_PENDING` | `pending_approval` | Authority Matrix | No |
| `APPROVED` | `approved` | Financially Approved | No |
| `REJECTED` | `rejected` | Closed Rejected | No (reprocessable) |
| `ON_HOLD` | `on_hold` | Administrative Hold | No |
| `CANCELLED` | `cancelled` | Voided | **Yes** |
| `PROCESSING_FAILED` | `processing_failed` | Infrastructure Error | No |
| `RETRY_PENDING` | `retry_pending` | Recovery Queue | No |
| `COMPLETED` | `completed_non_erp` | Final Non-ERP Ready | **Yes** |

---

## 2. Diagnostic Procedure for Stuck Invoices

1. **Inspect Current Canonical State, Version & Open Exceptions:**
   ```bash
   curl -s -H "X-API-Key: <MANAGER_API_KEY>" \
     http://127.0.0.1:8006/api/v1/lifecycle/invoices/<INVOICE_ID> | jq
   ```
   Check `canonical_state`, `version`, `attempt_number`, `open_exception_count`, `active_holds`, and `checkpoint_stage`.

2. **Check Durable Outbox Worker Queue for Stuck Leases (`document_ingestion`):**
   - Inspect stuck worker leases exceeding `lease_seconds` via `DurableOutboxWorkerEngine.detect_stuck_jobs()` or dead-letter queue (`status='DEAD_LETTER'`).

3. **Resolve or Waive Blocking Exceptions Before Reprocessing / Approval:**
   - Every open exception (`DOCUMENT_UNREADABLE`, `OCR_LOW_CONFIDENCE`, `SCHEMA_VALIDATION_ERROR`, `FINANCIAL_MATH_MISMATCH`, `PO_NOT_FOUND`, `RECEIPT_SHORTFALL`, `PRICE_VARIANCE`, `TAX_MISMATCH`, `DUPLICATE_SUSPECTED`, `FRAUD_HIGH_RISK`, `APPROVAL_SLA_EXCEEDED`, `DEPENDENCY_TIMEOUT`) **must** be explicitly closed with a `closure_reason` before transitioning to `APPROVED` or `COMPLETED`:
   ```bash
   curl -X POST -H "X-API-Key: <MANAGER_API_KEY>" -H "Content-Type: application/json" \
     http://127.0.0.1:8006/api/v1/lifecycle/invoices/<INVOICE_ID>/exceptions/<EXCEPTION_ID>/resolve \
     -d '{"closure_reason": "GRN-8842 posted and verified by warehouse lead", "expected_version": 3, "resolution_status": "RESOLVED"}'
   ```

4. **Restart Safely from Last Durable Checkpoint (`reprocess`):**
   - Safe checkpoints: `VALIDATING_DOCUMENT`, `EXTRACTION_PENDING`, `VALIDATION_PENDING`, `MATCHING_PENDING`, `HUMAN_REVIEW_REQUIRED`.
   - Reprocessing increments `attempt_number` without deleting prior revisions, transition rows, or audit events.
   - **Material Financial Change Rule:** If `updated_financial_snapshot` alters `vendor_id`, `currency`, `subtotal`, `tax_amount`, `grand_total`, or `is_credit_note` after an invoice was previously approved, `prior_approval_invalidated` is automatically set to `true` and `approved_by`/`approved_at` are cleared so the invoice cannot reach `COMPLETED` without fresh independent approval.
   ```bash
   curl -X POST -H "X-API-Key: <MANAGER_API_KEY>" -H "Content-Type: application/json" \
     http://127.0.0.1:8006/api/v1/lifecycle/invoices/<INVOICE_ID>/reprocess \
     -d '{
       "checkpoint_state": "VALIDATION_PENDING",
       "expected_version": 4,
       "reason": "Corrected OCR tax line and restarting math + 3-way match validation"
     }'
   ```

5. **Verify Audit Chain Integrity Post-Recovery:**
   ```bash
   curl -s -H "X-API-Key: <AUDITOR_API_KEY>" http://127.0.0.1:8006/api/v1/audit/verify | jq
   ```
