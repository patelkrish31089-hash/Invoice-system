# Model, OCR, Duplicate & Fraud Evaluation Report (Prompts 5, 6, 10 & 16)

## 1. Strict Truthfulness & Dataset Provenance Statement

- **Synthetic / Controlled Fixture Benchmark Status**: **`EVALUATED`** (`testing_monitoring/storage/evaluation_reports/latest_evaluation_bundle.json` + unit/regression suites).
- **Real-World Production Invoice Corpus Evaluation Status**: **`BLOCKED`**. No authorized customer corpus of real multi-vendor invoices, POs, GRNs, or adjudicated fraud cases is present in this workspace. Per `validate_evaluation_dataset_governance()` (`testing_monitoring/app/evaluation/splitters.py`), attempting to claim `claim_real_world_accuracy=True` on synthetic fixtures raises `SYNTHETIC_REAL_WORLD_CLAIM_BLOCKED`.

---

## 2. Measured Controlled Benchmark Metrics (Synthetic Fixture Suite — NOT Real-World Accuracy)

| Subsystem | Dataset Provenance & Sample Size | Primary Metrics (Controlled Synthetic Suite) | Split & Leakage Governance | Real-Data Status |
|---|---|---|---|---|
| **M1/M2 OCR & Extraction** | Synthetic rendered PDFs (`N=6` docs / `48` ground-truth fields + `13`-category extraction suite) | `field_exact_match_accuracy = 1.0000`, `field_f1 = 0.9600`, `mean_cer = 0.0112`, `mean_wer = 0.0333` | Supplier-grouped deterministic split | `BLOCKED` |
| **M3 Three-Way Matching** | Controlled 16-scenario PO/GRN/Invoice benchmark (`N=16`) | `decision_accuracy = 1.0000`, `match_f1 = 1.0000`, `false_match_rate = 0.0000` | Deterministic golden scenarios | `BLOCKED` |
| **M4 Duplicate Detection** | Controlled exact, near-duplicate, credit-note & recurring schedule benchmark (`N=20`) | `precision = 1.0000`, `recall = 1.0000`, `legitimate_recurring_false_positive_rate = 0.0000` | Cluster-grouped (`duplicate_cluster_id`) zero-leakage split | `BLOCKED` |
| **M5 Fraud & Risk Scoring** | Synthetic multi-signal + Isolation Forest cohort (`N=120` total / `110` eligible) | `pr_auc = 0.9877`, `precision = 0.9200`, `recall = 0.9583`, `f1 = 0.9388`, `brier_calibration_score = 0.0494` | Chronological + supplier-grouped split; thresholds selected strictly on `val` (`select_threshold_on_validation_only`) | `BLOCKED` |

Non-parametric 95% bootstrap confidence intervals (`n_resamples=500`) are computed via `compute_bootstrap_ci_95()` in `testing_monitoring/app/evaluation/splitters.py`.

---

## 3. Eight Separated Risk Signals & Non-Self-Activating Governance (Prompt 6)

`classify_eight_risk_signals()` strictly distinguishes:
1. `exact_duplicate`
2. `near_duplicate`
3. `legitimate_recurring_invoice` (suppresses false near-duplicate flags when contract schedule + distinct billing period match)
4. `split_invoice_threshold_evasion`
5. `bank_account_change_risk`
6. `vendor_impersonation_shell_supplier`
7. `abnormal_unit_price_qty_tax_pattern`
8. `statistical_anomaly_unknown_cause` (routes to `anomaly_advisory_review_only`; **never** auto-labels `confirmed_fraud`)

**Model Promotion & Drift Governance**:
- Candidate models use JSON + HMAC-SHA256 safe serialization (`safe_artifacts.py` — **zero `pickle`/`joblib` execution**).
- Drift detection (`PSI >= 0.20`) opens deduplicated alerts with cooldown windows and **never** triggers autonomous retraining or self-promotion. Promoting a candidate model requires an independent `model_approver` role (SoD enforced against trainer identity).

---

## 4. Conditional ML/LLM Scope Decisions (Prompts 10 & 16)

- **`LayoutLMv3` Fine-Tuned Token Classifier (`Prompt 10`)**: **`NOT_IMPLEMENTED` (Deferred)** / **`BLOCKED`** on real token-annotated training invoices. The active spatial/table/rule ensemble delivers sub-25ms latency within the 2 GB RAM budget without fabricated model weights.
- **Guardrailed Contract Clause Comparator (`Prompt 16`)**: **`TESTED`** (`evaluate_contract_terms_with_guardrails` in `intelligent_extraction/app/extractors/llm_assisted.py`). Detects adversarial prompt injection (`IGNORE ALL PREVIOUS INSTRUCTIONS`, bank-override strings), enforces `can_override_deterministic_controls = False`, and keeps external commercial LLM APIs disabled by default (`ALLOW_LLM_EXTRACTION=false`).
