-- Run once in Supabase SQL Editor before enabling scheduled reminders.
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('expo', 'web')),
    device_key TEXT NOT NULL UNIQUE,
    subscription JSONB,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK ((platform = 'expo' AND subscription IS NULL) OR
           (platform = 'web' AND subscription IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
    ON push_subscriptions (user_id) WHERE enabled = TRUE;

CREATE TABLE IF NOT EXISTS notification_dispatches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attendance_date DATE NOT NULL,
    phase TEXT NOT NULL CHECK (phase IN ('start', 'teacher_missing', 'admin_missing')),
    user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (attendance_date, phase, user_id)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_dispatches ENABLE ROW LEVEL SECURITY;

-- Clients access these records only through the authenticated FastAPI routes.
