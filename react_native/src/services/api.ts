/**
 * API Client for Ahadiya School Management System (React Native)
 * Auto-attaches Authorization header and handles errors.
 * Token is now managed by Supabase Auth — the AuthContext bridges
 * the Supabase access_token here via setAccessToken().
 */

import { Platform } from 'react-native';
import { supabase } from './supabase';

const fallbackHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || `http://${fallbackHost}:8000/api`;
let token: string | null = null;

export const setAccessToken = (value: string | null) => { token = value; };
export const getAccessToken = () => token;

export class ApiError extends Error { constructor(public status: number, message: string, public data?: any) { super(message); } }

async function request<T>(path: string, init: RequestInit = {}, retry = true, authRetried = false): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> || {}) };
  if (!(init.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
    if (response.status === 401) {
      // The app may resume before automatic token refresh completes. Refresh
      // and replay once before treating this as a genuinely invalid session.
      if (!authRetried) {
        const { data, error } = await supabase.auth.refreshSession();
        if (!error && data.session?.access_token) {
          setAccessToken(data.session.access_token);
          return request<T>(path, init, retry, true);
        }
      }

      // A 401 from the school API can also mean that the backend has stale or
      // mismatched Supabase configuration. Verify the session with Supabase
      // itself before clearing a valid login from this device.
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const authStatus = userError?.status;
      const sessionIsInvalid = !userError && !userData.user
        || authStatus === 401
        || authStatus === 403;

      if (sessionIsInvalid) {
        setAccessToken(null);
        await supabase.auth.signOut({ scope: 'local' });
        throw new ApiError(401, 'Your session has expired. Please sign in again.');
      }

      throw new ApiError(
        401,
        userData.user
          ? 'The school server rejected a valid login. Please check its Supabase configuration.'
          : 'Could not verify your login. Check your connection and try again.',
        userError,
      );
    }
    if (response.status >= 500 && retry) return request<T>(path, init, false, authRetried);
    if (!response.ok) { const data = await response.json().catch(() => ({})); throw new ApiError(response.status, data.detail || `Request failed (${response.status})`, data); }
    if (response.status === 204) return {} as T;
    const text = await response.text(); return text ? JSON.parse(text) : {} as T;
  } catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(0, 'Cannot reach the school server. Check the API address and connection.', error); }
}
export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T = unknown>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) }),
  patch: <T = unknown>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T = unknown>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T = unknown>(path: string) => request<T>(path, { method: 'DELETE' }),
};
