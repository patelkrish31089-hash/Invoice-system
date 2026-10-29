"""Initial Module 7 HITL Review & Exception Management schema."""
from alembic import op
from app.modules.human_review.core.database import Base
import app.modules.human_review.models.entities  # noqa: F401

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
