"""Initial Module 6 Approval Workflow, GL Voucher & Payment schema (8 tables)."""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

import app.modules.approval_workflow.models  # noqa: F401
from app.modules.approval_workflow.db.base import Base

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
