"""Add operational composite indexes for sync checkpointing, outbox dispatch, and stale reconciliations.

Revision ID: 0002_operational_indexes
Revises: 0001_initial_canonical_erp
Create Date: 2026-10-24 00:05:00+00:00
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0002_operational_indexes"
down_revision: Union[str, None] = "0001_initial_canonical_erp"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_invoices_erp_posting_payment",
        "invoices",
        ["tenant_id", "erp_posting_status", "payment_authorization_status"],
        unique=False,
    )
    op.create_index(
        "ix_sync_errors_open_dlq",
        "sync_error_records",
        ["tenant_id", "is_dead_letter", "resolution_status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_sync_errors_open_dlq", table_name="sync_error_records")
    op.drop_index("ix_invoices_erp_posting_payment", table_name="invoices")
