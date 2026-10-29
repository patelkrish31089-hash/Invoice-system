"""Unified Alembic migration environment for all schemas of the single system."""

from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)


def _resolve_target_metadata(scope: str):
    if scope == "erp":
        import app.modules.erp_integration.models  # noqa: F401
        from app.modules.erp_integration.database import Base
        return Base.metadata
    if scope == "security":
        import app.modules.security_auditability.models  # noqa: F401
        from app.modules.security_auditability.database import Base
        return Base.metadata
    if scope == "observability":
        import app.modules.testing_monitoring.db.models  # noqa: F401
        from app.modules.testing_monitoring.db.models import Base
        return Base.metadata
    if scope == "ingestion":
        import app.modules.document_ingestion.models  # noqa: F401
        from app.modules.document_ingestion.db.base import Base
        return Base.metadata
    if scope == "extraction":
        import app.modules.intelligent_extraction.models  # noqa: F401
        from app.modules.intelligent_extraction.db.base import Base
        return Base.metadata
    if scope == "matching":
        import app.modules.three_way_matching.models  # noqa: F401
        from app.modules.three_way_matching.db.base import Base
        return Base.metadata
    if scope == "duplicates":
        import app.modules.duplicate_detection.models  # noqa: F401
        from app.modules.duplicate_detection.db.base import Base
        return Base.metadata
    if scope == "fraud":
        import app.modules.fraud_detection.models  # noqa: F401
        from app.modules.fraud_detection.db.base import Base
        return Base.metadata
    if scope == "workflow":
        import app.modules.approval_workflow.models  # noqa: F401
        from app.modules.approval_workflow.db.base import Base
        return Base.metadata
    if scope == "relationships":
        import app.modules.relationship_analysis.models  # noqa: F401
        from app.modules.relationship_analysis.db.base import Base
        return Base.metadata
    if scope == "review":
        import app.modules.human_review.models.entities  # noqa: F401
        from app.modules.human_review.core.database import Base
        return Base.metadata
    raise ValueError(f"Unknown migration_scope '{scope}'")


migration_scope = config.get_main_option("migration_scope", "erp")
target_metadata = _resolve_target_metadata(migration_scope)


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
