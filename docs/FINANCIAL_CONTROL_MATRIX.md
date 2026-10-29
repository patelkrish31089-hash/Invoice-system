# Financial Control Matrix & Accounting Governance (Prompts 4 & 18)

## 1. Arithmetic, Currency, Tax & Tolerance Controls

| Control ID | Financial Domain | Technical Rule Implemented | Module / File | Test Evidence | Sign-Off Status |
|---|---|---|---|---|---|
| `FIN-01` | Pure `Decimal` Arithmetic | `float` inputs raise `ValueError`; all money, tax, FX, and tolerance math uses `decimal.Decimal` | `three_way_matching/app/services/financial_policy_governance.py`, `approval_workflow/app/services/workflow_service.py` | `test_float_inputs_prohibited_and_currency_minor_units_enforced` | Code: `TESTED` / Org Sign-off: `BLOCKED` |
| `FIN-02` | Currency Minor Units & Rounding | `JPY`/`KRW` = 0 decimals; `INR`/`USD`/`EUR`/`GBP` = 2 decimals; `KWD`/`BHD`/`OMR` = 3 decimals; explicit `ROUND_HALF_UP` / `ROUND_HALF_EVEN` | `financial_policy_governance.py` | `test_float_inputs_prohibited_and_currency_minor_units_enforced` | Code: `TESTED` / Org Sign-off: `BLOCKED` |
| `FIN-03` | Tax-Exclusive, Tax-Inclusive, GST/IGST, RCM & TDS | Intra-state `CGST+SGST` 50/50 split, inter-state `IGST`, reverse-charge zero supplier tax, withholding `TDS` net payable deduction | `financial_policy_governance.py`, `approval_workflow/app/services/gl_coding_engine.py` | `test_tax_inclusive_exclusive_tds_fx_*`, `test_stp_clean_invoice_double_entry_gl_and_tds_balance` | Code: `TESTED` / Org Sign-off: `BLOCKED` |
| `FIN-04` | UOM Normalization | Deterministic conversion (`KG->G`, `MT->G`, `L->ML`, `DOZ->EA`, `BOX10->EA`); incompatible UOM families (`KG->L`) rejected | `financial_policy_governance.py` | `test_uom_conversions_and_incompatible_family_rejection` | Code: `TESTED` |
| `FIN-05` | Multi-Currency FX Governance | Cross-currency PO vs Invoice never compares raw numbers; requires explicit `FxRatePolicy` & date basis (`invoice_date` / `po_date` / `receipt_date`) | `erp_integration/app/services/reconciliation_engine.py`, `financial_policy_governance.py` | `test_06_stale_reconciliation_po_mutation_conflict_and_fx_policy_enforcement` | Code: `TESTED` / Org Sign-off: `BLOCKED` |
| `FIN-06` | Credit-Note & Freight Caps | Credit notes require original invoice linkage and cannot exceed original invoice value; freight above policy cap raises `FREIGHT_CAP_EXCEEDED` | `financial_policy_governance.py` | `test_tax_inclusive_exclusive_tds_fx_freight_credit_note_and_unapproved_prod_gate` | Code: `TESTED` |
| `FIN-07` | Production Policy Approval Gate | In `ENVIRONMENT=production`, `draft` or unapproved policies fail closed with HTTP `403 UNAPPROVED_FINANCIAL_POLICY_BLOCKED`; `policy_version` persisted per run | `financial_policy_governance.py` | `test_tax_inclusive_exclusive_tds_fx_freight_credit_note_and_unapproved_prod_gate` | Code: `TESTED` / Business Owner Approval: `BLOCKED` |
| `FIN-08` | Segregation of Duties (SoD) | Uploader/extractor editor cannot approve same invoice; creator of payment batch cannot release it; dual approval enforced for high-risk HITL cases | `human_review`, `approval_workflow`, `erp_integration`, `security_auditability` | `test_19_prompt1b_*`, `test_multi_tier_high_value_sod_*` | Code: `TESTED` |
| `FIN-09` | Live Bank Payment Execution Disabled | `PAYMENT_EXECUTION_ENABLED=false`; `POST /api/v1/payment-batches/{id}/execute-bank-payment` fails closed with `403 PAYMENT_EXECUTION_DISABLED_BY_POLICY` | `approval_workflow/app/api/routes.py` | `test_prompt18_live_bank_payment_execution_hard_disabled_by_default` | `BLOCKED` (Intentionally Disabled) |

---

## 2. Double-Entry GL Balancing Invariant

Every approved AP workflow case generates a balanced `WorkflowGLVoucherRecord` (`SUM(debit) == SUM(credit)` in `Decimal` minor units):
- **Standard Invoice**: Debit Expense/Inventory + Debit Input GST (`CGST`/`SGST`/`IGST` when ITC-eligible) == Credit Accounts Payable (`net_payable`) + Credit TDS Payable (`tds_withheld`).
- **Credit Note**: Reverses Expense/Input GST and debits Supplier AP Offset without triggering cash disbursement.
