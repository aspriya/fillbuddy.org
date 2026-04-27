'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics/client';
import type { EventType } from '@/lib/analytics/schema';

/**
 * Fires a single analytics event when this component mounts.
 *
 * Used to wire `landing_view` and `app_open` from inside otherwise
 * server-rendered routes without converting the whole route to a
 * client component.
 *
 * Renders nothing.
 */
export default function AnalyticsBeacon({ event }: { event: EventType }) {
  useEffect(() => {
    trackEvent(event);
    // We deliberately fire once on mount; if the user navigates away
    // and back via the Next router the component remounts and counts
    // as a new view, which is the desired behaviour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
