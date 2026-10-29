# Disaster Recovery, Backup/Restore Verification & Incident Response Runbook (Prompts 7 & 14)

## 1. Recovery Objectives & Measured Restore Drill Evidence

Executed via `python3 scripts/run_dr_backup_restore_drill.py` (`reports/dr_restore_drill_report.json`):

- **Target RTO**: `<= 900 seconds` (15 minutes) | **Measured Drill RTO**: **`2.639 seconds`** (`272.26 ms` hot backup + authenticated encryption + disposable-DB restore + integrity verification)
- **Target RPO**: `0 seconds` for transactions in snapshot; `<= 15 minutes` scheduled encrypted backup cadence
- **Encryption Envelope**: `aead-openssl-aes256cbc-hmacsha256-v1` (PBKDF2 200,000 iterations + Encrypt-then-MAC HMAC-SHA256)
- **Post-Restore Checks Verified (`PASSED`)**:
  - `ciphertext_hmac_verified: true`
  - `plaintext_sha256_verified: true`
  - `sqlite_integrity_check: "ok"`
  - `foreign_key_violations: 0`
  - `row_counts_consistent: true` (across all 26 canonical ERP tables: `invoices`, `purchase_orders`, `goods_receipt_notes`, `invoice_reconciliations`, `review_case_approvals`, `audit_events`, etc.)
  - `audit_hash_chain_valid: true` (`35` hash-chained events verified post-restore)
- **External Off-Site Immutable Bucket Status**: **`BLOCKED`** until customer cloud KMS + WORM (`S3 Object Lock`) credentials are provisioned.

---

## 2. Step-by-Step Database & Audit Chain Restore Procedure

1. **Freeze Outbound & Worker Traffic**: Trigger emergency ERP halt in `security_auditability` (`POST /api/v1/security/emergency-controls`) and stop worker processes.
2. **Run Encrypted Restore Drill / Verification First**:
   ```bash
   python3 scripts/run_dr_backup_restore_drill.py
   ```
3. **Verify Ciphertext HMAC & Plaintext SHA-256**: `BackupLifecycleService.verify_backup_restore()` decrypts into an isolated disposable file first; **never** overwrite the active DB file before `sqlite_integrity_check == "ok"` and `verify_audit_chain().valid == True`.
4. **Promote Verified Restored Database & Run Readiness Gate**:
   - Swap restored DB file atomically, verify `alembic current` matches `head`, and check `GET /api/v1/health/ready` (`200`) + `POST /api/v1/reconciliation/erp-ledger` to detect any `MISSING_IN_ERP` or `DUPLICATE_IN_ERP` gap since snapshot timestamp.

---

## 3. Clean Release Archive Hygiene (`scripts/build_clean_archive.py`)

Verified in `reports/clean_archive_verification.json`:
- `clean_hygiene_passed: true` (`713` clean source/doc files included; `1,548` runtime `.db`, `-wal`, `-shm`, `.enc`, vault, backup, and cache files excluded; `0` violations).

---

## 4. Eight-Scenario Security & Operational Incident Response Playbooks

1. **Suspected Credential or OIDC Token Compromise**: Revoke active sessions (`POST /api/v1/auth/sessions/revoke-all`), rotate `SEC_JWT_SIGNING_SECRET` & service credentials, audit `login_events` and `audit_events` by `actor_id`.
2. **Audit Log Tamper Alert (`AUDIT_CHAIN_INTEGRITY_FAILURE`)**: System auto-opens a `CRITICAL` `SecurityIncident`; isolate host, compare DB against latest signed external anchor receipt (`storage/audit_anchors/anchor_*.json`), restore from last verified encrypted backup.
3. **Fraudulent Vendor Bank Account Change Attempt**: Keep vendor on hold; inspect AES-256-GCM keyring audit events (`vendor.change_bank_details`), require dual out-of-band supplier callback verification before lifting hold.
4. **Ambiguous ERP Timeout / Suspected Duplicate ERP Posting**: Keep `ERP_OUTBOUND_WRITES_ENABLED=false`; run `POST /api/v1/reconciliation/erp-ledger` to classify `DUPLICATE_IN_ERP` vs `MISSING_IN_ERP` before replaying any DLQ job.
5. **Poison Document / Malicious Attachment Upload**: Quarantine notification in `EmailWebhookSecurityVerifier.quarantined_messages` / `outbox_queue_jobs` (`status='dead_letter'`); inspect SHA-256 and MIME headers without executing embedded objects.
6. **Severe Model / OCR Drift Spike (`PSI >= 0.25`)**: Do **not** auto-retrain; route low-confidence extractions to `human_review` (`:8008`), inspect vendor template changes in `testing_monitoring` (`:8011`).
7. **Unapproved Financial Policy / Tolerance Misconfiguration**: Roll back `policy_version` to last approved `FIN-POL-*` version; re-evaluate affected `stale_requires_recalc` invoices.
8. **Database Corruption or Node Failure**: Execute Section 2 restore procedure using latest verified `.sqlite.enc` / PostgreSQL KMS backup and verify `/api/v1/health/ready`.
