import api from '@/api/axios';
import { BillingCycle, EmployerSubscription, readEmployerSubscription, subscriptionError } from '@/utils/employerSubscription';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

const ROOT = '/employer/subscription';

export function useEmployerSubscription() {
  const [data, setData] = useState<EmployerSubscription | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
  const alive = useRef(true);
  const working = useRef(false);
  const current = useRef<EmployerSubscription | null>(null);
  const request = useRef<{ cycle: BillingCycle; id: string } | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; controller.current?.abort(); };
  }, []);

  const operate = useCallback(async (action: (signal: AbortSignal, token: string, accept: (raw: unknown) => Promise<EmployerSubscription | null>) => Promise<void>) => {
    if (working.current || !alive.current) return;
    working.current = true; setBusy(true);
    const abort = new AbortController(); controller.current = abort;
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;
      const accept = async (raw: unknown) => {
        if (!alive.current || abort.signal.aborted || await AsyncStorage.getItem('userToken') !== token) return null;
        const result = readEmployerSubscription(raw);
        current.current = result; setData(result);
        if (result.payment?.status === 'paid' || result.payment?.status === 'expired') request.current = null;
        return result;
      };
      await action(abort.signal, token, accept);
    } catch (error) {
      if (alive.current && !abort.signal.aborted) setNotice({ title: 'Could not update subscription', message: subscriptionError(error) });
    } finally {
      working.current = false;
      if (alive.current) setBusy(false);
    }
  }, []);

  const refresh = useCallback((verify = false) => operate(async (signal, token, accept) => {
    const response = await api.get(ROOT, { signal, timeout: 30000 });
    const result = await accept(response.data);
    if (!result || !verify || !result.payment?.checkout_url) return;
    const checked = await api.post(`${ROOT}/payments/${result.payment.id}/verify`, {}, { signal, timeout: 30000 });
    const updated = await accept(checked.data);
    if (updated?.payment?.status === 'paid') setNotice({ title: 'Payment confirmed', message: 'Your Premium plan is now active. You can view its expiry date below.' });
  }), [operate]);

  const checkPayment = useCallback(() => operate(async (signal, token, accept) => {
    const payment = current.current?.payment;
    if (!payment) { await accept((await api.get(ROOT, { signal, timeout: 30000 })).data); return; }
    const response = await api.post(`${ROOT}/payments/${payment.id}/verify`, {}, { signal, timeout: 30000 });
    const updated = await accept(response.data);
    if (!updated) return;
    setNotice(updated.payment?.status === 'paid'
      ? { title: 'Payment confirmed', message: 'Your Premium plan is now active.' }
      : { title: 'Payment not confirmed yet', message: updated.payment?.status === 'expired' ? 'This checkout has expired. You can start a new checkout.' : 'Your payment is still pending. Complete the checkout, then check again.' });
  }), [operate]);

  const checkout = useCallback((cycle: BillingCycle) => operate(async (signal, token, accept) => {
    const previous = current.current?.payment;
    if (!request.current || request.current.cycle !== cycle) request.current = { cycle, id: Crypto.randomUUID() };
    const response = await api.post(`${ROOT}/checkout`, { billing_cycle: cycle, request_id: request.current.id }, { signal, timeout: 30000 });
    let result = await accept(response.data);
    if (!result) return;
    if (previous?.id === result.payment?.id && previous?.checkout_url) {
      result = await accept((await api.post(`${ROOT}/payments/${previous.id}/verify`, {}, { signal, timeout: 30000 })).data);
      if (!result) return;
    }
    if (result.payment?.status === 'paid') { setNotice({ title: 'Payment confirmed', message: 'Your Premium plan is already active.' }); return; }
    if (result.payment?.status === 'expired') { setNotice({ title: 'Checkout expired', message: 'Start a new checkout to continue.' }); return; }
    if (!result.payment?.checkout_url) throw new Error('Checkout unavailable');
    await WebBrowser.openBrowserAsync(result.payment.checkout_url);
    if (!alive.current || signal.aborted || await AsyncStorage.getItem('userToken') !== token) return;
    const checked = await api.post(`${ROOT}/payments/${result.payment.id}/verify`, {}, { signal, timeout: 30000 });
    const updated = await accept(checked.data);
    if (updated?.payment?.status === 'paid') setNotice({ title: 'Payment confirmed', message: 'Your Premium plan is now active.' });
  }), [operate]);

  useFocusEffect(useCallback(() => {
    void refresh(true);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh(true); });
    return () => listener.remove();
  }, [refresh]));

  return { data, busy, notice, dismissNotice: () => setNotice(null), refresh, checkPayment, checkout };
}
