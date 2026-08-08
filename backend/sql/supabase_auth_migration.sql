-- =============================================================
-- Supabase Auth Migration: admin_users table + RLS
-- Run this in Supabase Dashboard → SQL Editor
-- =============================================================

-- 1. Create the admin_users authorization table
-- This table links Supabase auth.users to your app's role system.
-- The UUID must match the auth.users.id exactly.
create table if not exists public.admin_users (
  id          uuid primary key references auth.users(id) on delete restrict,
  full_name   text not null,
  role        text not null check (role in ('Principal', 'Admin', 'Teacher', 'Super Admin')),
  teacher_id  uuid null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2. Enable Row Level Security
alter table public.admin_users enable row level security;

-- 3. Authenticated users can read their own admin profile
drop policy if exists "Users can read own admin profile" on public.admin_users;
create policy "Users can read own admin profile"
  on public.admin_users
  for select
  to authenticated
  using (id = auth.uid());

-- 4. Removed recursive Super Admin policy.
-- The FastAPI backend handles all admin management using its elevated privileges.
-- The frontend only needs to read its own profile (Policy #3).

-- =============================================================
-- After creating auth users in Supabase Dashboard → Authentication → Users,
-- insert their profiles here. Example:
--
-- insert into public.admin_users (id, full_name, role, is_active)
-- values (
--   '<UUID-from-supabase-auth-users>',
--   'Abdul Rafi',
--   'Super Admin',
--   true
-- );
-- =============================================================
