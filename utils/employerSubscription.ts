import { JobQuota, normalizeJobQuota } from './jobQuota';

export type BillingCycle = 'monthly' | 'annually';
export type SubscriptionPayment = {
  id: string;
  billing_cycle: BillingCycle;
  amount: number;
  status: 'creating' | 'pending' | 'paid' | 'expired';
  checkout_url: string | null;
};
export type EmployerSubscription = {
  subscription: { plan: 'basic' | 'premium'; expires_at: string | null; test_mode: true; prices: Record<BillingCycle, number>; job_quota?: JobQuota };
  payment: SubscriptionPayment | null;
};

export function isPayMongoCheckoutUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'checkout.paymongo.com' && !url.username && !url.password && !url.port;
  } catch { return false; }
}

export function readEmployerSubscription(value: unknown): EmployerSubscription {
  const data = value as Partial<EmployerSubscription> | null;
  const subscription = data?.subscription;
  if (!subscription || !['basic', 'premium'].includes(subscription.plan) || subscription.test_mode !== true
    || (subscription.expires_at !== null && (typeof subscription.expires_at !== 'string' || !Number.isFinite(Date.parse(subscription.expires_at))))
    || !Number.isSafeInteger(subscription.prices?.monthly) || subscription.prices.monthly <= 0
    || !Number.isSafeInteger(subscription.prices?.annually) || subscription.prices.annually <= 0) throw new Error('Subscription details are unavailable. Please try again.');
  const payment = data?.payment;
  const quota = normalizeJobQuota(subscription.job_quota);
  if (subscription.job_quota !== undefined && !quota) throw new Error('Job posting limits are unavailable. Please try again.');
  if (payment !== null && (!payment || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(payment.id)
    || !['monthly', 'annually'].includes(payment.billing_cycle) || !['creating', 'pending', 'paid', 'expired'].includes(payment.status)
    || !Number.isSafeInteger(payment.amount) || payment.amount <= 0
    || (payment.checkout_url !== null && !isPayMongoCheckoutUrl(payment.checkout_url)))) throw new Error('Checkout details are unavailable. Please try again.');
  return { subscription: quota ? { ...subscription, job_quota: quota } : subscription, payment: payment ?? null };
}

export function subscriptionError(error: unknown): string {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === 401) return 'Please log in again to manage your subscription.';
  if (status === 403) return 'Subscriptions are available to employer accounts.';
  if (status === 404) return 'Subscription checkout is not available yet. Please try again later.';
  if (status === 409) return 'A checkout is already in progress. Check your payment or resume that checkout.';
  if (status === 422) return 'The payment details could not be verified. Please check your checkout and try again.';
  if (status === 429) return 'Please wait a moment before trying again.';
  return 'Could not connect to the payment service. Please try again. Your plan changes only after payment is confirmed.';
}
