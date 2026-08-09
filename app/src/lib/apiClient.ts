/**
 * API Client for Ahadiya School Management System
 * Auto-attaches Authorization header and handles errors.
 * Token is now managed by Supabase Auth — the AuthContext bridges
 * the Supabase access_token here via setAccessToken().
 */

import { supabase } from './supabase';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retryCount = 0,
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  // Don't set Content-Type for FormData (browser sets boundary automatically)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const url = `${BASE_URL}${path}`;

  try {
    const res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
      // Token expired or invalid — sign out via Supabase
      setAccessToken(null);
      supabase.auth.signOut();

      // Redirect to login if we aren't already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      throw new ApiError(401, 'Unauthorized');
    }

    if (res.status === 403) {
      throw new ApiError(403, 'Access denied');
    }

    if (res.status >= 500 && retryCount < 1) {
      // Retry once on server errors
      await new Promise(r => setTimeout(r, 1000));
      return request<T>(path, options, retryCount + 1);
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new ApiError(res.status, data.detail || `Request failed: ${res.status}`, data);
    }

    // Handle PDF downloads (binary response)
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/pdf')) {
      return (await res.blob()) as unknown as T;
    }

    // Handle empty responses
    if (res.status === 204 || contentType === '') {
      return {} as T;
    }

    return await res.json();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, (err as Error).message);
  }
}

// Typed HTTP methods
export const api = {
  get: <T = unknown>(path: string) => request<T>(path),

  post: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  patch: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  put: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  delete: <T = unknown>(path: string) =>
    request<T>(path, { method: 'DELETE' }),

  upload: <T = unknown>(path: string, formData: FormData) =>
    request<T>(path, {
      method: 'POST',
      body: formData,
    }),
};

export default api;
