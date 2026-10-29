"""Initial Module 3 Three-Way Matching schema.

Revision ID: 20261024_0001
Revises: None
Create Date: 2026-10-24 05:15:00
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

import app.modules.three_way_matching.models  # noqa: F401
from app.modules.three_way_matching.db.base import Base

revision: str = "20261024_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
