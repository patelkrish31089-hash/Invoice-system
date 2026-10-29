"""Initial Module 9 Security, Financial Authorization & Keyed Auditability Schema + Triggers.

Revision ID: 0001_initial_security_schema
Revises: None
Create Date: 2026-10-24
"""

from typing import Sequence, Union

from alembic import op

from app.modules.security_auditability.database import APPEND_ONLY_AUDIT_TRIGGERS_SQL, Base
import app.modules.security_auditability.models  # noqa: F401

revision: str = "0001_initial_security_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)
    if bind.dialect.name == "sqlite":
        for stmt in APPEND_ONLY_AUDIT_TRIGGERS_SQL:
            op.execute(stmt)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        op.execute("DROP TRIGGER IF EXISTS trg_sec_audit_events_no_update;")
        op.execute("DROP TRIGGER IF EXISTS trg_sec_audit_events_no_delete;")
        op.execute("DROP TRIGGER IF EXISTS trg_sec_audit_checkpoints_no_update;")
        op.execute("DROP TRIGGER IF EXISTS trg_sec_audit_checkpoints_no_delete;")
    Base.metadata.drop_all(bind=bind)
