import type { NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export type ConnectivityNotice = 'offline' | 'restored' | null;

type NetworkMonitor = typeof import('@react-native-community/netinfo').default;

function loadNetworkMonitor(): NetworkMonitor | null {
  try {
    // Older development APKs do not contain this native module. Let them keep
    // running; the banner becomes available after installing the new build.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@react-native-community/netinfo').default;
  } catch {
    if (__DEV__) {
      console.warn('The offline banner needs a new development build containing NetInfo.');
    }
    return null;
  }
}

export function useConnectivityNotice(): ConnectivityNotice {
  const [notice, setNotice] = useState<ConnectivityNotice>(null);

  useEffect(() => {
    const network = loadNetworkMonitor();
    if (!network) return;

    let alive = true;
    let active = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    let lastOnline: boolean | null = null;
    let restoredTimer: ReturnType<typeof setTimeout> | undefined;

    const clearRestoredTimer = () => {
      if (restoredTimer !== undefined) clearTimeout(restoredTimer);
      restoredTimer = undefined;
    };

    const receive = (state: NetInfoState) => {
      if (!alive || !active) return;
      const online = state.isConnected === false || state.isInternetReachable === false
        ? false
        : state.isConnected === true && state.isInternetReachable === true
          ? true
          : null;

      // Connecting / unknown does not mean offline or recovered.
      if (online === null || online === lastOnline) return;
      const wasOffline = lastOnline === false;
      lastOnline = online;
      clearRestoredTimer();

      if (!online) {
        setNotice('offline');
      } else if (wasOffline) {
        setNotice('restored');
        restoredTimer = setTimeout(() => {
          if (alive && active) setNotice(null);
          restoredTimer = undefined;
        }, 2500);
      } else {
        setNotice(null);
      }
    };

    const unsubscribe = network.addEventListener(receive);
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      active = nextState === 'active';
      if (active) {
        // Refresh dispatches a new event to receive. A failed check is not
        // evidence of a lost connection and must not change the user's session.
        void network.refresh().catch(() => {});
      } else {
        clearRestoredTimer();
        setNotice((current) => current === 'restored' ? null : current);
      }
    });

    return () => {
      alive = false;
      unsubscribe();
      appStateSubscription.remove();
      clearRestoredTimer();
    };
  }, []);

  return notice;
}
