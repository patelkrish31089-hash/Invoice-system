# Route-by-Route Authorization & Governance Matrix (`docs/ROUTE_AUTHORIZATION_MATRIX.md`)

**Authoritative Machine-Readable Endpoint:** `GET /api/v1/iam/route-permission-matrix` (`security_auditability`).  
**Tenant Isolation Rule:** Backend extracts `tenant_id` exclusively from verified session/JWT/API-key principal; any contradicting client-supplied `tenant_id` fails closed with `403 TENANT_SPOOFING_OR_ISOLATION_VIOLATION`.

---

| Service | Route | Required Permission(s) | Allowed Roles | Financial State? | Step-Up MFA / Dual Approval | Audit Event |
|---|---|---|---|---|---|---|
| `document_ingestion` | `POST /api/v1/documents/upload` | `invoice.upload` | `invoice_processor`, `finance_reviewer`, `ap_manager` | No | No | `document.uploaded` |
| `document_ingestion` | `POST /api/v1/documents/inspect-quality` | `invoice.upload` | `invoice_processor`, `finance_reviewer`, `ap_manager` | No | No | `document.quality_inspected` |
| `intelligent_extraction` | `POST /api/v1/invoices/{invoice_id}/review` | `invoice.correct_extraction` | `invoice_processor`, `finance_reviewer`, `ap_manager` | **Yes** | Material edits invalidate downstream approvals | `extraction.corrected` |
| `three_way_matching` | `POST /api/v1/matching/financial-policies/{ver}/approve` | `matching.override` | `finance_approver`, `finance_controller` | **Yes** | **Yes (`author != approver` SoD)** | `financial_policy.approved` |
| `approval_workflow` | `POST /api/v1/lifecycle/invoices/{id}/transition` | `workflow:intake` + state RBAC | `ap_reviewer`, `ap_manager`, `finance_controller` | **Yes** | **Yes (`APPROVED`/`COMPLETED` SoD & hold gate)** | `LIFECYCLE_STATE_TRANSITIONED` |
| `approval_workflow` | `POST /api/v1/lifecycle/invoices/{id}/reprocess` | `workflow:read` + manager/reviewer role | `ap_reviewer`, `ap_manager`, `finance_controller` | **Yes** | Invalidates prior approval on material change | `LIFECYCLE_CHECKPOINT_REPROCESSED` |
| `security_auditability` | `POST /api/v1/lineage/invoices/{id}` | `invoice.read` | `invoice_processor`, `finance_reviewer`, `finance_approver`, `auditor`, `security_admin` | No | No (sensitive fields auto-redacted) | `lineage.recorded` |
| `security_auditability` | `GET /api/v1/lineage/invoices/{id}` | `audit.read` or `invoice.read` | `auditor`, `security_admin`, `finance_approver`, `fraud_investigator` | No | No | `lineage.inspected` |
| `security_auditability` | `POST /api/v1/governance/overrides` | Domain override perm (`matching.override`, `duplicate.review`, `fraud.resolve`, `invoice.correct_extraction`, `invoice.approve`) | `finance_reviewer`, `finance_approver`, `fraud_investigator` | **Yes** | **Yes (High-impact requires independent approver)** | `governance.override.requested` |
| `security_auditability` | `POST /api/v1/governance/overrides/{id}/approve` | Domain override perm | `finance_approver`, `fraud_investigator`, `security_admin` | **Yes** | **Yes (`requester != approver` SoD)** | `governance.override.approved` |
| `security_auditability` | `DELETE /api/v1/governance/overrides/{id}` | **DENIED (`403`)** | None (Append-only ledger) | No | Fail-closed | `governance.override.delete_attempt` |
| `security_auditability` | `POST /api/v1/privacy/redacted-export` | `audit.export` | `security_admin`, `auditor` | No | **Yes** | `privacy.redacted_export` |
| `security_auditability` | `POST /api/v1/privacy/retention/evaluate-deletion` | `invoice.delete_or_archive` | `finance_approver`, `security_admin` | No | **Yes (Legal-hold & mandatory-retention enforced)** | `privacy.deletion_evaluated` |
| `approval_workflow` | `POST /api/v1/payment-batches/{id}/execute-bank-payment` | `workflow:payment:release` | **BLOCKED BY POLICY (`403 PAYMENT_EXECUTION_DISABLED_BY_POLICY`)** | **Yes** | Excluded from Non-ERP scope | `payment.blocked` |
| `erp_integration` | `POST /api/v1/erp/sync/outbound/invoices/{id}` | `erp.write` | **DEFAULT DISABLED (`ERP_OUTBOUND_WRITES_ENABLED=false`)** | **Yes** | Excluded from Non-ERP scope | `erp.write.blocked` |
