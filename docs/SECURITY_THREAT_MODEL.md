# Security Architecture & STRIDE Threat Model

## 1. Identity, OIDC + PKCE & Nine Least-Privilege Enterprise Roles (Prompt 3)

- **Authentication**: Supports local Argon2id + TOTP MFA (`security_auditability/app/services/authentication_service.py`) and standards-compliant **OIDC Authorization Code + PKCE (`S256`)** ID-token exchange (`POST /api/v1/auth/oidc/exchange` in `oidc_and_anchor_service.py`), validating `code_verifier` against `code_challenge`, signature, `iss`, `aud`, `exp`, `iat`, and `nonce`. Live external corporate IdP integration is truthfully marked `BLOCKED` until customer OIDC issuer credentials are supplied.
- **Nine Canonical Enterprise Roles (`/api/v1/iam/enterprise-roles`)**:
  1. `ap_operator` — Uploads invoices & corrects OCR fields; **cannot** approve invoices or release payments.
  2. `invoice_reviewer` — Dispositions matching/duplicate exceptions & routes review cases; **cannot** approve final payouts or edit bank details.
  3. `finance_approver` — Approves eligible invoices within monetary authority limits; blocked by SoD if same user uploaded/edited the invoice.
  4. `procurement_user` — Inspects POs, GRNs, vendors, and matching runs; zero AP approval or audit-mutation rights.
  5. `fraud_analyst` — Investigates fraud/relationship alerts; **cannot** edit invoice amounts or approve payments.
  6. `erp_integration_admin` — Manages ERP connector configs, inbound syncs, and DLQ triage; **cannot** approve invoices.
  7. `security_auditor` — Inspects security incidents, role matrices, and cryptographic audit chains; zero financial approval rights.
  8. `system_admin` — Manages user accounts; **explicitly blocked** from approving invoices, modifying bank details, or editing audit logs.
  9. `read_only_auditor` — Strictly read-only access to authorized records and audit trails.

---

## 2. STRIDE Threat Matrix & Implemented Mitigations

| Threat Category | Attack Scenario | Concrete Mitigation Implemented | Verification Test |
|---|---|---|---|
| **Spoofing** | Forged OIDC token, PKCE interception, or spoofed supplier invoice email | RFC 7636 PKCE `S256` challenge check, JWT `iss`/`aud`/`exp`/`nonce` validation, HMAC-SHA256 webhook signature + 300s replay window + SPF/DKIM/DMARC quarantine | `test_oidc_pkce_s256_valid_and_negative_security_cases`, `test_prompt8_email_webhook_signature_replay_dedup_and_spoof_quarantine` |
| **Tampering** | Insider or DBA modifies historical `audit_events` or stale `review_case` concurrently | SQLite/PostgreSQL append-only BEFORE UPDATE/DELETE triggers + externalized Keyed-HMAC (`SEC_AUDIT_HMAC_KEYRING_JSON`) + signed digest anchors (`export_signed_audit_digest_anchor`) + HTTP `409` optimistic locking | `test_06_tamper_evident_keyed_audit_key_rotation_redaction_and_tamper_detection`, `test_19_prompt1b_*` |
| **Repudiation** | Approver denies overriding a 3-way match or fraud alert | Mandatory structured reason codes + actor ID + role + `policy_version` + `X-Correlation-ID` persisted in immutable audit chain | `test_13_matching_override_sod_and_audit_export_permission_and_csv_redaction` |
| **Information Disclosure** | Credentials in error messages, bank details in logs, IDOR across tenants | `sanitize_error_message()` URL/query credential redactor, AES-256-GCM keyring encryption for vendor bank details, recursive log redactor, mandatory `tenant_id`/`company_id` query predicates | `test_one_required_unhealthy_blocks_readiness_with_503`, `test_05_vendor_bank_aes256_gcm_*` |
| **Denial of Service** | Malicious PDF/image upload, poison queue message, or SSRF against metadata IPs | Magic-byte MIME verification, PDF JS/Launch action blocker, max upload size, SSRF RFC1918/link-local blocker, poison-message DLQ isolation (`max_attempts`) | `test_07_secure_file_uploads_*`, `test_prompt9_all_12_outbox_*` |
| **Elevation of Privilege** | Admin self-approving edited invoice, or prompt injection in OCR text attempting auto-approval | Toxic SoD pair blocker (`SOD_EDIT_AND_APPROVE`), `material_editor_id != approved_for_erp_by`, untrusted OCR sandboxing (`can_override_deterministic_controls=False`) | `test_03_rbac_abac_idor_*`, `test_prompt16_contract_clause_guardrails_*` |

---

## 3. Honest Audit Immutability Boundary (Prompt 17)

- **What IS Guaranteed**: Application API mutations (`PUT`/`PATCH`/`DELETE /audit/events/*`) are hard-blocked (`403`) and raise a `CRITICAL` security alert; database triggers block ordinary SQL `UPDATE`/`DELETE`; any out-of-band file modification breaks the keyed-HMAC chain (`verify_audit_chain`) unless the attacker also compromises the separate `SEC_AUDIT_HMAC_KEYRING_JSON` secret; periodic signed anchor receipts (`export_signed_audit_digest_anchor`) provide off-database cryptographic digests.
- **What IS NOT Claimed**: We do **not** claim blockchain immutability. Streaming anchor digests to an external cloud WORM bucket (`AWS S3 Object Lock` Compliance Mode) is truthfully marked `BLOCKED` until cloud WORM credentials are provisioned.
