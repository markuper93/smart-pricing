"""Idempotent additive migration, SQLite/PostgreSQL; invoked at app startup.
No DB connection is made by importing this module.
"""
from sqlalchemy import inspect, text


def migrate_supplements(engine):
    with engine.begin() as connection:
        # Serialize application workers on PostgreSQL.
        if connection.dialect.name == 'postgresql':
            connection.execute(text('SELECT pg_advisory_xact_lock(734281902)'))
        inspector = inspect(connection)
        additions = {
            'price_lists': ('supplements_uploaded', 'BOOLEAN NOT NULL DEFAULT FALSE'),
            'tracking_items': ('supplements', "TEXT NOT NULL DEFAULT '{}'"),
        }
        for table, (column, definition) in additions.items():
            if inspector.has_table(table) and column not in {c['name'] for c in inspector.get_columns(table)}:
                connection.execute(text(f'ALTER TABLE {table} ADD COLUMN {column} {definition}'))
        from .models.price_data import Supplement
        Supplement.__table__.create(connection, checkfirst=True)
