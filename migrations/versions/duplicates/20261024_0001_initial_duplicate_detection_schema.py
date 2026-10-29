"""Initial Module 4 Duplicate Detection schema.

Revision ID: 20261024_0001
Revises: None
Create Date: 2026-10-24
"""

from __future__ import annotations

from alembic import op

import app.modules.duplicate_detection.models  # noqa: F401
from app.modules.duplicate_detection.db.base import Base

revision: str = "20261024_0001"
down_revision: str | None = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
