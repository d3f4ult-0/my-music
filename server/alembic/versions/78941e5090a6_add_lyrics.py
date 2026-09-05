"""add lyrics

Revision ID: 78941e5090a6
Revises: f4da90f29478
Create Date: 2026-09-05 20:51:39.819934

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '78941e5090a6'
down_revision: Union[str, Sequence[str], None] = 'f4da90f29478'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "lyrics",
        sa.Column(
            "id",
            sa.Integer(),
            autoincrement=True,
            nullable=False,
        ),
        sa.Column(
            "track_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "lyrics_text",
            sa.Text(),
            nullable=False,
        ),
        sa.Column(
            "synced",
            sa.Boolean(),
            nullable=False,
        ),
        sa.Column(
            "provider",
            sa.String(length=100),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["track_id"],
            ["tracks.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("track_id"),
    )


def downgrade() -> None:
    op.drop_table("lyrics")