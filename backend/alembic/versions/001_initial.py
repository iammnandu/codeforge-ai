"""Initial migration — create all tables

Revision ID: 001
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Users
    op.create_table('users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('username', sa.String(), nullable=False),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.Column('full_name', sa.String()),
        sa.Column('role', sa.String(), nullable=False, server_default='candidate'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('is_verified', sa.Boolean(), server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_users_email',    'users', ['email'],    unique=True)
    op.create_index('ix_users_username', 'users', ['username'], unique=True)

    # Contests
    op.create_table('contests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('organizer_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('contest_code', sa.String(12), nullable=False),
        sa.Column('start_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('duration_minutes', sa.Integer(), nullable=False),
        sa.Column('allowed_languages', sa.JSON()),
        sa.Column('is_active', sa.Boolean(), server_default='false'),
        sa.Column('is_published', sa.Boolean(), server_default='false'),
        sa.Column('proctoring_enabled', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_contests_contest_code', 'contests', ['contest_code'], unique=True)

    # Problems
    op.create_table('problems',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('slug', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('input_format', sa.Text()),
        sa.Column('output_format', sa.Text()),
        sa.Column('constraints', sa.Text()),
        sa.Column('difficulty', sa.String(), server_default='medium'),
        sa.Column('time_limit_ms', sa.Integer(), server_default='2000'),
        sa.Column('memory_limit_mb', sa.Integer(), server_default='256'),
        sa.Column('is_public', sa.Boolean(), server_default='true'),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('sample_input', sa.Text()),
        sa.Column('sample_output', sa.Text()),
        sa.Column('editorial', sa.Text()),
        sa.Column('tags', sa.JSON()),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_problems_slug', 'problems', ['slug'], unique=True)

    # Test cases
    op.create_table('test_cases',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('problem_id', sa.Integer(), sa.ForeignKey('problems.id'), nullable=False),
        sa.Column('input', sa.Text(), nullable=False),
        sa.Column('expected', sa.Text(), nullable=False),
        sa.Column('is_sample', sa.Boolean(), server_default='false'),
        sa.Column('is_hidden', sa.Boolean(), server_default='true'),
        sa.Column('order', sa.Integer(), server_default='0'),
        sa.PrimaryKeyConstraint('id'),
    )

    # Submissions
    op.create_table('submissions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('problem_id', sa.Integer(), sa.ForeignKey('problems.id'), nullable=False),
        sa.Column('contest_id', sa.Integer(), sa.ForeignKey('contests.id')),
        sa.Column('candidate_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('language', sa.String(), nullable=False),
        sa.Column('code', sa.Text(), nullable=False),
        sa.Column('status', sa.String(), server_default='pending'),
        sa.Column('score', sa.Float(), server_default='0'),
        sa.Column('time_ms', sa.Integer()),
        sa.Column('memory_kb', sa.Integer()),
        sa.Column('test_results', sa.JSON()),
        sa.Column('error_message', sa.Text()),
        sa.Column('submitted_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
    )

    # Contest participants
    op.create_table('contest_participants',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('contest_id', sa.Integer(), sa.ForeignKey('contests.id'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('score', sa.Integer(), server_default='0'),
        sa.Column('rank', sa.Integer()),
        sa.PrimaryKeyConstraint('id'),
    )

    # Monitoring sessions
    op.create_table('monitoring_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('contest_id', sa.Integer(), sa.ForeignKey('contests.id'), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('ended_at', sa.DateTime(timezone=True)),
        sa.Column('suspicion_score', sa.Float(), server_default='0'),
        sa.Column('is_flagged', sa.Boolean(), server_default='false'),
        sa.Column('calibration_data', sa.JSON()),
        sa.PrimaryKeyConstraint('id'),
    )

    # Monitoring events
    op.create_table('monitoring_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), sa.ForeignKey('monitoring_sessions.id'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('event_type', sa.String(), nullable=False),
        sa.Column('severity', sa.String(), server_default='medium'),
        sa.Column('confidence', sa.Float()),
        sa.Column('score_delta', sa.Float(), server_default='0'),
        sa.Column('details', sa.JSON()),
        sa.Column('snapshot_path', sa.String()),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    for table in ['monitoring_events','monitoring_sessions','contest_participants',
                  'submissions','test_cases','problems','contests','users']:
        op.drop_table(table)
