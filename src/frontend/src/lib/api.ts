import { ApiResponse } from '@/types/auth';

function getApiBase(): string {
  // If explicitly configured in environment
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) {
    const trimmed = envUrl.replace(/\/+$/, '');
    return trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
  }

  // In the browser, check if served behind reverse proxy (e.g. Nginx on port 80/443 or default port)
  if (typeof window !== 'undefined') {
    if (!window.location.port || window.location.port === '80' || window.location.port === '443') {
      return '/api/v1';
    }
  }

  // Fallback for direct local dev or server-side calls
  return 'http://localhost:5000/api/v1';
}

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

  const apiBase = getApiBase();
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith('http') ? endpoint : `${apiBase}${normalizedEndpoint}`;

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
