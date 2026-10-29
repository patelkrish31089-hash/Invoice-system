"""Add erp_posting_reconciliation_records table for Invoice-to-ERP discrepancy auditing (Prompt 11).

Revision ID: 0003_erp_posting_reconciliation
Revises: 0002_operational_indexes
Create Date: 2026-10-24 04:00:00+00:00
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0003_erp_posting_reconciliation"
down_revision: Union[str, None] = "0002_operational_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("erp_posting_reconciliation_records"):
        op.create_table(
            "erp_posting_reconciliation_records",
            sa.Column("id", sa.String(length=64), primary_key=True, nullable=False),
            sa.Column("run_id", sa.String(length=64), nullable=False),
            sa.Column("tenant_id", sa.String(length=64), nullable=False, server_default="default"),
            sa.Column("company_id", sa.String(length=64), nullable=True),
            sa.Column("erp_connection_id", sa.String(length=64), nullable=False),
            sa.Column("invoice_id", sa.String(length=64), nullable=True),
            sa.Column("invoice_number", sa.String(length=128), nullable=False),
            sa.Column("erp_document_ids_json", sa.Text(), nullable=False, server_default="[]"),
            sa.Column("discrepancy_code", sa.String(length=48), nullable=False),
            sa.Column("local_currency", sa.String(length=3), nullable=True),
            sa.Column("local_amount", sa.Numeric(precision=18, scale=2), nullable=True),
            sa.Column("erp_currency", sa.String(length=3), nullable=True),
            sa.Column("erp_amount", sa.Numeric(precision=18, scale=2), nullable=True),
            sa.Column("details", sa.Text(), nullable=False, server_default=""),
            sa.Column("triggered_by", sa.String(length=128), nullable=False, server_default="system"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index(
            "ix_erp_post_rec_run_status",
            "erp_posting_reconciliation_records",
            ["run_id", "discrepancy_code"],
            unique=False,
        )
        op.create_index(
            "ix_erp_post_rec_invoice",
            "erp_posting_reconciliation_records",
            ["invoice_id", "created_at"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("erp_posting_reconciliation_records"):
        existing_indexes = {ix["name"] for ix in inspector.get_indexes("erp_posting_reconciliation_records")}
        if "ix_erp_post_rec_invoice" in existing_indexes:
            op.drop_index("ix_erp_post_rec_invoice", table_name="erp_posting_reconciliation_records")
        if "ix_erp_post_rec_run_status" in existing_indexes:
            op.drop_index("ix_erp_post_rec_run_status", table_name="erp_posting_reconciliation_records")
        op.drop_table("erp_posting_reconciliation_records")
