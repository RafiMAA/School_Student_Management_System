-- Keep the display role enum aligned with the authorization roles supported
-- by admin_users and the API. Run once in the Supabase SQL editor.
ALTER TYPE teacher_role ADD VALUE IF NOT EXISTS 'Super Admin';

-- Prevent invalid authorization roles even when a row is edited outside the API.
ALTER TABLE admin_users
    DROP CONSTRAINT IF EXISTS admin_users_role_check;

ALTER TABLE admin_users
    ADD CONSTRAINT admin_users_role_check
    CHECK (role IN ('Principal', 'Admin', 'Teacher', 'Super Admin'));
