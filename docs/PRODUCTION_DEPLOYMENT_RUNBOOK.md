# Production & Staging Deployment Runbook

## 1. Pre-Flight Environment & Secret Manager Checklist

1. **Provision Secrets Outside VCS** (see sanitized `.env.example`):
   - `SEC_JWT_SIGNING_SECRET` (>= 32 bytes random secret; dev secret fails closed in `ENVIRONMENT=production`)
   - `SEC_AUDIT_HMAC_KEYRING_JSON` (separate cryptographic key from DB credentials)
   - `SEC_AES_GCM_KEYRING_JSON` (32-byte base64url AES-256-GCM key for supplier bank details)
   - `ERP_MASTER_ENCRYPTION_KEY` (KMS-backed master key for connector secret vault & DB backups)
2. **Enforce Safe Production Defaults**:
   - `ERP_OUTBOUND_WRITES_ENABLED=false` (until ERP sandbox + Finance Controller sign-off)
   - `ERP_REQUIRE_REAL_PROVIDER_IN_PROD=true` (blocks `test_only_sandbox_simulator` in production)
   - `PAYMENT_EXECUTION_ENABLED=false` (hard-disables live bank disbursement)
   - `ALLOW_CLOUD_OCR=false`, `ALLOW_LLM_EXTRACTION=false` (unless explicitly authorized by InfoSec/Privacy)

---

## 2. Database Migration Execution & Rollback

Run Alembic migrations **before** starting application workers:

```bash
cd security_auditability && alembic upgrade head
cd ../testing_monitoring && alembic upgrade head
cd ../erp_integration && alembic upgrade head
```

**Verified Clean Rollback Procedure**:
- Schema rollback: `alembic downgrade -1` (tested cleanly across `0003_erp_posting_reconciliation -> 0002 -> 0001 -> base`).
- Code rollback: `git checkout baseline-pre-upgrade` (`69eaa8cb27fd5aa10b4221b11a0dc43470bdd57d`).
- Data rollback: Restore latest verified `.sqlite.enc` / PostgreSQL snapshot via `scripts/run_dr_backup_restore_drill.py`.

---

## 3. Startup, Liveness & Readiness Gates

1. **Run Full Automated Release Gate**:
   ```bash
   python3 scripts/run_all_tests.py
   ```
   Confirm `reports/test_summary.json` reports `"overall_status": "PASSED"` (`12/12` suites, `229/229` tests, `0` critical/high SAST/secret findings).
2. **Start Services (0.0.0.0 Binding)**:
   - Low-memory single-host / staging: `python3 unified_portal/run_cow_cluster.py` (`:8000`, `:8002`–`:8010`), `uvicorn app.main:app --host 0.0.0.0 --port 8011` (`testing_monitoring`), and `uvicorn app.main:app --host 0.0.0.0 --port 8080` (`unified_portal`).
   - Multi-container deployment: `docker compose up -d`.
3. **Verify Health Probes**:
   - Liveness: `GET /api/v1/health/live` -> HTTP `200` (`{"status": "alive"}`)
   - Readiness: `GET /api/v1/health/ready` -> HTTP `200` (`"readiness_status": "ready"`, `"healthy_services_count": 11`, `"total_services_count": 11`; returns HTTP `503` if any required service is down or in startup grace period)
   - Production Blocker Visibility: `GET /api/v1/platform/production-acceptance` -> verify external blockers and `payment_execution_enabled: false`.
