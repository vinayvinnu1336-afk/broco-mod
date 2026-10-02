import { ApiResponse } from '@/types/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('broco_access_token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      if (response.status === 401) {
        // Handle unauthorized / expired token
        if (typeof window !== 'undefined' && !endpoint.includes('/auth/')) {
          localStorage.removeItem('broco_access_token');
          localStorage.removeItem('broco_refresh_token');
          localStorage.removeItem('broco_user');
          window.location.href = '/login?expired=true';
        }
      }

      return {
        success: false,
        message: data?.message || `Request failed with status ${response.status}`,
        errors: data?.errors || [response.statusText],
      };
    }

    return data || { success: true, message: 'Success' };
  } catch (err: unknown) {
    const error = err as Error;
    return {
      success: false,
      message: error?.message || 'Network error occurred while contacting the server.',
      errors: [error?.message || 'Network error'],
    };
  }
}
