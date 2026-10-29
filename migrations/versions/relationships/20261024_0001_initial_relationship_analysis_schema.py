"""Initial 14-table schema for Vendor and Employee Relationship Analysis.

Revision ID: 20261024_0001
Revises:
Create Date: 2026-10-24
"""

from __future__ import annotations

from alembic import op
from sqlalchemy.orm import Session

import app.modules.relationship_analysis.models  # noqa: F401
from app.modules.relationship_analysis.db.base import Base

revision = "20261024_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
