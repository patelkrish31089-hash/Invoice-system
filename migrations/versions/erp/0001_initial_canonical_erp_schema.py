"""Initial Canonical Enterprise Database & ERP Integration Schema (22 tables).

Revision ID: 0001_initial_canonical_erp
Revises: None
Create Date: 2026-10-24 00:00:00+00:00
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

from app.modules.erp_integration.database import Base
import app.modules.erp_integration.models  # noqa: F401

revision: str = "0001_initial_canonical_erp"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
