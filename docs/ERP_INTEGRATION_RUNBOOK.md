# ERP Integration & Reconciliation Runbook (Prompts 2 & 11)

## 1. Adapter Architecture & Strict Simulator Separation

Implemented under `erp_integration/app/adapters/`:
1. **`sap_s4hana.py` (`sap_s4hana_odata`)**: Real OAuth2 Client Credentials + SAP OData `X-CSRF-Token: Fetch` protocol client for `API_BUSINESS_PARTNER`, `API_PURCHASEORDER_PROCESS_SRV`, `API_MATERIAL_DOCUMENT_SRV`, and `API_SUPPLIERINVOICE_PROCESS_SRV`.
2. **`oracle_fusion.py` (`oracle_fusion_rest`)**: Oracle Fusion Cloud Procurement/Payables REST adapter (`/fscmRestApi/resources/11.13.18.05/{suppliers,purchaseOrders,receipts,invoices}`).
3. **`generic_rest.py` (`generic_rest_oauth2`)**: Configurable OAuth2 REST ERP adapter with cursor pagination and idempotency headers.
4. **`test_simulator.py` (`test_only_sandbox_simulator`)**: Explicitly flagged `is_test_only=True`. Blocked automatically in `ENVIRONMENT=production` when `ERP_REQUIRE_REAL_PROVIDER_IN_PROD=true`. **Never** reported as live ERP verification.

---

## 2. Ten-State ERP Verification Status (`GET /api/v1/erp/verification-status`)

| Verification State | Current Status | Notes |
|---|---|---|
| `NOT_CONFIGURED` | `false` (Connector schemas registered) | SAP/Oracle connector rows seeded without live secrets |
| `CONFIG_VALIDATED` | `true` | URL allowlists, TLS enforcement & schema contracts validated |
| `AUTH_VERIFIED` | `false` (`BLOCKED`) | Requires live customer SAP/Oracle OAuth2 sandbox credentials |
| `MASTER_DATA_SYNC_VERIFIED` | `false` (`BLOCKED` live; `TESTED` via `MockTransport` & simulator) | Cursor pagination & quarantine tested |
| `PO_SYNC_VERIFIED` | `false` (`BLOCKED` live; `TESTED` via `MockTransport` & simulator) | Stale-reconciliation invalidation on PO mutation tested |
| `GRN_SYNC_VERIFIED` | `false` (`BLOCKED` live; `TESTED` via `MockTransport` & simulator) | SAP/Oracle GRN line normalization tested |
| `RECONCILIATION_VERIFIED` | `true` (`TESTED`) | 3-way + Invoice-to-ERP ledger discrepancy engine verified |
| `OUTBOUND_DRY_RUN_VERIFIED` | `true` (`TESTED`) | Simulator dry-run, timeout read-back saga, and concurrent lock verified |
| `SANDBOX_POSTING_VERIFIED` | `false` (`BLOCKED`) | Never claimed without a real external ERP sandbox |
| `PRODUCTION_BLOCKED` | `true` | `ERP_OUTBOUND_WRITES_ENABLED=false` by default |

---

## 3. Duplicate-Safe Outbound Saga & Concurrency Protocol

1. **Disabled by Default**: Both global `ERP_OUTBOUND_WRITES_ENABLED` and per-connection `outbound_writes_enabled` default to `false`.
2. **Pre-Flight Readiness & SoD**: Verifies `human_review_status == 'approved_for_erp'`, `material_editor_id != approved_for_erp_by`, non-stale 3-way match, zero open `DataConflict` rows, and cleared duplicate/fraud gates.
3. **Atomic Concurrency Claim**: Deterministic `idempotency_key = sha256(connection_id:invoice_id:version:action)` persisted in `sync_jobs` (`UNIQUE`) + conditional `UPDATE sync_jobs SET status='running' WHERE status NOT IN ('running','completed','reconciled_after_timeout')`. Concurrent workers receive HTTP `409 CONCURRENT_ERP_POSTING_CONFLICT` or idempotent completion — **never** duplicate ERP postings.
4. **Ambiguous Timeout Read-Back Saga**: Before any retry (`attempt_count > 1`), `OutboundErpSyncService` calls `adapter.fetch_document_status(idempotency_key=...)` to adopt any already-committed ERP document instead of re-POSTing.

---

## 4. Invoice-to-ERP Discrepancy Reconciliation (`POST /api/v1/reconciliation/erp-ledger`)

Compares local `invoices` against ERP ledger snapshots and records auditable rows in `erp_posting_reconciliation_records` (Alembic revision `0003_erp_posting_reconciliation`):
- `RECONCILED_OK`: Exact 1:1 match on ERP document ID / `(erp_vendor_id, invoice_number)`, currency, and `Decimal` grand total.
- `MISSING_IN_ERP`: Locally marked posted/parked/mapped, absent from ERP ledger.
- `DUPLICATE_IN_ERP`: Multiple ERP document IDs exist for the same supplier invoice.
- `AMOUNT_MISMATCH`: Local vs ERP currency or `Decimal` total diverges.
- `STALE_SYNC`: Local `erp_sync_status` stuck in `outbound_queued`/`pending`/`in_flight` beyond SLA threshold.
