# Architecture, Unified Single-System Topology & End-to-End Data Flow (`v3.0.0`)

## 1. Single Unified System Topology (`0.0.0.0:8000`)

The entire platform runs as **ONE unified FastAPI system** (`uvicorn app.main:app --host 0.0.0.0 --port 8000`) with **ONE unified web dashboard** (`app/ui.py` at `/` and `/dashboard`) and **in-process ASGI subsystem orchestration** (`app/runtime.py` `InProcessUnifiedSystemTransport`), while browser-facing UI code uses strictly relative `/api/v1/...` paths (never `localhost` or `127.0.0.1`):

| Unified Mount / Package | Module Path | Responsibility | Required for Readiness |
|---|---|---|---|
| `/` & `/api/v1/*` | `app/{main.py,ui.py,orchestrator.py,runtime.py}` | Single Unified System Dashboard, `/api/v1/health/{live,ready}`, 11-stage upload pipeline & Non-ERP governance controls | Edge & Orchestrator |
| `/api/modules/document_ingestion` | `app/modules/document_ingestion` | Untrusted file validation, `DocumentQualityInspector`, SHA-256 deduplication, PyMuPDF/Tesseract OCR, email quarantine, durable outbox | Required |
| `/api/modules/intelligent_extraction` | `app/modules/intelligent_extraction` | 12-stage spatial/table/rule invoice extraction, Indian GSTIN/HSN checksums, safe human corrections, prompt-injection guardrails | Required |
| `/api/modules/three_way_matching` | `app/modules/three_way_matching` | PO-GRN-Invoice line allocation, pure `Decimal` governed financial policies (`FIN-POL-*`), UOM/FX/tax tolerances | Required |
| `/api/modules/duplicate_detection` | `app/modules/duplicate_detection` | Exact SHA-256, fuzzy composite identity, cross-document & visual perceptual-hash tamper detection | Required |
| `/api/modules/fraud_detection` | `app/modules/fraud_detection` | Multi-detector + Isolation Forest scoring, XAI attributions, 8-signal separation, durable alert delivery & 4 dispositions | Required |
| `/api/modules/approval_workflow` | `app/modules/approval_workflow` | Canonical 22-state Non-ERP lifecycle, tiered SoD routing, GL dimension/balance validator, disabled payment execution gate | Required |
| `/api/modules/relationship_analysis` | `app/modules/relationship_analysis` | Supplier-employee shared bank/address/tax-ID & circular ring analysis (`NetworkX` active; parameterized `Neo4j` ready) | Optional (`degraded` if absent) |
| `/api/modules/human_review` | `app/modules/human_review` | HITL exception management, side-by-side bounding-box evidence APIs, atomic optimistic locking (`409`), dual-approval SoD | Required |
| `/api/modules/erp_integration` | `app/modules/erp_integration` | Preserved 23-table canonical ERP interface, discrepancy reconciliation & encrypted DR backups (`ERP_OUTBOUND_WRITES_ENABLED=false`) | Required |
| `/api/modules/security_auditability` | `app/modules/security_auditability` | Argon2id/MFA/OIDC+PKCE IAM, 9 canonical roles, route matrix, 12-stage lineage, manual overrides, privacy/retention, keyed-HMAC audit | Required |
| `/api/modules/testing_monitoring` | `app/modules/testing_monitoring` | Correlation tracing, Prometheus metrics, 10 provisional SLOs, PSI drift alerts, leakage-free evaluation harness, governed MRM | Optional (`degraded` if absent) |

---

## 2. Nine Strictly Independent Invoice Lifecycle Status Axes

Across `human_review`, `approval_workflow`, `erp_integration`, and the unified orchestrator (`app/orchestrator.py`), workflow states are **never conflated**:

1. `ingestion_extraction_status` (`uploaded` -> `extracted` -> `extraction_failed`)
2. `matching_status` (`unmatched` -> `matched` | `matched_within_tolerance` | `exception_hold` | `stale_requires_recalc`)
3. `duplicate_status` (`clear` | `suspected_duplicate` | `confirmed_duplicate` | `override_approved`)
4. `fraud_status` (`clear` | `anomaly_advisory_review_only` | `under_investigation` | `confirmed_fraud` | `cleared_by_investigator`)
5. `relationship_status` (`clear` | `conflict_review_required` | `disclosed_or_cleared`)
6. `human_review_status` (`not_required` | `pending_review` | `in_review` | `approved_for_erp` | `rejected`)
7. `approval_workflow_status` (`pending` | `held_by_controls` | `approved_ready_for_erp` | `scheduled_in_payment_batch`)
8. `erp_posting_status` (`unposted` | `erp_draft` | `erp_parked` | `erp_posted_verified` — **only updated after authoritative ERP status read-back**)
9. `payment_authorization_status` (`not_authorized` | `scheduled_for_erp` — **never `paid`; live payment execution is hard-disabled via `PAYMENT_EXECUTION_ENABLED=false`**)

---

## 3. Canonical 22-State Non-ERP Lifecycle & 12-Stage Decision Lineage

- **Canonical 22-State Non-ERP Lifecycle (`app/modules/approval_workflow/services/lifecycle_state_machine.py`):** Enforces legal state transitions (`RECEIVED` -> ... -> `COMPLETED`), conditional SQL optimistic locking (`409 STALE_LIFECYCLE_VERSION`), 12 classified exception queues (`DOCUMENT_UNREADABLE` through `DEPENDENCY_TIMEOUT`), and safe checkpoint reprocessing that increments `attempt_number`, preserves prior revisions/approvals, and automatically sets `prior_approval_invalidated=true` upon material financial change.
- **12-Stage Decision Lineage & Append-Only Overrides (`app/modules/security_auditability/services/lineage_override_privacy_service.py`):** Reconstructs end-to-end decision provenance using redacted references (never raw sensitive documents) and enforces maker-checker SoD (`403 OVERRIDE_SOD_VIOLATION`) and append-only immutability (`403 APPEND_ONLY_OVERRIDE_IMMUTABLE`) on manual overrides.
- **Strict Non-ERP & Non-Payment Scope Boundary:** Outbound ERP financial writes (`ERP_OUTBOUND_WRITES_ENABLED=false`) and live payment execution (`PAYMENT_EXECUTION_ENABLED=false`) remain preserved default-disabled without scope expansion.

---

## 4. Single-Process Memory & Concurrency Architecture

Instead of spawning 12 separate Python servers across 12 ports, `app/runtime.py` hosts all 11 headless domain FastAPI sub-apps inside one Python process (`0.0.0.0:8000`) and dispatches internal orchestrator calls over `InProcessUnifiedSystemTransport(httpx.BaseTransport)` (with async upload orchestration offloaded via `anyio.to_thread.run_sync`), keeping total memory footprint well within constrained 2 GB container limits while eliminating duplicate configs, Dockerfiles, and dashboards.
