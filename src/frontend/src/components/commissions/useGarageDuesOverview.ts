'use client';

import { useCallback, useEffect, useState } from 'react';
import { GARAGE_DUES_CHANGED, garageDuesApi, type DuesPortal, type GarageDuesOverview } from './garageDuesApi';

const REFRESH_MS = 5 * 60 * 1000;

/**
 * Garage dues totals for a staff portal, refreshed every few minutes and whenever a reminder,
 * payment or waiver is recorded in this tab. Used by the nav badge and the dashboard cards.
 */
export function useGarageDuesOverview(portal: DuesPortal, city?: string) {
  const [overview, setOverview] = useState<GarageDuesOverview | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const res = await garageDuesApi.overview(portal, city);
    if (res.success && res.data) {
      setOverview(res.data);
      setFailed(false);
    } else {
      setFailed(true);
    }
  }, [portal, city]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    window.addEventListener(GARAGE_DUES_CHANGED, load);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(GARAGE_DUES_CHANGED, load);
    };
  }, [load]);

  return { overview, failed, reload: load };
}
