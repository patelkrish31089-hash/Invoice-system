# Non-ERP Prioritized Implementation Plan (`docs/NON_ERP_IMPLEMENTATION_PLAN.md`)

Following Section 15 execution order, all modifications extend existing microservices in place without creating duplicate services or expanding ERP/payment scope:

1. **Phase 1 — Invoice Lifecycle & Exception Management (`approval_workflow`, Prompt 2)**:
   - Implement `approval_workflow/app/services/lifecycle_state_machine.py` + ORM tables (`WorkflowLifecycleRecord`, `WorkflowLifecycleTransitionRecord`, `WorkflowExceptionRecord`) for the 22 canonical non-ERP states, legal transition matrix, optimistic locking (`409`), 12 classified exception queues, and checkpoint reprocessing with material-change approval invalidation.
   - Deliver `docs/STUCK_INVOICE_RECOVERY_RUNBOOK.md` and `approval_workflow/tests/test_invoice_lifecycle_and_exceptions.py`.
2. **Phase 2 — Financial Invariants, DB-Versioned Policies & GL Dimension Validation (`three_way_matching` & `approval_workflow`, Prompt 3)**:
   - Extend `three_way_matching/app/services/financial_policy_governance.py` with line/header discount & charge reconciliation, non-mutating invariant checks (`LINE_EXTENSION_MISMATCH`, `HEADER_SUBTOTAL_INVARIANT_MISMATCH`, `DECLARED_TOTAL_INVARIANT_MISMATCH`), and SQLite-persisted `GovernedFinancialPolicyStore` (`draft -> test_evaluated -> approved` with `author_id != approver_id`).
   - Extend `approval_workflow/app/services/gl_coding_engine.py` with configurable GL account, cost-center, tax-code, and balancing validation.
3. **Phase 3 — Authorization Matrix, 12-Point Lineage, Manual Overrides & Data Privacy (`security_auditability`, Prompts 4, 7 & 10)**:
   - Implement `security_auditability/app/services/lineage_override_privacy_service.py` + routes in `security_auditability/app/api/routes.py` for:
     - Route-by-route permission matrix (`GET /api/v1/iam/route-permission-matrix`) & `docs/ROUTE_AUTHORIZATION_MATRIX.md`.
     - 12-point per-invoice Decision Lineage chain (`POST/GET /api/v1/lineage/invoices/{invoice_id}`).
     - Append-only Governed Manual Override ledger (`POST /api/v1/governance/overrides`, independent approval & SoD).
     - 8-category Data Classification Inventory, Legal-Hold & Audit/Financial Retention Enforcer, Audited Redacted Export, and Training-Data Consent Gate (`docs/DATA_PRIVACY_AND_RETENTION_POLICY.md`).
4. **Phase 4 — Document Quality, Extraction Feedback & Fraud Alert Delivery Durability (`document_ingestion`, `intelligent_extraction`, `fraud_detection`, Prompts 5 & 6)**:
   - Add `document_ingestion/app/services/document_quality.py` + `POST /api/v1/documents/inspect-quality` (encrypted/corrupt PDF, blur, skew/rotation, DPI, empty pages, missing page sequence, invalid dimensions, decompression pixel cap).
   - Add opt-in privacy-redacted correction feedback exporter in `intelligent_extraction`.
   - Add durable fraud alert notification delivery tracking (`delivery_status`, `delivery_attempts`, `recommended_investigation_steps`, and disposition states `suspicious | false_positive | unresolved | confirmed_fraud`) in `fraud_detection`.
5. **Phase 5 — Durable Queue Backpressure/Heartbeat, Provisional SLOs, Load Benchmarks & Incident Drills (`document_ingestion`, `testing_monitoring`, `scripts/`, Prompts 8 & 9)**:
   - Upgrade `DurableOutboxWorkerEngine` with `priority`, `schema_version`, `max_queue_depth` backpressure, `heartbeat_lease`, `detect_stuck_jobs`, and `cancel_job`.
   - Add `testing_monitoring/app/observability/slo_and_capacity.py` (10 provisional SLOs + p50/p95/p99 load & concurrency benchmark + corrupted-backup / expired-key recovery drills).
6. **Phase 6 — Frontend/Backend Integration, Release Supply-Chain Tests, Feasibility & Final Acceptance (`unified_portal`, `scripts/`, `tests/`, `docs/`, Prompts 11, 12, 13 & 14)**:
   - Wire real interactive Lifecycle, Lineage, Manual Override, and Provisional SLO panels in `unified_portal`.
   - Enhance `scripts/run_all_tests.py` + `scripts/build_clean_archive.py` (supporting `.zip` and `.tar.gz`), add root `tests/test_release_packaging_and_contracts.py`, write `docs/OPTIONAL_AI_FEASIBILITY_REPORT.md`, and produce the independent `docs/NON_ERP_FINAL_ACCEPTANCE_REPORT.md`.
