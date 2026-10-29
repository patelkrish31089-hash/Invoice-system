"""Initial document ingestion & OCR schema.

Revision ID: 0001_initial_schema
Revises: None
Create Date: 2026-10-23 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "documents",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=False),
        sa.Column("storage_key", sa.String(length=512), nullable=False),
        sa.Column("source_type", sa.String(length=50), nullable=False),
        sa.Column("page_count", sa.Integer(), nullable=False),
        sa.Column("processing_status", sa.String(length=40), nullable=False),
        sa.Column("ocr_status", sa.String(length=40), nullable=False),
        sa.Column("document_type", sa.String(length=40), nullable=False),
        sa.Column("classification_confidence", sa.Float(), nullable=True),
        sa.Column("duplicate_of_document_id", sa.String(length=36), nullable=True),
        sa.Column("tenant_id", sa.String(length=64), nullable=False),
        sa.Column("uploaded_by", sa.String(length=128), nullable=False),
        sa.Column("extracted_text_json", sa.JSON(), nullable=True),
        sa.Column("source_metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["duplicate_of_document_id"], ["documents.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("storage_key"),
    )
    op.create_index("ix_documents_sha256", "documents", ["sha256"], unique=False)
    op.create_index(
        "ix_documents_processing_status", "documents", ["processing_status"], unique=False
    )
    op.create_index("ix_documents_tenant_id", "documents", ["tenant_id"], unique=False)
    op.create_index("ix_documents_created_at", "documents", ["created_at"], unique=False)
    op.create_index(
        "ix_documents_tenant_sha256", "documents", ["tenant_id", "sha256"], unique=False
    )

    op.create_table(
        "processing_jobs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("document_id", sa.String(length=36), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("stage", sa.String(length=64), nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=False),
        sa.Column("ocr_engine", sa.String(length=64), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_ms", sa.Float(), nullable=True),
        sa.Column("stage_timings", sa.JSON(), nullable=True),
        sa.Column("error_code", sa.String(length=80), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_processing_jobs_document_id", "processing_jobs", ["document_id"])
    op.create_index("ix_processing_jobs_status", "processing_jobs", ["status"])
    op.create_index("ix_processing_jobs_created_at", "processing_jobs", ["created_at"])

    op.create_table(
        "extracted_invoices",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("document_id", sa.String(length=36), nullable=False),
        sa.Column("schema_version", sa.String(length=20), nullable=False),
        sa.Column("invoice_number", sa.String(length=128), nullable=True),
        sa.Column("normalized_invoice_number", sa.String(length=128), nullable=True),
        sa.Column("invoice_date", sa.Date(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("purchase_order_number", sa.String(length=128), nullable=True),
        sa.Column("is_credit_note", sa.Boolean(), nullable=False),
        sa.Column("vendor_name", sa.String(length=255), nullable=True),
        sa.Column("vendor_comparison_key", sa.String(length=255), nullable=True),
        sa.Column("vendor_gstin", sa.String(length=20), nullable=True),
        sa.Column("buyer_name", sa.String(length=255), nullable=True),
        sa.Column("buyer_gstin", sa.String(length=20), nullable=True),
        sa.Column("currency", sa.String(length=10), nullable=True),
        sa.Column("subtotal", sa.Numeric(precision=18, scale=4), nullable=True),
        sa.Column("discount", sa.Numeric(precision=18, scale=4), nullable=True),
        sa.Column("tax_total", sa.Numeric(precision=18, scale=4), nullable=True),
        sa.Column("grand_total", sa.Numeric(precision=18, scale=4), nullable=True),
        sa.Column("overall_confidence", sa.Float(), nullable=True),
        sa.Column("extracted_data", sa.JSON(), nullable=False),
        sa.Column("original_ocr_snapshot", sa.JSON(), nullable=False),
        sa.Column("validation_status", sa.String(length=40), nullable=False),
        sa.Column("validation_report", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_extracted_invoices_document_id", "extracted_invoices", ["document_id"])
    op.create_index(
        "ix_extracted_invoices_invoice_number", "extracted_invoices", ["invoice_number"]
    )
    op.create_index(
        "ix_extracted_invoices_normalized_invoice_number",
        "extracted_invoices",
        ["normalized_invoice_number"],
    )
    op.create_index(
        "ix_extracted_invoices_invoice_date", "extracted_invoices", ["invoice_date"]
    )
    op.create_index(
        "ix_extracted_invoices_purchase_order_number",
        "extracted_invoices",
        ["purchase_order_number"],
    )
    op.create_index(
        "ix_extracted_invoices_vendor_comparison_key",
        "extracted_invoices",
        ["vendor_comparison_key"],
    )
    op.create_index(
        "ix_extracted_invoices_vendor_gstin", "extracted_invoices", ["vendor_gstin"]
    )
    op.create_index(
        "ix_extracted_invoices_validation_status",
        "extracted_invoices",
        ["validation_status"],
    )
    op.create_index(
        "ix_extracted_invoices_created_at", "extracted_invoices", ["created_at"]
    )
    op.create_index(
        "ix_extracted_invoices_vendor_inv_num",
        "extracted_invoices",
        ["vendor_comparison_key", "normalized_invoice_number"],
    )

    op.create_table(
        "extraction_fields",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("invoice_id", sa.String(length=36), nullable=False),
        sa.Column("field_name", sa.String(length=100), nullable=False),
        sa.Column("raw_value", sa.Text(), nullable=True),
        sa.Column("normalized_value", sa.Text(), nullable=True),
        sa.Column("corrected_value", sa.Text(), nullable=True),
        sa.Column("field_state", sa.String(length=32), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("page_number", sa.Integer(), nullable=True),
        sa.Column("bounding_box", sa.JSON(), nullable=True),
        sa.Column("source_method", sa.String(length=50), nullable=False),
        sa.ForeignKeyConstraint(
            ["invoice_id"], ["extracted_invoices.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_extraction_fields_invoice_id", "extraction_fields", ["invoice_id"])
    op.create_index("ix_extraction_fields_field_name", "extraction_fields", ["field_name"])

    op.create_table(
        "review_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("invoice_id", sa.String(length=36), nullable=False),
        sa.Column("reviewer_id", sa.String(length=128), nullable=False),
        sa.Column("reviewer_role", sa.String(length=50), nullable=False),
        sa.Column("field_name", sa.String(length=100), nullable=True),
        sa.Column("old_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["invoice_id"], ["extracted_invoices.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_review_events_invoice_id", "review_events", ["invoice_id"])
    op.create_index("ix_review_events_reviewer_id", "review_events", ["reviewer_id"])
    op.create_index("ix_review_events_created_at", "review_events", ["created_at"])

    op.create_table(
        "fraud_signals",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("document_id", sa.String(length=36), nullable=False),
        sa.Column("invoice_id", sa.String(length=36), nullable=True),
        sa.Column("rule_id", sa.String(length=64), nullable=False),
        sa.Column("signal_type", sa.String(length=80), nullable=False),
        sa.Column("category", sa.String(length=40), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("evidence", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["invoice_id"], ["extracted_invoices.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_fraud_signals_document_id", "fraud_signals", ["document_id"])
    op.create_index("ix_fraud_signals_invoice_id", "fraud_signals", ["invoice_id"])
    op.create_index("ix_fraud_signals_rule_id", "fraud_signals", ["rule_id"])

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("actor_id", sa.String(length=128), nullable=False),
        sa.Column("actor_role", sa.String(length=50), nullable=False),
        sa.Column("tenant_id", sa.String(length=64), nullable=False),
        sa.Column("action", sa.String(length=80), nullable=False),
        sa.Column("resource_type", sa.String(length=64), nullable=False),
        sa.Column("resource_id", sa.String(length=64), nullable=True),
        sa.Column("correlation_id", sa.String(length=64), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_actor_id", "audit_logs", ["actor_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_resource_id", "audit_logs", ["resource_id"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])

    op.create_table(
        "downstream_outbox_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("schema_version", sa.String(length=20), nullable=False),
        sa.Column("document_id", sa.String(length=36), nullable=False),
        sa.Column("invoice_id", sa.String(length=36), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("delivery_status", sa.String(length=32), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_downstream_outbox_events_event_type",
        "downstream_outbox_events",
        ["event_type"],
    )
    op.create_index(
        "ix_downstream_outbox_events_document_id",
        "downstream_outbox_events",
        ["document_id"],
    )
    op.create_index(
        "ix_downstream_outbox_events_invoice_id",
        "downstream_outbox_events",
        ["invoice_id"],
    )
    op.create_index(
        "ix_downstream_outbox_events_delivery_status",
        "downstream_outbox_events",
        ["delivery_status"],
    )
    op.create_index(
        "ix_downstream_outbox_events_created_at",
        "downstream_outbox_events",
        ["created_at"],
    )


def downgrade() -> None:
    op.drop_table("downstream_outbox_events")
    op.drop_table("audit_logs")
    op.drop_table("fraud_signals")
    op.drop_table("review_events")
    op.drop_table("extraction_fields")
    op.drop_table("extracted_invoices")
    op.drop_table("processing_jobs")
    op.drop_table("documents")
