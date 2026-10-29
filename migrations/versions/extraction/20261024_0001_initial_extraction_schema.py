"""Initial Module 2 Intelligent Invoice Extraction schema.

Revision ID: 20261024_0001
Revises: None
Create Date: 2026-10-24 12:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261024_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "extraction_versions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("version_tag", sa.String(length=128), nullable=False),
        sa.Column("schema_version", sa.String(length=32), nullable=False),
        sa.Column("rule_version", sa.String(length=32), nullable=False),
        sa.Column("confidence_version", sa.String(length=32), nullable=False),
        sa.Column("strategy", sa.String(length=64), nullable=False),
        sa.Column("config_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_extraction_versions_version_tag", "extraction_versions", ["version_tag"], unique=True)

    op.create_table(
        "invoice_extraction_runs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("document_id", sa.String(length=64), nullable=False),
        sa.Column("source_file_hash", sa.String(length=64), nullable=True),
        sa.Column("extraction_version", sa.String(length=128), nullable=False),
        sa.Column("provider_name", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("parent_invoice_id", sa.String(length=36), nullable=True),
        sa.Column("page_count", sa.Integer(), nullable=False),
        sa.Column("input_snapshot_json", sa.JSON(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_ms", sa.Float(), nullable=True),
        sa.Column("error_code", sa.String(length=64), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_by", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_invoice_extraction_runs_document_id", "invoice_extraction_runs", ["document_id"])
    op.create_index("ix_invoice_extraction_runs_source_file_hash", "invoice_extraction_runs", ["source_file_hash"])
    op.create_index("ix_invoice_extraction_runs_extraction_version", "invoice_extraction_runs", ["extraction_version"])
    op.create_index("ix_invoice_extraction_runs_status", "invoice_extraction_runs", ["status"])
    op.create_index("ix_runs_doc_version", "invoice_extraction_runs", ["document_id", "extraction_version"])

    op.create_table(
        "extracted_invoices",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "run_id",
            sa.String(length=36),
            sa.ForeignKey("invoice_extraction_runs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("document_id", sa.String(length=64), nullable=False),
        sa.Column("source_file_hash", sa.String(length=64), nullable=True),
        sa.Column("filename", sa.String(length=512), nullable=True),
        sa.Column("revision_number", sa.Integer(), nullable=False),
        sa.Column("is_active_revision", sa.Boolean(), nullable=False),
        sa.Column("extraction_version", sa.String(length=128), nullable=False),
        sa.Column("schema_version", sa.String(length=32), nullable=False),
        sa.Column("classified_type", sa.String(length=64), nullable=False),
        sa.Column("classification_confidence", sa.Float(), nullable=False),
        sa.Column("source_category", sa.String(length=32), nullable=False),
        sa.Column("language", sa.String(length=16), nullable=False),
        sa.Column("invoice_number", sa.String(length=128), nullable=True),
        sa.Column("invoice_date", sa.Date(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("po_number", sa.String(length=128), nullable=True),
        sa.Column("vendor_name", sa.String(length=256), nullable=True),
        sa.Column("vendor_comparison_key", sa.String(length=256), nullable=True),
        sa.Column("vendor_gstin", sa.String(length=32), nullable=True),
        sa.Column("buyer_name", sa.String(length=256), nullable=True),
        sa.Column("buyer_gstin", sa.String(length=32), nullable=True),
        sa.Column("currency", sa.String(length=16), nullable=True),
        sa.Column("subtotal", sa.Numeric(18, 4), nullable=True),
        sa.Column("taxable_amount", sa.Numeric(18, 4), nullable=True),
        sa.Column("total_tax", sa.Numeric(18, 4), nullable=True),
        sa.Column("grand_total", sa.Numeric(18, 4), nullable=True),
        sa.Column("line_item_count", sa.Integer(), nullable=False),
        sa.Column("overall_confidence", sa.Float(), nullable=True),
        sa.Column("requires_review", sa.Boolean(), nullable=False),
        sa.Column("review_status", sa.String(length=32), nullable=False),
        sa.Column("eligible_for_matching", sa.Boolean(), nullable=False),
        sa.Column("structured_payload_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    for col in [
        "run_id",
        "document_id",
        "source_file_hash",
        "is_active_revision",
        "extraction_version",
        "classified_type",
        "invoice_number",
        "invoice_date",
        "po_number",
        "vendor_name",
        "vendor_comparison_key",
        "vendor_gstin",
        "buyer_gstin",
        "grand_total",
        "requires_review",
        "review_status",
        "eligible_for_matching",
    ]:
        op.create_index(f"ix_extracted_invoices_{col}", "extracted_invoices", [col])
    op.create_index("ix_inv_vendor_inv_num", "extracted_invoices", ["vendor_gstin", "invoice_number"])
    op.create_index("ix_inv_doc_active", "extracted_invoices", ["document_id", "is_active_revision"])

    op.create_table(
        "extracted_fields",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "invoice_id",
            sa.String(length=36),
            sa.ForeignKey("extracted_invoices.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("field_group", sa.String(length=32), nullable=False),
        sa.Column("field_path", sa.String(length=128), nullable=False),
        sa.Column("raw_value", sa.Text(), nullable=True),
        sa.Column("normalized_value", sa.Text(), nullable=True),
        sa.Column("value_type", sa.String(length=32), nullable=False),
        sa.Column("currency", sa.String(length=16), nullable=True),
        sa.Column("provider_confidence", sa.Float(), nullable=True),
        sa.Column("normalized_provider_confidence", sa.Float(), nullable=True),
        sa.Column("internal_confidence", sa.Float(), nullable=True),
        sa.Column("confidence_method", sa.String(length=64), nullable=False),
        sa.Column("confidence_version", sa.String(length=32), nullable=False),
        sa.Column("confidence_band", sa.String(length=16), nullable=False),
        sa.Column("review_status", sa.String(length=32), nullable=False),
        sa.Column("is_ambiguous", sa.Boolean(), nullable=False),
        sa.Column("warnings_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_extracted_fields_invoice_id", "extracted_fields", ["invoice_id"])
    op.create_index("ix_extracted_fields_field_path", "extracted_fields", ["field_path"])
    op.create_index("ix_extracted_fields_confidence_band", "extracted_fields", ["confidence_band"])
    op.create_index("ix_extracted_fields_review_status", "extracted_fields", ["review_status"])
    op.create_index("ix_ext_fields_inv_path", "extracted_fields", ["invoice_id", "field_path"])

    op.create_table(
        "field_evidence",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "extracted_field_id",
            sa.String(length=36),
            sa.ForeignKey("extracted_fields.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "invoice_id",
            sa.String(length=36),
            sa.ForeignKey("extracted_invoices.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("page_number", sa.Integer(), nullable=True),
        sa.Column("extraction_method", sa.String(length=64), nullable=False),
        sa.Column("region_type", sa.String(length=64), nullable=True),
        sa.Column("evidence_text", sa.Text(), nullable=True),
        sa.Column("bbox_x", sa.Float(), nullable=True),
        sa.Column("bbox_y", sa.Float(), nullable=True),
        sa.Column("bbox_width", sa.Float(), nullable=True),
        sa.Column("bbox_height", sa.Float(), nullable=True),
        sa.Column("bbox_unit", sa.String(length=16), nullable=True),
    )
    op.create_index("ix_field_evidence_extracted_field_id", "field_evidence", ["extracted_field_id"], unique=True)
    op.create_index("ix_field_evidence_invoice_id", "field_evidence", ["invoice_id"])

    op.create_table(
        "invoice_line_items",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "invoice_id",
            sa.String(length=36),
            sa.ForeignKey("extracted_invoices.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("line_number", sa.Integer(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("raw_text", sa.Text(), nullable=True),
        sa.Column("product_name", sa.String(length=512), nullable=True),
        sa.Column("sku", sa.String(length=128), nullable=True),
        sa.Column("hsn_sac", sa.String(length=32), nullable=True),
        sa.Column("quantity", sa.Numeric(18, 4), nullable=True),
        sa.Column("unit", sa.String(length=32), nullable=True),
        sa.Column("unit_price", sa.Numeric(18, 4), nullable=True),
        sa.Column("gross_amount", sa.Numeric(18, 4), nullable=True),
        sa.Column("discount", sa.Numeric(18, 4), nullable=True),
        sa.Column("taxable_value", sa.Numeric(18, 4), nullable=True),
        sa.Column("tax_rate", sa.Numeric(8, 4), nullable=True),
        sa.Column("tax_amount", sa.Numeric(18, 4), nullable=True),
        sa.Column("cgst_rate", sa.Numeric(8, 4), nullable=True),
        sa.Column("cgst_amount", sa.Numeric(18, 4), nullable=True),
        sa.Column("sgst_rate", sa.Numeric(8, 4), nullable=True),
        sa.Column("sgst_amount", sa.Numeric(18, 4), nullable=True),
        sa.Column("igst_rate", sa.Numeric(8, 4), nullable=True),
        sa.Column("igst_amount", sa.Numeric(18, 4), nullable=True),
        sa.Column("other_tax_amount", sa.Numeric(18, 4), nullable=True),
        sa.Column("net_line_total", sa.Numeric(18, 4), nullable=True),
        sa.Column("currency", sa.String(length=16), nullable=True),
        sa.Column("page_number", sa.Integer(), nullable=False),
        sa.Column("bbox_json", sa.JSON(), nullable=True),
        sa.Column("extraction_method", sa.String(length=64), nullable=False),
        sa.Column("provider_confidence", sa.Float(), nullable=True),
        sa.Column("internal_confidence", sa.Float(), nullable=True),
        sa.Column("review_status", sa.String(length=32), nullable=False),
        sa.Column("uncertain_columns_json", sa.JSON(), nullable=False),
        sa.Column("warnings_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_invoice_line_items_invoice_id", "invoice_line_items", ["invoice_id"])
    op.create_index("ix_invoice_line_items_hsn_sac", "invoice_line_items", ["hsn_sac"])

    op.create_table(
        "extraction_candidates",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "invoice_id",
            sa.String(length=36),
            sa.ForeignKey("extracted_invoices.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("field_path", sa.String(length=128), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column("raw_value", sa.Text(), nullable=False),
        sa.Column("normalized_value", sa.Text(), nullable=True),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("is_selected", sa.Boolean(), nullable=False),
        sa.Column("label_matched", sa.String(length=128), nullable=True),
        sa.Column("region_type", sa.String(length=64), nullable=True),
        sa.Column("extraction_method", sa.String(length=64), nullable=False),
        sa.Column("provider_confidence", sa.Float(), nullable=True),
        sa.Column("page_number", sa.Integer(), nullable=True),
        sa.Column("bbox_json", sa.JSON(), nullable=True),
        sa.Column("evidence_text", sa.Text(), nullable=True),
        sa.Column("decision_reason", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_extraction_candidates_invoice_id", "extraction_candidates", ["invoice_id"])
    op.create_index("ix_extraction_candidates_field_path", "extraction_candidates", ["field_path"])
    op.create_index("ix_extraction_candidates_is_selected", "extraction_candidates", ["is_selected"])
    op.create_index("ix_cand_inv_field", "extraction_candidates", ["invoice_id", "field_path"])

    op.create_table(
        "validation_issues",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "invoice_id",
            sa.String(length=36),
            sa.ForeignKey("extracted_invoices.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("rule_id", sa.String(length=64), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False),
        sa.Column("affected_field", sa.String(length=128), nullable=False),
        sa.Column("expected_condition", sa.Text(), nullable=False),
        sa.Column("observed_values_json", sa.JSON(), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("suggested_action", sa.Text(), nullable=False),
        sa.Column("requires_review", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_validation_issues_invoice_id", "validation_issues", ["invoice_id"])
    op.create_index("ix_validation_issues_rule_id", "validation_issues", ["rule_id"])
    op.create_index("ix_validation_issues_severity", "validation_issues", ["severity"])

    op.create_table(
        "review_decisions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "invoice_id",
            sa.String(length=36),
            sa.ForeignKey("extracted_invoices.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("revision_number", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(length=32), nullable=False),
        sa.Column("target_type", sa.String(length=32), nullable=False),
        sa.Column("target_path", sa.String(length=128), nullable=True),
        sa.Column("original_value", sa.Text(), nullable=True),
        sa.Column("corrected_value", sa.Text(), nullable=True),
        sa.Column("reviewer_id", sa.String(length=128), nullable=False),
        sa.Column("reviewer_role", sa.String(length=64), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("extraction_version", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_review_decisions_invoice_id", "review_decisions", ["invoice_id"])
    op.create_index("ix_review_decisions_action", "review_decisions", ["action"])
    op.create_index("ix_review_decisions_reviewer_id", "review_decisions", ["reviewer_id"])

    op.create_table(
        "downstream_outbox_events",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("invoice_id", sa.String(length=36), nullable=True),
        sa.Column("document_id", sa.String(length=64), nullable=False),
        sa.Column("run_id", sa.String(length=36), nullable=False),
        sa.Column("schema_version", sa.String(length=32), nullable=False),
        sa.Column("extraction_version", sa.String(length=128), nullable=False),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.Column("delivery_status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_downstream_outbox_events_event_type", "downstream_outbox_events", ["event_type"])
    op.create_index("ix_downstream_outbox_events_invoice_id", "downstream_outbox_events", ["invoice_id"])
    op.create_index("ix_downstream_outbox_events_document_id", "downstream_outbox_events", ["document_id"])
    op.create_index("ix_downstream_outbox_events_run_id", "downstream_outbox_events", ["run_id"])
    op.create_index("ix_downstream_outbox_events_delivery_status", "downstream_outbox_events", ["delivery_status"])

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("entity_type", sa.String(length=64), nullable=False),
        sa.Column("entity_id", sa.String(length=64), nullable=False),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("actor_id", sa.String(length=128), nullable=False),
        sa.Column("actor_role", sa.String(length=64), nullable=False),
        sa.Column("correlation_id", sa.String(length=64), nullable=False),
        sa.Column("details_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_audit_logs_entity_id", "audit_logs", ["entity_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])


def downgrade() -> None:
    for tbl in [
        "audit_logs",
        "downstream_outbox_events",
        "review_decisions",
        "validation_issues",
        "extraction_candidates",
        "invoice_line_items",
        "field_evidence",
        "extracted_fields",
        "extracted_invoices",
        "invoice_extraction_runs",
        "extraction_versions",
    ]:
        op.drop_table(tbl)
