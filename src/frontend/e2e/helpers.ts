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

/**
 * Fails if visible text or a form control sticks out past the right edge of the screen. This catches
 * content clipped by an `overflow-hidden` parent, which the page-width check above can't see.
 * Things inside sideways-scrollable strips (tables, chip rows) are allowed to extend.
 */
export async function expectNothingClipped(page: Page, label: string) {
  const clipped = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const scrollsSideways = (el: Element | null): boolean => {
      for (let p = el?.parentElement; p; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if ((ox === 'auto' || ox === 'scroll') && p.scrollWidth > p.clientWidth) return true;
      }
      return false;
    };
    const found: string[] = [];
    document.querySelectorAll('h1,h2,h3,p,label,button,a,input,select,textarea,li,span').forEach((el) => {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || style.visibility === 'hidden' || el.closest('[aria-hidden="true"]')) return;
      if (r.right > vw + 1 && r.left < vw && !scrollsSideways(el)) {
        found.push(`${el.tagName.toLowerCase()} "${(el.textContent || (el as HTMLInputElement).placeholder || '').trim().slice(0, 40)}" ends at ${Math.round(r.right)}px`);
      }
    });
    return { vw, found: found.slice(0, 5) };
  });
  expect(clipped.found, `${label}: content wider than the ${clipped.vw}px screen`).toEqual([]);
}

export function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e4)}@e2e.brocomod.com`;
}
