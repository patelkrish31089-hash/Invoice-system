# Optional Advanced AI & Graph Enhancements Feasibility Report (`docs/OPTIONAL_AI_FEASIBILITY_REPORT.md`)

**Scope:** Prompt 13 — Evidence-driven engineering justification for optional advanced AI/graph components (`LayoutLMv3`/multimodal transformers, `Neo4j` dedicated graph cluster vs. `NetworkX`/PostgreSQL, and Contract Review LLM).

---

## 1. Multimodal Document Understanding (`LayoutLMv3` / `Donut`)

- **Current Repository State:** `NOT_IMPLEMENTED` (`intelligent_extraction/app/extractors/llm_assisted.py::get_layoutlmv3_conditional_scope_status()`), explicitly and truthfully reported without fake model weights.
- **Measured Baseline Without Multimodal Weights:** The deterministic spatial layout + PyMuPDF/Tesseract + Indian GST/table ensemble achieves `exact_match = 1.0000`, `field_f1 = 0.9600`, and `mean_cer = 0.0112` on the controlled synthetic benchmark (`N = 6` documents / `48` fields) in `< 150 ms` CPU latency and `< 120 MB` RAM.
- **Resource & Governance Cost of `LayoutLMv3`:**
  - Adds `~1.4 GB` (`torch` + `transformers` + `timm` + `LayoutLMv3-base` checkpoint), exceeding single-node 2 GB sandbox memory budgets unless GPU/dedicated inference nodes are provisioned.
  - Fine-tuning requires `>= 2,000` privacy-cleared, token-bounding-box-annotated real customer invoices across diverse supplier layouts (`BLOCKED` pending real customer corpus & opt-in governance sign-off).
- **Engineering Decision:** **Defer weight activation (`BLOCKED` on real annotated corpus & GPU inference tier).** Keep deterministic spatial + calibrated confidence routing (`EXTRACTION_REVIEW_REQUIRED`) as the production-safe baseline.

---

## 2. Graph Analytics (`Neo4j` Cluster vs. `NetworkX` + SQL)

- **Current Repository State:** Dual-backend architecture implemented (`relationship_analysis/app/services/relationship_analysis/{graph_service,neo4j_client}.py`). Parameterized Cypher queries and Bolt adapter are `LOCALLY TESTED` for injection safety; runtime graph traversal executes on `NetworkX` backed by relational persistence.
- **Complexity vs. Scale Trade-Off:**
  - Below `~250,000` edges (typical mid-market AP ledger of `10k–50k` suppliers and `500k` invoices), in-memory/SQL-hydrated `NetworkX` executes shared-bank/tax-ID/address conflict detection, cycle detection, and burst centrality in `< 50 ms` with zero external database operational overhead.
  - Above `1M+` edges or multi-hop real-time traversal across multi-year global ledgers, a dedicated `Neo4j` cluster becomes justified.
- **Engineering Decision:** **Retain `NetworkX` + relational store as default active engine**; keep `Neo4j` Bolt adapter opt-in behind `NEO4J_URI` once graph scale and cluster ops budget justify deployment.

---

## 3. Contract & Procurement Clause Comparison LLM

- **Current Repository State:** `IMPLEMENTED` & `LOCALLY TESTED` as a **strictly advisory, prompt-injection-defended comparator** (`intelligent_extraction/app/extractors/llm_assisted.py::evaluate_contract_terms_with_guardrails`).
- **Mandatory Safety Controls Enforced:**
  1. Untrusted invoice text is scanned for instruction-override patterns (`IGNORE ALL PREVIOUS INSTRUCTIONS`, bank-account override lures, role-hijack tokens) before any clause comparison.
  2. Output carries `"advisory_only": True` and `"can_override_deterministic_controls": False` — it can **never** waive pure-`Decimal` financial math, 3-way PO/GRN tolerances, duplicate holds, or Segregation of Duties approvals.
  3. External commercial LLM API calls remain disabled by default (`ALLOW_LLM_EXTRACTION=false`) until enterprise zero-data-retention DPA and privacy redaction gates are signed off.
