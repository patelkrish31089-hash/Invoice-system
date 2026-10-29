"""Initial Module 10 Testing, ML Observability & Model Governance Schema + Immutability Triggers.

Revision ID: 0001_initial_testing_monitoring_schema
Revises: None
Create Date: 2026-10-24
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.modules.testing_monitoring.db.models import Base
from app.modules.testing_monitoring.db.session import SQLITE_IMMUTABILITY_TRIGGERS

revision: str = "0001_initial_testing_monitoring_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)
    if bind.dialect.name == "sqlite":
        for ddl in SQLITE_IMMUTABILITY_TRIGGERS:
            bind.execute(sa.text(ddl))


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        bind.execute(sa.text("DROP TRIGGER IF EXISTS trg_obs_audit_events_no_update;"))
        bind.execute(sa.text("DROP TRIGGER IF EXISTS trg_obs_audit_events_no_delete;"))
        bind.execute(sa.text("DROP TRIGGER IF EXISTS trg_obs_feedback_immutable_prediction;"))
    Base.metadata.drop_all(bind=bind)
