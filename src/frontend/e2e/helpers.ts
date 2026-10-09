import { APIRequestContext, Page, expect, request } from '@playwright/test';

export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:5000/api/v1';

export const DEMO = {
  customer: { email: 'customer@brocomod.com', password: 'Password123!' },
  garage: { email: 'garage.owner@centralmetro.com', password: 'Password123!' },
  advisor: { email: 'advisor@brocomod.com', password: 'Password123!' },
  admin: { email: 'admin@brocomod.com', password: 'Password123!' },
} as const;

export type Role = keyof typeof DEMO;

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; fullName: string; roles: string[]; permissions: string[] };
}

export async function apiContext(token?: string): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: API_URL.endsWith('/') ? API_URL : `${API_URL}/`,
    extraHTTPHeaders: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export async function apiLogin(email: string, password: string): Promise<Session> {
  const api = await apiContext();
  const res = await api.post('auth/login', { data: { email, password } });
  expect(res.ok(), `login ${email}: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = await res.json();
  await api.dispose();
  return body.data as Session;
}

/** Signs a page in by seeding the same localStorage keys the app's AuthContext uses. */
export async function signIn(page: Page, who: Role | Session) {
  const session = typeof who === 'string' ? await apiLogin(DEMO[who].email, DEMO[who].password) : who;
  await page.goto('/login');
  await page.evaluate((s) => {
    localStorage.setItem('broco_access_token', s.accessToken);
    localStorage.setItem('broco_refresh_token', s.refreshToken);
    localStorage.setItem('broco_user', JSON.stringify(s.user));
  }, session);
  return session;
}

/** Fails if the page can be scrolled sideways (the most common mobile layout bug). */
export async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
  });
  expect(overflow.scrollWidth, `${label}: page is ${overflow.scrollWidth}px wide in a ${overflow.clientWidth}px viewport`).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

export function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e4)}@e2e.brocomod.com`;
}
