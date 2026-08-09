// Auth service for React Native — separated from AuthContext.
// Handles login, session restore, and admin profile verification.

import { supabase } from './supabase';
import type { AppUser, UserRole } from '../types';

/**
 * Load the admin profile from public.admin_users.
 * Returns null if the user has no profile or is inactive.
 */
async function loadAdminProfile(
  userId: string,
  email: string,
): Promise<AppUser | null> {
  const { data, error } = await supabase
    .from('admin_users')
    .select('id, full_name, role, teacher_id, is_active')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data || !data.is_active) return null;

  return {
    id: data.id,
    email,
    fullName: data.full_name,
    role: data.role as UserRole,
    teacherId: data.teacher_id,
  };
}

/**
 * Sign in with email + password, then verify admin authorization.
 * Throws if auth fails OR user is not an active admin.
 */
export async function signInWithPassword(
  email: string,
  password: string,
  captchaToken?: string,
): Promise<AppUser> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
    options: captchaToken ? { captchaToken } : undefined,
  });

  if (error) throw new Error(error.message || 'Invalid email or password.');
  if (!data.user) throw new Error('Unable to authenticate.');

  const profile = await loadAdminProfile(
    data.user.id,
    data.user.email ?? '',
  );

  if (!profile) {
    await supabase.auth.signOut();
    throw new Error('You are not authorized to access this system.');
  }

  return profile;
}

/**
 * Restore user from an existing Supabase session (app launch / page reload).
 * Returns null if no valid session or user is not an active admin.
 */
export async function restoreUser(): Promise<AppUser | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) return null;

  const profile = await loadAdminProfile(
    session.user.id,
    session.user.email ?? '',
  );

  if (!profile) {
    await supabase.auth.signOut();
    return null;
  }

  return profile;
}

/**
 * Get the current Supabase access token for API calls to the FastAPI backend.
 */
export async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export { loadAdminProfile };
