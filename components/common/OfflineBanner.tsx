import { useConnectivityNotice } from '@/hooks/useConnectivityNotice';
import { useToast } from '@/hooks/useToast';
import React, { useEffect } from 'react';

/** Announces connection changes without shifting or remounting the screen. */
export default function OfflineBanner({ children }: { children: React.ReactNode }) {
  const notice = useConnectivityNotice();
  const { showToast } = useToast();

  useEffect(() => {
    if (notice === 'offline') {
      showToast({
        type: 'warning',
        title: "You're offline",
        message: 'Check your internet connection.',
        iconName: 'wifi-off',
        duration: 5000,
      });
    } else if (notice === 'restored') {
      showToast({
        type: 'success',
        title: 'Back online',
        message: 'Your connection is restored.',
        iconName: 'wifi',
        duration: 3000,
      });
    }
  }, [notice, showToast]);

  return <>{children}</>;
}
